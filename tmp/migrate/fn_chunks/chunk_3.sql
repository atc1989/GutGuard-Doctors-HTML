CREATE OR REPLACE FUNCTION doctors.partner_dashboard(p_scope text DEFAULT 'all'::text, p_status text DEFAULT NULL::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0, p_date_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_date_to timestamp with time zone DEFAULT NULL::timestamp with time zone, p_sort text DEFAULT 'newest'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
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
  if lower(coalesce(p_sort, 'newest')) not in ('newest', 'oldest') then raise exception 'Invalid order sort.' using errcode = '22023'; end if;

  v_email := nullif(lower(trim(coalesce(auth.jwt() ->> 'email', ''))), '');
  if v_email is null then
    raise exception 'Sign in to view your dashboard.' using errcode = '42501';
  end if;
  select * into v_doctor from doctors.doctor_registrations where email = v_email limit 1;
  if v_doctor.id is null then
    raise exception 'This email is not registered as a GutGuard partner.' using errcode = '42501';
  end if;

  select count(*) into v_order_count
  from doctors.shop_orders o
  join doctors.doctor_registrations source on source.id = o.referral_doctor_id
  where (source.id = v_doctor.id or source.referred_by_partner_id = v_doctor.id)
    and (v_scope = 'all' or (v_scope = 'direct' and source.id = v_doctor.id)
      or (v_scope = 'referred' and source.referred_by_partner_id = v_doctor.id))
    and (nullif(lower(trim(coalesce(p_status, ''))), '') is null
      or lower(o.payment_status) = lower(trim(p_status))
      or lower(o.status) = lower(trim(p_status)))
    and (p_date_from is null or o.created_at >= p_date_from)
    and (p_date_to is null or o.created_at < p_date_to + interval '1 day');

  select coalesce(jsonb_agg(entry order by
    case when lower(coalesce(p_sort,'newest'))='oldest' then sort_at end asc,
    case when lower(coalesce(p_sort,'newest'))='newest' then sort_at end desc), '[]'::jsonb) into v_orders
  from (
    select o.created_at sort_at, jsonb_build_object(
      'order_code', o.order_code, 'created_at', o.created_at, 'status', o.status,
      'payment_status', o.payment_status,
      'total_amount', coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0)),
      'buyer_first_name', coalesce(o.first_name, split_part(o.customer_name, ' ', 1)),
      'city', o.city, 'province', o.province,
      'source_type', case when source.id = v_doctor.id then 'direct' else 'referred' end,
      'source_partner_name', source.full_name,
      'source_partner_slug', source.routing_slug
    ) entry
    from doctors.shop_orders o
    join doctors.doctor_registrations source on source.id = o.referral_doctor_id
    where (source.id = v_doctor.id or source.referred_by_partner_id = v_doctor.id)
      and (v_scope = 'all' or (v_scope = 'direct' and source.id = v_doctor.id)
        or (v_scope = 'referred' and source.referred_by_partner_id = v_doctor.id))
      and (nullif(lower(trim(coalesce(p_status, ''))), '') is null
        or lower(o.payment_status) = lower(trim(p_status))
        or lower(o.status) = lower(trim(p_status)))
      and (p_date_from is null or o.created_at >= p_date_from)
      and (p_date_to is null or o.created_at < p_date_to + interval '1 day')
    order by case when lower(coalesce(p_sort,'newest'))='oldest' then o.created_at end asc,
      case when lower(coalesce(p_sort,'newest'))='newest' then o.created_at end desc
    limit v_limit offset v_offset
  ) page;

  return jsonb_build_object(
    'partner', jsonb_build_object('full_name', v_doctor.full_name,
      'routing_slug', v_doctor.routing_slug, 'joined_at', v_doctor.created_at),
    'clicks', jsonb_build_object(
      'total', (select count(*) from doctors.referral_clicks c where c.doctor_id = v_doctor.id),
      'last_30_days', (select count(*) from doctors.referral_clicks c where c.doctor_id = v_doctor.id
        and c.created_at >= now() - interval '30 days')),
    'totals', (
      select jsonb_build_object(
        'direct_orders', count(*) filter (where source.id = v_doctor.id),
        'referred_orders', count(*) filter (where source.referred_by_partner_id = v_doctor.id),
        'orders', count(*),
        'paid_orders', count(*) filter (where o.payment_status = 'paid'),
        'direct_paid_amount', coalesce(sum(coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0)))
          filter (where o.payment_status = 'paid' and source.id = v_doctor.id), 0),
        'referred_paid_amount', coalesce(sum(coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0)))
          filter (where o.payment_status = 'paid' and source.referred_by_partner_id = v_doctor.id), 0),
        'paid_amount', coalesce(sum(coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0)))
          filter (where o.payment_status = 'paid'), 0),
        'referred_partners', (select count(*) from doctors.doctor_registrations d
          where d.referred_by_partner_id = v_doctor.id)
      )
      from doctors.shop_orders o join doctors.doctor_registrations source on source.id = o.referral_doctor_id
      where source.id = v_doctor.id or source.referred_by_partner_id = v_doctor.id
    ),
    'orders', v_orders,
    'orders_page', jsonb_build_object('total', v_order_count, 'limit', v_limit,
      'offset', v_offset, 'has_more', v_offset + jsonb_array_length(v_orders) < v_order_count),
    'referred_partners', (
      select coalesce(jsonb_agg(entry order by joined_at desc), '[]'::jsonb)
      from (
        select child.created_at joined_at, jsonb_build_object(
          'full_name', child.full_name, 'routing_slug', child.routing_slug,
          'specialty', child.specialty, 'practice_location', child.practice_location,
          'joined_at', child.created_at, 'orders', count(o.id),
          'paid_order_value', coalesce(sum(coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0)))
            filter (where o.payment_status = 'paid'), 0)
        ) entry
        from doctors.doctor_registrations child
        left join doctors.shop_orders o on o.referral_doctor_id = child.id
        where child.referred_by_partner_id = v_doctor.id
        group by child.id order by child.created_at desc
      ) partners
    )
  );
