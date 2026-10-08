-- ==============================================================================
-- Release reconciliation: make prod (`doctors`) and the QA mirror (`sandbox`) match the code
-- that ships when `sandbox` merges into `main`. Every statement is idempotent.
--
-- Apply AFTER 20261007000000 (register_doctor / admin list). Neither project records the
-- earlier migrations in supabase_migrations, so this file restates the final version of every
-- object the store-hierarchy release touched instead of relying on what ran before.
-- ==============================================================================

-- 1. Admin password check: 20261002000001 re-granted it to anon, so the shared admin password
--    could be guessed straight against PostgREST, bypassing the login rate limit. Every caller
--    (the /api/admin routes and the admin edge functions) uses the service-role key.
DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    to_regprocedure('public.assert_wheel_admin(text)'),
    to_regprocedure('doctors.assert_wheel_admin(text)'),
    to_regprocedure('sandbox.assert_wheel_admin(text)')
  ] LOOP
    CONTINUE WHEN fn IS NULL;
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
  IF to_regprocedure('public.assert_wheel_admin(text)') IS NOT NULL THEN
    ALTER FUNCTION public.assert_wheel_admin(text) SET search_path = doctors, public;
  END IF;
END $$;

-- 2. Partner and Main Store dashboards. 20261002000001 pointed the `doctors` copies at
--    public.shop_orders, which does not exist in prod (42P01 on every call). 20261005000000
--    repaired partner_dashboard but dropped the store / points fields the portal now reads.
--    These are the 20261002000001 bodies with the `doctors` copies reading doctors.shop_orders.
CREATE OR REPLACE FUNCTION doctors.partner_dashboard(
  p_scope text default 'all',
  p_status text default null,
  p_limit integer default 25,
  p_offset integer default 0,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null,
  p_sort text default 'newest'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = doctors, public
AS $$
DECLARE
  v_email text;
  v_doctor doctors.doctor_registrations;
  v_scope text := lower(trim(coalesce(p_scope, 'all')));
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_order_count bigint;
  v_orders jsonb;
BEGIN
  if v_scope not in ('all', 'direct', 'referred') then
    raise exception 'Invalid order scope.' using errcode = '22023';
  end if;
  if lower(coalesce(p_sort, 'newest')) not in ('newest', 'oldest') then
    raise exception 'Invalid order sort.' using errcode = '22023';
  end if;

  v_email := nullif(lower(trim(coalesce(auth.jwt() ->> 'email', ''))), '');
  if v_email is null then
    raise exception 'Sign in to view your dashboard.' using errcode = '42501';
  end if;

  select * into v_doctor
  from doctors.doctor_registrations
  where email = v_email
  limit 1;

  if v_doctor.id is null then
    raise exception 'This email is not registered as a GutGuard partner.' using errcode = '42501';
  end if;

  select count(*) into v_order_count
  from doctors.shop_orders o
  join doctors.doctor_registrations source on source.id = o.referral_doctor_id
  where (source.id = v_doctor.id or source.referred_by_partner_id = v_doctor.id)
    and (
      v_scope = 'all'
      or (v_scope = 'direct' and source.id = v_doctor.id)
      or (v_scope = 'referred' and source.referred_by_partner_id = v_doctor.id)
    )
    and doctors.partner_order_matches_status(o.payment_status, o.status, p_status)
    and (p_date_from is null or o.created_at >= p_date_from)
    and (p_date_to is null or o.created_at < p_date_to + interval '1 day');

  select coalesce(jsonb_agg(entry order by
    case when lower(coalesce(p_sort, 'newest')) = 'oldest' then sort_at end asc,
    case when lower(coalesce(p_sort, 'newest')) = 'newest' then sort_at end desc
  ), '[]'::jsonb) into v_orders
  from (
    select o.created_at as sort_at, jsonb_build_object(
      'order_code', o.order_code,
      'created_at', o.created_at,
      'status', o.status,
      'payment_status', o.payment_status,
      'total_amount', coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0)),
      'buyer_first_name', coalesce(o.first_name, split_part(o.customer_name, ' ', 1)),
      'buyer_name', coalesce(
        nullif(trim(o.customer_name), ''),
        nullif(trim(concat_ws(' ', o.first_name, o.last_name)), '')
      ),
      'buyer_email', coalesce(o.email, ''),
      'buyer_mobile', coalesce(o.mobile, ''),
      'address', coalesce(o.address, ''),
      'barangay', coalesce(o.barangay, ''),
      'zip', coalesce(o.zip, ''),
      'city', o.city,
      'province', o.province,
      'source_type', case when source.id = v_doctor.id then 'direct' else 'referred' end,
      'source_partner_name', source.full_name,
      'source_partner_slug', source.routing_slug
    ) as entry
    from doctors.shop_orders o
    join doctors.doctor_registrations source on source.id = o.referral_doctor_id
    where (source.id = v_doctor.id or source.referred_by_partner_id = v_doctor.id)
      and (
        v_scope = 'all'
        or (v_scope = 'direct' and source.id = v_doctor.id)
        or (v_scope = 'referred' and source.referred_by_partner_id = v_doctor.id)
      )
      and doctors.partner_order_matches_status(o.payment_status, o.status, p_status)
      and (p_date_from is null or o.created_at >= p_date_from)
      and (p_date_to is null or o.created_at < p_date_to + interval '1 day')
    order by
      case when lower(coalesce(p_sort, 'newest')) = 'oldest' then o.created_at end asc,
      case when lower(coalesce(p_sort, 'newest')) = 'newest' then o.created_at end desc
    limit v_limit offset v_offset
  ) page;

  return jsonb_build_object(
    'partner', jsonb_build_object(
      'id', v_doctor.id,
      'full_name', v_doctor.full_name,
      'routing_slug', v_doctor.routing_slug,
      'store_type', v_doctor.store_type,
      'referral_qr_enabled', v_doctor.referral_qr_enabled,
      'main_store_id', v_doctor.main_store_id,
      'promoted_at', v_doctor.promoted_at,
      'promoted_by', v_doctor.promoted_by,
      'joined_at', v_doctor.created_at
    ),
    'clicks', jsonb_build_object(
      'total', (
        select count(*) from doctors.referral_clicks c where c.doctor_id = v_doctor.id
      ),
      'last_30_days', (
        select count(*) from doctors.referral_clicks c
        where c.doctor_id = v_doctor.id and c.created_at >= now() - interval '30 days'
      )
    ),
    'points', (
      SELECT jsonb_build_object(
        'total_all_time', coalesce(sum(p.points), 0),
        'own_points', coalesce(sum(p.points) filter (where p.depth = 0), 0),
        'passup_points', coalesce(sum(p.points) filter (where p.depth = 1), 0),
        'current_cycle', floor(coalesce(sum(p.points), 0) / 1500) + 1,
        'points_in_cycle', coalesce(sum(p.points), 0) % 1500
      )
      FROM doctors.partner_points p
      WHERE p.partner_id = v_doctor.id
    ),
    'rebates', (
      SELECT coalesce(jsonb_agg(
        jsonb_build_object(
          'cycle_number', m.cycle_number,
          'milestone_pts', m.milestone_pts,
          'rebate_amount', m.rebate_amount,
          'status', m.status,
          'created_at', m.created_at
        ) ORDER BY m.created_at DESC
      ), '[]'::jsonb)
      FROM doctors.milestone_unlocks m
      WHERE m.partner_id = v_doctor.id
    ),
    'point_sources', (
      SELECT coalesce(jsonb_agg(
        jsonb_build_object(
          'order_code', coalesce(o.order_code, pp.order_id::text),
          'points', pp.points,
          'depth', pp.depth,
          'source_partner', coalesce(seller.full_name, 'Direct Customer'),
          'created_at', pp.created_at
        ) ORDER BY pp.created_at DESC
      ), '[]'::jsonb)
      FROM doctors.partner_points pp
      LEFT JOIN doctors.shop_orders o ON o.id = pp.order_id
      LEFT JOIN doctors.doctor_registrations seller ON seller.id = o.referral_doctor_id
      WHERE pp.partner_id = v_doctor.id
    ),
    'totals', (
      select jsonb_build_object(
        'direct_orders', count(*) filter (where source.id = v_doctor.id),
        'referred_orders', count(*) filter (where source.referred_by_partner_id = v_doctor.id),
        'orders', count(*),
        'paid_orders', count(*) filter (where o.payment_status = 'paid'),
        'direct_paid_amount', coalesce(sum(
          coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0))
        ) filter (where o.payment_status = 'paid' and source.id = v_doctor.id), 0),
        'referred_paid_amount', coalesce(sum(
          coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0))
        ) filter (where o.payment_status = 'paid' and source.referred_by_partner_id = v_doctor.id), 0),
        'paid_amount', coalesce(sum(
          coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0))
        ) filter (where o.payment_status = 'paid'), 0),
        'referred_partners', (
          select count(*) from doctors.doctor_registrations d
          where d.referred_by_partner_id = v_doctor.id
        )
      )
      from doctors.shop_orders o
      join doctors.doctor_registrations source on source.id = o.referral_doctor_id
      where source.id = v_doctor.id or source.referred_by_partner_id = v_doctor.id
    ),
    'orders', v_orders,
    'orders_page', jsonb_build_object(
      'total', v_order_count,
      'limit', v_limit,
      'offset', v_offset,
      'has_more', v_offset + jsonb_array_length(v_orders) < v_order_count
    ),
    'referred_partners', (
      select coalesce(jsonb_agg(entry order by joined_at desc), '[]'::jsonb)
      from (
        select child.created_at as joined_at, jsonb_build_object(
          'full_name', child.full_name,
          'routing_slug', child.routing_slug,
          'specialty', child.specialty,
          'practice_location', child.practice_location,
          'store_type', child.store_type,
          'referral_qr_enabled', child.referral_qr_enabled,
          'joined_at', child.created_at,
          'orders', count(o.id),
          'paid_order_value', coalesce(sum(
            coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0))
          ) filter (where o.payment_status = 'paid'), 0)
        ) as entry
        from doctors.doctor_registrations child
        left join doctors.shop_orders o on o.referral_doctor_id = child.id
        where child.referred_by_partner_id = v_doctor.id
        group by child.id
        order by child.created_at desc
      ) partners
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION sandbox.partner_dashboard(
  p_scope text default 'all',
  p_status text default null,
  p_limit integer default 25,
  p_offset integer default 0,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null,
  p_sort text default 'newest'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = sandbox, doctors, public
AS $$
DECLARE
  v_email text;
  v_doctor doctors.doctor_registrations;
  v_scope text := lower(trim(coalesce(p_scope, 'all')));
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_order_count bigint;
  v_orders jsonb;
BEGIN
  if v_scope not in ('all', 'direct', 'referred') then
    raise exception 'Invalid order scope.' using errcode = '22023';
  end if;
  if lower(coalesce(p_sort, 'newest')) not in ('newest', 'oldest') then
    raise exception 'Invalid order sort.' using errcode = '22023';
  end if;

  v_email := nullif(lower(trim(coalesce(auth.jwt() ->> 'email', ''))), '');
  if v_email is null then
    raise exception 'Sign in to view your dashboard.' using errcode = '42501';
  end if;

  select * into v_doctor
  from doctors.doctor_registrations
  where email = v_email
  limit 1;

  if v_doctor.id is null then
    raise exception 'This email is not registered as a GutGuard partner.' using errcode = '42501';
  end if;

  select count(*) into v_order_count
  from sandbox.shop_orders o
  join doctors.doctor_registrations source on source.id = o.referral_doctor_id
  where (source.id = v_doctor.id or source.referred_by_partner_id = v_doctor.id)
    and (
      v_scope = 'all'
      or (v_scope = 'direct' and source.id = v_doctor.id)
      or (v_scope = 'referred' and source.referred_by_partner_id = v_doctor.id)
    )
    and sandbox.partner_order_matches_status(o.payment_status, o.status, p_status)
    and (p_date_from is null or o.created_at >= p_date_from)
    and (p_date_to is null or o.created_at < p_date_to + interval '1 day');

  select coalesce(jsonb_agg(entry order by
    case when lower(coalesce(p_sort, 'newest')) = 'oldest' then sort_at end asc,
    case when lower(coalesce(p_sort, 'newest')) = 'newest' then sort_at end desc
  ), '[]'::jsonb) into v_orders
  from (
    select o.created_at as sort_at, jsonb_build_object(
      'order_code', o.order_code,
      'created_at', o.created_at,
      'status', o.status,
      'payment_status', o.payment_status,
      'total_amount', coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0)),
      'buyer_first_name', coalesce(o.first_name, split_part(o.customer_name, ' ', 1)),
      'buyer_name', coalesce(
        nullif(trim(o.customer_name), ''),
        nullif(trim(concat_ws(' ', o.first_name, o.last_name)), '')
      ),
      'buyer_email', coalesce(o.email, ''),
      'buyer_mobile', coalesce(o.mobile, ''),
      'address', coalesce(o.address, ''),
      'barangay', coalesce(o.barangay, ''),
      'zip', coalesce(o.zip, ''),
      'city', o.city,
      'province', o.province,
      'source_type', case when source.id = v_doctor.id then 'direct' else 'referred' end,
      'source_partner_name', source.full_name,
      'source_partner_slug', source.routing_slug
    ) as entry
    from sandbox.shop_orders o
    join doctors.doctor_registrations source on source.id = o.referral_doctor_id
    where (source.id = v_doctor.id or source.referred_by_partner_id = v_doctor.id)
      and (
        v_scope = 'all'
        or (v_scope = 'direct' and source.id = v_doctor.id)
        or (v_scope = 'referred' and source.referred_by_partner_id = v_doctor.id)
      )
      and sandbox.partner_order_matches_status(o.payment_status, o.status, p_status)
      and (p_date_from is null or o.created_at >= p_date_from)
      and (p_date_to is null or o.created_at < p_date_to + interval '1 day')
    order by
      case when lower(coalesce(p_sort, 'newest')) = 'oldest' then o.created_at end asc,
      case when lower(coalesce(p_sort, 'newest')) = 'newest' then o.created_at end desc
    limit v_limit offset v_offset
  ) page;

  return jsonb_build_object(
    'partner', jsonb_build_object(
      'id', v_doctor.id,
      'full_name', v_doctor.full_name,
      'routing_slug', v_doctor.routing_slug,
      'store_type', v_doctor.store_type,
      'referral_qr_enabled', v_doctor.referral_qr_enabled,
      'main_store_id', v_doctor.main_store_id,
      'promoted_at', v_doctor.promoted_at,
      'promoted_by', v_doctor.promoted_by,
      'joined_at', v_doctor.created_at
    ),
    'clicks', jsonb_build_object(
      'total', (
        select count(*) from sandbox.referral_clicks c where c.doctor_id = v_doctor.id
      ),
      'last_30_days', (
        select count(*) from sandbox.referral_clicks c
        where c.doctor_id = v_doctor.id and c.created_at >= now() - interval '30 days'
      )
    ),
    'points', (
      SELECT jsonb_build_object(
        'total_all_time', coalesce(sum(p.points), 0),
        'own_points', coalesce(sum(p.points) filter (where p.depth = 0), 0),
        'passup_points', coalesce(sum(p.points) filter (where p.depth = 1), 0),
        'current_cycle', floor(coalesce(sum(p.points), 0) / 1500) + 1,
        'points_in_cycle', coalesce(sum(p.points), 0) % 1500
      )
      FROM sandbox.partner_points p
      WHERE p.partner_id = v_doctor.id
    ),
    'rebates', (
      SELECT coalesce(jsonb_agg(
        jsonb_build_object(
          'cycle_number', m.cycle_number,
          'milestone_pts', m.milestone_pts,
          'rebate_amount', m.rebate_amount,
          'status', m.status,
          'created_at', m.created_at
        ) ORDER BY m.created_at DESC
      ), '[]'::jsonb)
      FROM sandbox.milestone_unlocks m
      WHERE m.partner_id = v_doctor.id
    ),
    'point_sources', (
      SELECT coalesce(jsonb_agg(
        jsonb_build_object(
          'order_code', coalesce(o.order_code, pp.order_id::text),
          'points', pp.points,
          'depth', pp.depth,
          'source_partner', coalesce(seller.full_name, 'Direct Customer'),
          'created_at', pp.created_at
        ) ORDER BY pp.created_at DESC
      ), '[]'::jsonb)
      FROM sandbox.partner_points pp
      LEFT JOIN sandbox.shop_orders o ON o.id = pp.order_id
      LEFT JOIN doctors.doctor_registrations seller ON seller.id = o.referral_doctor_id
      WHERE pp.partner_id = v_doctor.id
    ),
    'totals', (
      select jsonb_build_object(
        'direct_orders', count(*) filter (where source.id = v_doctor.id),
        'referred_orders', count(*) filter (where source.referred_by_partner_id = v_doctor.id),
        'orders', count(*),
        'paid_orders', count(*) filter (where o.payment_status = 'paid'),
        'direct_paid_amount', coalesce(sum(
          coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0))
        ) filter (where o.payment_status = 'paid' and source.id = v_doctor.id), 0),
        'referred_paid_amount', coalesce(sum(
          coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0))
        ) filter (where o.payment_status = 'paid' and source.referred_by_partner_id = v_doctor.id), 0),
        'paid_amount', coalesce(sum(
          coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0))
        ) filter (where o.payment_status = 'paid'), 0),
        'referred_partners', (
          select count(*) from doctors.doctor_registrations d
          where d.referred_by_partner_id = v_doctor.id
        )
      )
      from sandbox.shop_orders o
      join doctors.doctor_registrations source on source.id = o.referral_doctor_id
      where source.id = v_doctor.id or source.referred_by_partner_id = v_doctor.id
    ),
    'orders', v_orders,
    'orders_page', jsonb_build_object(
      'total', v_order_count,
      'limit', v_limit,
      'offset', v_offset,
      'has_more', v_offset + jsonb_array_length(v_orders) < v_order_count
    ),
    'referred_partners', (
      select coalesce(jsonb_agg(entry order by joined_at desc), '[]'::jsonb)
      from (
        select child.created_at as joined_at, jsonb_build_object(
          'full_name', child.full_name,
          'routing_slug', child.routing_slug,
          'specialty', child.specialty,
          'practice_location', child.practice_location,
          'store_type', child.store_type,
          'referral_qr_enabled', child.referral_qr_enabled,
          'joined_at', child.created_at,
          'orders', count(o.id),
          'paid_order_value', coalesce(sum(
            coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0))
          ) filter (where o.payment_status = 'paid'), 0)
        ) as entry
        from doctors.doctor_registrations child
        left join sandbox.shop_orders o on o.referral_doctor_id = child.id
        where child.referred_by_partner_id = v_doctor.id
        group by child.id
        order by child.created_at desc
      ) partners
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION doctors.get_main_store_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = doctors, public
AS $$
DECLARE
  v_email text;
  v_main_store doctors.doctor_registrations%ROWTYPE;
  v_result jsonb;
