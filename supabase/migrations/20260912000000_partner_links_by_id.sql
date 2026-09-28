-- Partner links keyed by id instead of name.
--
-- QR links used to embed the routing slug, which is built from the partner's full name,
-- so every printed code and every visited URL published who the partner was. New links
-- carry the partner id; partner_by_key still resolves the old slugs, because printed
-- codes and 30-day referral cookies are already in circulation.
--
-- partner_dashboard now returns the partner id so the portal can build its own links.
-- The sandbox mirror is updated by re-running supabase/shop-orders-sandbox.sql.
--
-- Schema note: production keeps these objects in `doctors`. The canonical scripts in
-- supabase/*.sql are written against `public` for a fresh install - same code, and the
-- migrations have targeted `doctors` since 20260818.

-- One lookup for every public partner link: /r/<key>, /dr/<key> and ?ref=<key> all accept
-- either the partner id or the older routing slug. New QR codes carry the id so a partner's
-- name is not printed in the URL; slugs stay valid because printed codes are already out.
-- Never grant this to anon/authenticated: it returns the whole row, contact details included.
-- ponytail: sequential scan over a table of partners. Add an index if that ever matters.
create or replace function doctors.partner_by_key(p_key text)
returns setof doctors.doctor_registrations
language sql
stable
security definer
set search_path = doctors, public
as $$
  select d.*
  from doctors.doctor_registrations d
  where nullif(lower(trim(coalesce(p_key, ''))), '') is not null
    and (d.routing_slug = lower(trim(p_key)) or d.id::text = lower(trim(p_key)))
  limit 1;
$$;

revoke all on function doctors.partner_by_key(text) from public, anon, authenticated;

drop function if exists doctors.get_doctor_redirect(text);

create or replace function doctors.get_doctor_redirect(p_routing_slug text)
returns text
language sql
stable
security definer
set search_path = doctors, public
as $$
  select redirect_url from doctors.partner_by_key(p_routing_slug);
$$;

grant execute on function doctors.get_doctor_redirect(text) to anon, authenticated;

drop function if exists doctors.get_partner_invitation(text);

create or replace function doctors.get_partner_invitation(p_slug text)
returns table (routing_slug text, full_name text)
language sql
stable
security definer
set search_path = doctors, public
as $$
  select d.routing_slug, d.full_name from doctors.partner_by_key(p_slug) d;
$$;

grant execute on function doctors.get_partner_invitation(text) to anon, authenticated;

drop function if exists doctors.track_referral_click(text);

create or replace function doctors.track_referral_click(p_slug text)
returns text
language plpgsql
security definer
set search_path = doctors, public
as $$
declare
  v_slug text;
  v_doctor_id uuid;
begin
  -- p_slug is the partner id on new QR codes and the routing slug on older printed ones.
  select d.routing_slug, d.id into v_slug, v_doctor_id
  from doctors.partner_by_key(p_slug) d;

  -- Unknown slug: no row, no click. Counting misses would let anyone inflate a partner's
  -- numbers by hitting /r/<anything>.
  if v_slug is null then
    return null;
  end if;

  insert into doctors.referral_clicks (routing_slug, doctor_id) values (v_slug, v_doctor_id);

  return v_slug;
end;
$$;

grant execute on function doctors.track_referral_click(text) to anon, authenticated;

drop function if exists doctors.partner_dashboard(text, text, integer, integer, timestamptz, timestamptz, text);

create or replace function doctors.partner_dashboard(
  p_scope text default 'all',
  p_status text default null,
  p_limit integer default 25,
  p_offset integer default 0,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null,
  p_sort text default 'newest'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = doctors, public
as $$
declare
  v_email text;
  v_doctor doctors.doctor_registrations;
  v_scope text := lower(trim(coalesce(p_scope, 'all')));
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_order_count bigint;
  v_orders jsonb;
begin
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

  -- Anyone can create an auth account, so this is the actual access gate, not the sign-in.
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
    -- paid_amount is gross order value, NOT commission. Commission is a separate,
    -- deliberately unbuilt calculation - do not surface this as "earnings".
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
end;
$$;

-- authenticated only, and the revoke is NOT redundant: Postgres grants EXECUTE to PUBLIC on
-- every new function, and Supabase's default privileges in `public` add anon on top. The
-- grant on its own leaves this callable with the anon key. The body would still refuse
-- (no JWT email), but an unauthenticated caller should not reach it at all.
revoke all on function doctors.partner_dashboard(text, text, integer, integer, timestamptz, timestamptz, text) from public, anon;
grant execute on function doctors.partner_dashboard(text, text, integer, integer, timestamptz, timestamptz, text) to authenticated;

-- The sandbox mirror shares the real partner table, so it must resolve keys the same way.
-- Guarded because the sandbox schema only exists where the mirrored shop is deployed.
do $mirror$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'sandbox') then
    execute $fn$
      create or replace function sandbox.track_referral_click(p_slug text)
      returns text
      language plpgsql
      security definer
      set search_path = sandbox, doctors, public
      as $$
      declare
        v_slug text;
        v_doctor_id uuid;
      begin
        select d.routing_slug, d.id into v_slug, v_doctor_id
        from doctors.partner_by_key(p_slug) d;

        if v_slug is null then
          return null;
        end if;

        insert into sandbox.referral_clicks (routing_slug, doctor_id) values (v_slug, v_doctor_id);

        return v_slug;
      end;
      $$;
    $fn$;

    execute 'grant execute on function sandbox.track_referral_click(text) to anon, authenticated';
  end if;
end
$mirror$;