end;
$function$


CREATE OR REPLACE FUNCTION doctors.prevent_partner_referrer_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'doctors', 'public'
AS $function$
begin
  if new.referred_by_partner_id is distinct from old.referred_by_partner_id then
    raise exception 'Partner referral attribution cannot be changed.' using errcode = '23514';
  end if;
  return new;
end;
$function$


CREATE OR REPLACE FUNCTION doctors.register_doctor(p_full_name text, p_email text, p_mobile text, p_tiktok_username text, p_specialty text, p_practice_location text, p_referrer_slug text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
declare
  v_doctor_id uuid;
  v_referrer_id uuid;
  v_tiktok_username text;
begin
  v_tiktok_username := regexp_replace(lower(trim(coalesce(p_tiktok_username, ''))), '^@+', '');
  if nullif(lower(trim(coalesce(p_referrer_slug, ''))), '') is not null then
    select d.id into v_referrer_id from doctors.doctor_registrations d
    where d.routing_slug = lower(trim(p_referrer_slug)) limit 1;
  end if;

  insert into doctors.doctor_registrations (
    full_name, email, mobile, tiktok_username, specialty, practice_location,
    routing_slug, redirect_url, referred_by_partner_id
  ) values (
    trim(p_full_name), coalesce(nullif(lower(trim(coalesce(p_email, ''))), ''), ''),
    trim(p_mobile), v_tiktok_username, trim(p_specialty), trim(p_practice_location),
    doctors.make_unique_doctor_slug(p_full_name),
    case when v_tiktok_username = '' then null else 'https://www.tiktok.com/@' || v_tiktok_username end,
    v_referrer_id
  ) returning id into v_doctor_id;

  if v_referrer_id = v_doctor_id then
    raise exception 'A partner cannot refer themselves.' using errcode = '23514';
  end if;
  return v_doctor_id;
end;
$function$


CREATE OR REPLACE FUNCTION doctors.slugify_doctor_route(input text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select trim(
    both '-' from regexp_replace(
      regexp_replace(lower(coalesce(input, 'doctor')), '[^a-z0-9]+', '-', 'g'),
      '-+',
      '-',
      'g'
    )
  );
$function$


CREATE OR REPLACE FUNCTION doctors.touch_shop_order_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$


CREATE OR REPLACE FUNCTION doctors.touch_tiktok_credentials_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$


CREATE OR REPLACE FUNCTION doctors.touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$


CREATE OR REPLACE FUNCTION doctors.track_referral_click(p_slug text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
declare
  v_slug text;
  v_doctor_id uuid;
begin
  select d.routing_slug, d.id into v_slug, v_doctor_id
  from doctors.doctor_registrations d
  where d.routing_slug = lower(trim(coalesce(p_slug, '')))
  limit 1;

  -- Unknown slug: no row, no click. Counting misses would let anyone inflate a partner's
  -- numbers by hitting /r/<anything>.
  if v_slug is null then
    return null;
  end if;

  insert into doctors.referral_clicks (routing_slug, doctor_id) values (v_slug, v_doctor_id);

  return v_slug;
end;
$function$


CREATE OR REPLACE FUNCTION doctors.update_doctor_task(p_doctor_id uuid, p_task text, p_value boolean DEFAULT true)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
begin
  if p_task not in ('email', 'facebook', 'tiktok', 'reel') then
    raise exception 'Invalid task: %', p_task;
  end if;

  update doctors.doctor_registrations
  set
    task_email_received = case when p_task = 'email' then p_value else task_email_received end,
    task_facebook_followed = case when p_task = 'facebook' then p_value else task_facebook_followed end,
    task_tiktok_followed = case when p_task = 'tiktok' then p_value else task_tiktok_followed end,
    task_reel_created = case when p_task = 'reel' then p_value else task_reel_created end
  where id = p_doctor_id;

  if not found then
    raise exception 'Doctor registration not found';
  end if;
end;
$function$


CREATE OR REPLACE FUNCTION sandbox.admin_get_shop_order(p_admin_password text, p_order_id uuid)
 RETURNS SETOF sandbox.shop_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sandbox', 'doctors', 'public'
AS $function$
begin
  perform doctors.assert_wheel_admin(p_admin_password);

  return query select * from sandbox.admin_get_shop_order_unchecked(p_order_id);
end;
$function$


CREATE OR REPLACE FUNCTION sandbox.admin_get_shop_order_unchecked(p_order_id uuid)
 RETURNS SETOF sandbox.shop_orders
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'sandbox', 'doctors', 'public'
AS $function$
  select * from sandbox.shop_orders where id = p_order_id limit 1;
$function$