BEGIN
  v_email := nullif(lower(trim(coalesce(auth.jwt() ->> 'email', ''))), '');
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Sign in to view Main Store dashboard.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_main_store
  FROM doctors.doctor_registrations
  WHERE email = v_email AND store_type = 'main'
  LIMIT 1;

  IF v_main_store.id IS NULL THEN
    RAISE EXCEPTION 'This account is not a GutGuard Main Store.' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'main_store', jsonb_build_object(
      'id', v_main_store.id,
      'full_name', v_main_store.full_name,
      'routing_slug', v_main_store.routing_slug,
      'email', v_main_store.email,
      'store_type', v_main_store.store_type,
      'referral_qr_enabled', v_main_store.referral_qr_enabled
    ),
    'lifestyle_count', (
      SELECT count(*) FROM doctors.doctor_registrations
      WHERE main_store_id = v_main_store.id AND store_type = 'lifestyle'
    ),
    'affiliate_count', (
      SELECT count(*) FROM doctors.doctor_registrations
      WHERE main_store_id = v_main_store.id AND store_type = 'affiliate'
    ),
    'total_orders', (
      SELECT count(*) FROM doctors.shop_orders so
      JOIN doctors.doctor_registrations dr ON so.referral_doctor_id = dr.id
      WHERE (dr.main_store_id = v_main_store.id OR dr.id = v_main_store.id)
        AND so.payment_status = 'paid'
    ),
    'total_revenue', (
      SELECT coalesce(sum(so.total_amount), 0) FROM doctors.shop_orders so
      JOIN doctors.doctor_registrations dr ON so.referral_doctor_id = dr.id
      WHERE (dr.main_store_id = v_main_store.id OR dr.id = v_main_store.id)
        AND so.payment_status = 'paid'
    ),
    'combined_points', (
      SELECT coalesce(sum(points), 0) FROM doctors.partner_points
      WHERE partner_id = v_main_store.id
    ),
    'own_points', (
      SELECT coalesce(sum(points), 0) FROM doctors.partner_points
      WHERE partner_id = v_main_store.id AND depth = 0
    ),
    'passup_points', (
      SELECT coalesce(sum(points), 0) FROM doctors.partner_points
      WHERE partner_id = v_main_store.id AND depth = 1
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION sandbox.get_main_store_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = sandbox, doctors, public
AS $$
DECLARE
  v_email text;
  v_main_store doctors.doctor_registrations%ROWTYPE;
  v_result jsonb;
BEGIN
  v_email := nullif(lower(trim(coalesce(auth.jwt() ->> 'email', ''))), '');
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Sign in to view Main Store dashboard.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_main_store
  FROM doctors.doctor_registrations
  WHERE email = v_email AND store_type = 'main'
  LIMIT 1;

  IF v_main_store.id IS NULL THEN
    RAISE EXCEPTION 'This account is not a GutGuard Main Store.' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'main_store', jsonb_build_object(
      'id', v_main_store.id,
      'full_name', v_main_store.full_name,
      'routing_slug', v_main_store.routing_slug,
      'email', v_main_store.email,
      'store_type', v_main_store.store_type,
      'referral_qr_enabled', v_main_store.referral_qr_enabled
    ),
    'lifestyle_count', (
      SELECT count(*) FROM doctors.doctor_registrations
      WHERE main_store_id = v_main_store.id AND store_type = 'lifestyle'
    ),
    'affiliate_count', (
      SELECT count(*) FROM doctors.doctor_registrations
      WHERE main_store_id = v_main_store.id AND store_type = 'affiliate'
    ),
    'total_orders', (
      SELECT count(*) FROM sandbox.shop_orders so
      JOIN doctors.doctor_registrations dr ON so.referral_doctor_id = dr.id
      WHERE (dr.main_store_id = v_main_store.id OR dr.id = v_main_store.id)
        AND so.payment_status = 'paid'
    ),
    'total_revenue', (
      SELECT coalesce(sum(so.total_amount), 0) FROM sandbox.shop_orders so
      JOIN doctors.doctor_registrations dr ON so.referral_doctor_id = dr.id
      WHERE (dr.main_store_id = v_main_store.id OR dr.id = v_main_store.id)
        AND so.payment_status = 'paid'
    ),
    'combined_points', (
      SELECT coalesce(sum(points), 0) FROM sandbox.partner_points
      WHERE partner_id = v_main_store.id
    ),
    'own_points', (
      SELECT coalesce(sum(points), 0) FROM sandbox.partner_points
      WHERE partner_id = v_main_store.id AND depth = 0
    ),
    'passup_points', (
      SELECT coalesce(sum(points), 0) FROM sandbox.partner_points
      WHERE partner_id = v_main_store.id AND depth = 1
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION doctors.get_main_store_reports(
  p_scope text default 'all',
  p_store_id uuid default null,
  p_status text default null,
  p_limit integer default 25,
  p_offset integer default 0,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null,
  p_sort text default 'newest'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = doctors, public
AS $$
DECLARE
  v_email text;
  v_main_store doctors.doctor_registrations%ROWTYPE;
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_total_orders bigint;
  v_orders jsonb;
  v_stores jsonb;
BEGIN
  v_email := nullif(lower(trim(coalesce(auth.jwt() ->> 'email', ''))), '');
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Sign in to view Main Store reports.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_main_store
  FROM doctors.doctor_registrations
  WHERE email = v_email AND store_type = 'main'
  LIMIT 1;

  IF v_main_store.id IS NULL THEN
    RAISE EXCEPTION 'This account is not a GutGuard Main Store.' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_total_orders
  FROM doctors.shop_orders o
  JOIN doctors.doctor_registrations dr ON o.referral_doctor_id = dr.id
  WHERE (dr.main_store_id = v_main_store.id OR dr.id = v_main_store.id)
    AND (p_store_id IS NULL OR dr.id = p_store_id)
    AND doctors.partner_order_matches_status(o.payment_status, o.status, p_status)
    AND (p_date_from IS NULL OR o.created_at >= p_date_from)
    AND (p_date_to IS NULL OR o.created_at < p_date_to + interval '1 day');

  SELECT coalesce(jsonb_agg(entry order by
    case when lower(coalesce(p_sort, 'newest')) = 'oldest' then sort_at end asc,
    case when lower(coalesce(p_sort, 'newest')) = 'newest' then sort_at end desc
  ), '[]'::jsonb) INTO v_orders
  FROM (
    SELECT o.created_at as sort_at, jsonb_build_object(
      'order_code', o.order_code,
      'created_at', o.created_at,
      'status', o.status,
      'payment_status', o.payment_status,
      'payment_method', o.payment_method,
      'maya_reference', o.maya_reference,
      'maya_payment_status', o.maya_payment_status,
      'maya_fund_source', o.maya_fund_source,
      'paid_at', o.paid_at,
      'total_amount', coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0)),
      'subtotal', coalesce(o.subtotal, 0),
      'shipping_fee', coalesce(o.shipping_fee, 0),
      'shipping_region', o.shipping_region,
      'buyer_name', coalesce(nullif(trim(o.customer_name), ''), trim(coalesce(o.first_name, '') || ' ' || coalesce(o.last_name, ''))),
      'email', coalesce(o.email, ''),
      'mobile', coalesce(o.mobile, ''),
      'address', coalesce(o.address, ''),
      'city', coalesce(o.city, ''),
      'province', coalesce(o.province, ''),
      'barangay', coalesce(o.barangay, ''),
      'zip', coalesce(o.zip, ''),
      'items', coalesce(o.items, '[]'::jsonb),
      'store_id', dr.id,
      'store_name', dr.full_name,
      'store_type', dr.store_type,
      'store_slug', dr.routing_slug
    ) AS entry
    FROM doctors.shop_orders o
    JOIN doctors.doctor_registrations dr ON o.referral_doctor_id = dr.id
    WHERE (dr.main_store_id = v_main_store.id OR dr.id = v_main_store.id)
      AND (p_store_id IS NULL OR dr.id = p_store_id)
      AND doctors.partner_order_matches_status(o.payment_status, o.status, p_status)
      AND (p_date_from IS NULL OR o.created_at >= p_date_from)
      AND (p_date_to IS NULL OR o.created_at < p_date_to + interval '1 day')
    ORDER BY
      case when lower(coalesce(p_sort, 'newest')) = 'oldest' then o.created_at end asc,
      case when lower(coalesce(p_sort, 'newest')) = 'newest' then o.created_at end desc
    LIMIT v_limit OFFSET v_offset
  ) sub;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', dr.id,
    'full_name', dr.full_name,
    'store_type', dr.store_type,
    'routing_slug', dr.routing_slug,
    'specialty', dr.specialty,
    'practice_location', dr.practice_location,
    'created_at', dr.created_at,
    'referral_qr_enabled', dr.referral_qr_enabled,
    'orders_count', (
      SELECT count(*) FROM doctors.shop_orders so
      WHERE so.referral_doctor_id = dr.id AND so.payment_status = 'paid'
    ),
    'revenue', (
      SELECT coalesce(sum(so.total_amount), 0) FROM doctors.shop_orders so
      WHERE so.referral_doctor_id = dr.id AND so.payment_status = 'paid'
    ),
    'points', (
      SELECT coalesce(sum(points), 0) FROM doctors.partner_points pp
      WHERE pp.partner_id = dr.id
    )
  ) ORDER BY dr.created_at DESC), '[]'::jsonb) INTO v_stores
  FROM doctors.doctor_registrations dr
  WHERE dr.main_store_id = v_main_store.id;

  RETURN jsonb_build_object(
    'total_orders', v_total_orders,
    'orders', v_orders,
    'stores', v_stores
  );
END;
$$;

CREATE OR REPLACE FUNCTION sandbox.get_main_store_reports(
  p_scope text default 'all',
  p_store_id uuid default null,
  p_status text default null,
  p_limit integer default 25,
  p_offset integer default 0,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null,
  p_sort text default 'newest'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = sandbox, doctors, public
AS $$
DECLARE
  v_email text;
  v_main_store doctors.doctor_registrations%ROWTYPE;
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_total_orders bigint;
  v_orders jsonb;
  v_stores jsonb;
BEGIN
  v_email := nullif(lower(trim(coalesce(auth.jwt() ->> 'email', ''))), '');
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Sign in to view Main Store reports.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_main_store
  FROM doctors.doctor_registrations
  WHERE email = v_email AND store_type = 'main'
  LIMIT 1;

  IF v_main_store.id IS NULL THEN
    RAISE EXCEPTION 'This account is not a GutGuard Main Store.' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_total_orders
  FROM sandbox.shop_orders o
  JOIN doctors.doctor_registrations dr ON o.referral_doctor_id = dr.id
  WHERE (dr.main_store_id = v_main_store.id OR dr.id = v_main_store.id)
    AND (p_store_id IS NULL OR dr.id = p_store_id)
    AND sandbox.partner_order_matches_status(o.payment_status, o.status, p_status)
    AND (p_date_from IS NULL OR o.created_at >= p_date_from)
    AND (p_date_to IS NULL OR o.created_at < p_date_to + interval '1 day');

  SELECT coalesce(jsonb_agg(entry order by
    case when lower(coalesce(p_sort, 'newest')) = 'oldest' then sort_at end asc,
    case when lower(coalesce(p_sort, 'newest')) = 'newest' then sort_at end desc
  ), '[]'::jsonb) INTO v_orders
  FROM (
    SELECT o.created_at as sort_at, jsonb_build_object(
      'order_code', o.order_code,
      'created_at', o.created_at,
      'status', o.status,
      'payment_status', o.payment_status,
      'payment_method', o.payment_method,
      'maya_reference', o.maya_reference,
      'maya_payment_status', o.maya_payment_status,
      'maya_fund_source', o.maya_fund_source,
      'paid_at', o.paid_at,
      'total_amount', coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0)),
      'subtotal', coalesce(o.subtotal, 0),
      'shipping_fee', coalesce(o.shipping_fee, 0),
      'shipping_region', o.shipping_region,
      'buyer_name', coalesce(nullif(trim(o.customer_name), ''), trim(coalesce(o.first_name, '') || ' ' || coalesce(o.last_name, ''))),
      'email', coalesce(o.email, ''),
      'mobile', coalesce(o.mobile, ''),
      'address', coalesce(o.address, ''),
      'city', coalesce(o.city, ''),
      'province', coalesce(o.province, ''),
      'barangay', coalesce(o.barangay, ''),
      'zip', coalesce(o.zip, ''),
      'items', coalesce(o.items, '[]'::jsonb),
      'store_id', dr.id,
      'store_name', dr.full_name,
      'store_type', dr.store_type,
      'store_slug', dr.routing_slug
    ) AS entry
    FROM sandbox.shop_orders o
    JOIN doctors.doctor_registrations dr ON o.referral_doctor_id = dr.id
    WHERE (dr.main_store_id = v_main_store.id OR dr.id = v_main_store.id)
      AND (p_store_id IS NULL OR dr.id = p_store_id)
      AND sandbox.partner_order_matches_status(o.payment_status, o.status, p_status)
      AND (p_date_from IS NULL OR o.created_at >= p_date_from)
      AND (p_date_to IS NULL OR o.created_at < p_date_to + interval '1 day')
    ORDER BY
      case when lower(coalesce(p_sort, 'newest')) = 'oldest' then o.created_at end asc,
      case when lower(coalesce(p_sort, 'newest')) = 'newest' then o.created_at end desc
    LIMIT v_limit OFFSET v_offset
  ) sub;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', dr.id,
    'full_name', dr.full_name,
    'store_type', dr.store_type,
    'routing_slug', dr.routing_slug,
    'specialty', dr.specialty,
    'practice_location', dr.practice_location,
    'created_at', dr.created_at,
    'referral_qr_enabled', dr.referral_qr_enabled,
    'orders_count', (
      SELECT count(*) FROM sandbox.shop_orders so
      WHERE so.referral_doctor_id = dr.id AND so.payment_status = 'paid'
    ),
    'revenue', (
      SELECT coalesce(sum(so.total_amount), 0) FROM sandbox.shop_orders so
      WHERE so.referral_doctor_id = dr.id AND so.payment_status = 'paid'
    ),
    'points', (
      SELECT coalesce(sum(points), 0) FROM sandbox.partner_points pp
      WHERE pp.partner_id = dr.id
    )
  ) ORDER BY dr.created_at DESC), '[]'::jsonb) INTO v_stores
  FROM doctors.doctor_registrations dr
  WHERE dr.main_store_id = v_main_store.id;

  RETURN jsonb_build_object(
    'total_orders', v_total_orders,
    'orders', v_orders,
    'stores', v_stores
  );
END;
$$;

-- An older 7-arg sandbox.get_main_store_reports is still live next to the 8-arg one; with both
-- present PostgREST cannot pick a candidate for a call that passes only shared parameters.
DROP FUNCTION IF EXISTS sandbox.get_main_store_reports(uuid, uuid, text, timestamptz, timestamptz, integer, integer);

-- Dashboards need a signed-in partner (they read auth.jwt() email); anon has no use for them.
DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'doctors.partner_dashboard(text, text, integer, integer, timestamptz, timestamptz, text)'::regprocedure,
    'sandbox.partner_dashboard(text, text, integer, integer, timestamptz, timestamptz, text)'::regprocedure,
    'doctors.get_main_store_dashboard()'::regprocedure,
    'sandbox.get_main_store_dashboard()'::regprocedure,
    'doctors.get_main_store_reports(text, uuid, text, integer, integer, timestamptz, timestamptz, text)'::regprocedure,
    'sandbox.get_main_store_reports(text, uuid, text, integer, integer, timestamptz, timestamptz, text)'::regprocedure
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', fn);
  END LOOP;
END $$;

-- 3. Points. Same rule as before; the triggers now (a) never fail the payment that fires them,
--    (b) take points back when a paid order is refunded or fails, and (c) in `sandbox`, no
--    longer promote production partners from QA payments.
CREATE OR REPLACE FUNCTION doctors.award_order_points() RETURNS trigger
LANGUAGE plpgsql
SET search_path = doctors, doctors, public
AS $$
DECLARE
  v_points integer;
  v_partner doctors.doctor_registrations%ROWTYPE;
BEGIN
  -- 1 point per PHP 1,000 of the order total, minimum 1 (unchanged rule).
  v_points := greatest(floor(coalesce(NEW.total_amount, 0) / 1000)::integer, 1);

  IF NEW.referral_doctor_id IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT * INTO v_partner FROM doctors.doctor_registrations WHERE id = NEW.referral_doctor_id;
    IF v_partner.id IS NULL THEN
      RETURN NEW;
    END IF;

    INSERT INTO doctors.partner_points (order_id, partner_id, points, depth)
    VALUES (NEW.id, v_partner.id, v_points, 0)
    ON CONFLICT (order_id, partner_id) DO NOTHING;

    IF v_partner.referred_by_partner_id IS NOT NULL THEN
      INSERT INTO doctors.partner_points (order_id, partner_id, points, depth)
      VALUES (NEW.id, v_partner.referred_by_partner_id, v_points, 1)
      ON CONFLICT (order_id, partner_id) DO NOTHING;
    END IF;

    -- First paid sale promotes an affiliate. The store_type guard in the WHERE makes two
    -- concurrent first sales produce one promotion, not two audit rows.
    UPDATE doctors.doctor_registrations
    SET store_type = 'lifestyle', referral_qr_enabled = true, promoted_at = now(), promoted_by = 'auto'
    WHERE id = v_partner.id AND store_type = 'affiliate';
    IF FOUND THEN
      INSERT INTO doctors.store_promotions (partner_id, from_type, to_type, trigger_type, trigger_order_id)
      VALUES (v_partner.id, 'affiliate', 'lifestyle', 'first_sale', NEW.id);
    END IF;

  EXCEPTION WHEN OTHERS THEN
    -- This runs inside the payment UPDATE. A points failure must not roll the payment back
    -- (the webhook would 500 forever and the buyer would be asked to pay again). Points can be
    -- re-awarded later: the insert is idempotent on (order_id, partner_id).
    RAISE WARNING 'doctors.award_order_points skipped order %: % (%)', NEW.id, SQLERRM, SQLSTATE;
  END;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION sandbox.award_order_points() RETURNS trigger
LANGUAGE plpgsql
SET search_path = sandbox, doctors, public
AS $$
DECLARE
  v_points integer;
  v_partner doctors.doctor_registrations%ROWTYPE;
BEGIN
  -- 1 point per PHP 1,000 of the order total, minimum 1 (unchanged rule).
  v_points := greatest(floor(coalesce(NEW.total_amount, 0) / 1000)::integer, 1);

  IF NEW.referral_doctor_id IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT * INTO v_partner FROM doctors.doctor_registrations WHERE id = NEW.referral_doctor_id;
    IF v_partner.id IS NULL THEN
      RETURN NEW;
    END IF;

    INSERT INTO sandbox.partner_points (order_id, partner_id, points, depth)
    VALUES (NEW.id, v_partner.id, v_points, 0)
    ON CONFLICT (order_id, partner_id) DO NOTHING;

    IF v_partner.referred_by_partner_id IS NOT NULL THEN
      INSERT INTO sandbox.partner_points (order_id, partner_id, points, depth)
      VALUES (NEW.id, v_partner.referred_by_partner_id, v_points, 1)
      ON CONFLICT (order_id, partner_id) DO NOTHING;
    END IF;

    -- Partners are shared with production (there is no sandbox.doctor_registrations), so a QA
    -- payment must not promote a real partner. Auto-promotion runs from doctors.award_order_points only.

  EXCEPTION WHEN OTHERS THEN
    -- This runs inside the payment UPDATE. A points failure must not roll the payment back
    -- (the webhook would 500 forever and the buyer would be asked to pay again). Points can be
    -- re-awarded later: the insert is idempotent on (order_id, partner_id).
    RAISE WARNING 'sandbox.award_order_points skipped order %: % (%)', NEW.id, SQLERRM, SQLSTATE;
  END;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION doctors.revoke_order_points() RETURNS trigger
LANGUAGE plpgsql
SET search_path = doctors, public
AS $$
BEGIN
  -- Refunded / failed after being paid: take the points back from the partner and the upline.
  -- If the order is paid again, trigger_award_points re-awards them.
  DELETE FROM doctors.partner_points WHERE order_id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_revoke_points ON doctors.shop_orders;
CREATE TRIGGER trigger_revoke_points
  AFTER UPDATE OF payment_status ON doctors.shop_orders
  FOR EACH ROW
  WHEN (OLD.payment_status = 'paid' AND NEW.payment_status IS DISTINCT FROM 'paid')
  EXECUTE FUNCTION doctors.revoke_order_points();

CREATE OR REPLACE FUNCTION sandbox.revoke_order_points() RETURNS trigger
LANGUAGE plpgsql
SET search_path = sandbox, public
AS $$
BEGIN
  -- Refunded / failed after being paid: take the points back from the partner and the upline.
  -- If the order is paid again, trigger_award_points re-awards them.
  DELETE FROM sandbox.partner_points WHERE order_id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_revoke_points ON sandbox.shop_orders;
CREATE TRIGGER trigger_revoke_points
  AFTER UPDATE OF payment_status ON sandbox.shop_orders
  FOR EACH ROW
  WHEN (OLD.payment_status = 'paid' AND NEW.payment_status IS DISTINCT FROM 'paid')
  EXECUTE FUNCTION sandbox.revoke_order_points();

-- 4. Upgrade to Main Store. The referrer-immutability trigger (20260818000000) rejected the
--    breakaway's `referred_by_partner_id = NULL`, so only partners without a referrer could be
--    upgraded. The upgrade now opts out for its own transaction only.
CREATE OR REPLACE FUNCTION doctors.prevent_partner_referrer_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = doctors, public
AS $$
BEGIN
  IF new.referred_by_partner_id IS DISTINCT FROM old.referred_by_partner_id
     AND coalesce(current_setting('doctors.allow_referrer_change', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Partner referral attribution cannot be changed.' USING ERRCODE = '23514';
  END IF;
  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION doctors.admin_upgrade_to_main_store(
  p_admin_password text,
  p_partner_id uuid,
  p_note text default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = doctors, public
AS $$
DECLARE
  v_partner doctors.doctor_registrations%ROWTYPE;
  v_old_main_store_id uuid;
  v_descendants_moved integer := 0;
BEGIN
  PERFORM doctors.assert_wheel_admin(p_admin_password);

  SELECT * INTO v_partner
  FROM doctors.doctor_registrations
  WHERE id = p_partner_id
  FOR UPDATE;

  IF v_partner.id IS NULL THEN
    RAISE EXCEPTION 'Partner not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_partner.store_type != 'lifestyle' THEN
    RAISE EXCEPTION 'Can only upgrade a Lifestyle Store to Main Store. Current type is %', v_partner.store_type USING ERRCODE = '22023';
  END IF;

  v_old_main_store_id := v_partner.main_store_id;

  -- 1. Upgrade partner to Main Store & sever upline referral link (breakaway)
  PERFORM set_config('doctors.allow_referrer_change', 'on', true);
  UPDATE doctors.doctor_registrations
  SET store_type = 'main',
      main_store_id = NULL,
      referred_by_partner_id = NULL,
      referral_qr_enabled = true,
      promoted_at = now(),
      promoted_by = 'admin'
  WHERE id = p_partner_id;
  PERFORM set_config('doctors.allow_referrer_change', '', true);

  -- 2. Re-parent the referral subtree to the new Main Store. A descendant that is itself a
  --    Main Store keeps its own subtree (and must keep main_store_id NULL); UNION stops cycles.
  WITH RECURSIVE descendant_tree AS (
    SELECT id FROM doctors.doctor_registrations
    WHERE referred_by_partner_id = p_partner_id AND store_type <> 'main'

    UNION

    SELECT dr.id
    FROM doctors.doctor_registrations dr
    INNER JOIN descendant_tree dt ON dr.referred_by_partner_id = dt.id
    WHERE dr.store_type <> 'main'
  )
  UPDATE doctors.doctor_registrations
  SET main_store_id = p_partner_id
  WHERE id IN (SELECT id FROM descendant_tree);

  GET DIAGNOSTICS v_descendants_moved = ROW_COUNT;

  -- 3. Audit log
  INSERT INTO doctors.store_promotions (
    partner_id, from_type, to_type, trigger_type, trigger_admin_note
  ) VALUES (
    p_partner_id, 'lifestyle', 'main', 'admin_upgrade_main',
    COALESCE(p_note, '') || ' | Broke away from main_store_id=' || COALESCE(v_old_main_store_id::text, 'NULL')
    || ' | Transferred ' || v_descendants_moved || ' descendant stores'
  );

  RETURN jsonb_build_object(
    'success', true,
    'partner_id', p_partner_id,
    'old_main_store_id', v_old_main_store_id,
    'descendants_moved', v_descendants_moved
  );
END;
$$;

REVOKE ALL ON FUNCTION doctors.admin_upgrade_to_main_store(text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION doctors.admin_upgrade_to_main_store(text, uuid, text) TO service_role;

-- 5. Points / rebate / promotion tables are written only by triggers and SECURITY DEFINER
--    functions. RLS with no policies keeps anon and authenticated out (prod already has this;
--    the repo migrations never enabled it).
ALTER TABLE doctors.partner_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors.milestone_unlocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors.store_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sandbox.partner_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE sandbox.milestone_unlocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sandbox.store_promotions ENABLE ROW LEVEL SECURITY;
