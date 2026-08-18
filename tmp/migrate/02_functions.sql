CREATE OR REPLACE FUNCTION doctors.admin_get_shop_order(p_admin_password text, p_order_id uuid)
 RETURNS SETOF doctors.shop_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
begin
  perform doctors.assert_wheel_admin(p_admin_password);

  return query select * from doctors.admin_get_shop_order_unchecked(p_order_id);
end;
$function$


CREATE OR REPLACE FUNCTION doctors.admin_get_shop_order_unchecked(p_order_id uuid)
 RETURNS SETOF doctors.shop_orders
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
  select * from doctors.shop_orders where id = p_order_id limit 1;
$function$


CREATE OR REPLACE FUNCTION doctors.admin_list_doctor_registrations(p_admin_password text)
 RETURNS TABLE(id uuid, full_name text, email text, mobile text, tiktok_username text, routing_slug text, redirect_url text, specialty text, practice_location text, created_at timestamp with time zone, prize_label text, prize_claimed_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
begin
  perform doctors.assert_wheel_admin(p_admin_password);

  return query
  select
    doctor_registrations.id,
    doctor_registrations.full_name::text,
    doctor_registrations.email::text,
    doctor_registrations.mobile::text,
    doctor_registrations.tiktok_username::text,
    doctor_registrations.routing_slug::text,
    coalesce(doctor_registrations.redirect_url, '')::text,
    doctor_registrations.specialty::text,
    doctor_registrations.practice_location::text,
    doctor_registrations.created_at,
    null::text as prize_label,
    null::timestamptz as prize_claimed_at
  from doctors.doctor_registrations
  order by doctor_registrations.created_at desc;
end;
$function$


CREATE OR REPLACE FUNCTION doctors.admin_list_newsletter_sends(p_admin_password text)
 RETURNS TABLE(id uuid, doctor_id uuid, newsletter_id uuid, newsletter_title text, email text, subject text, status text, resend_id text, error_message text, sent_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
begin
  perform doctors.assert_wheel_admin(p_admin_password);

  return query
  select
    ns.id,
    ns.doctor_id,
    ns.newsletter_id,
    nc.title as newsletter_title,
    ns.email,
    ns.subject,
    ns.status,
    ns.resend_id,
    ns.error_message,
    ns.sent_at
  from doctors.newsletter_sends ns
  left join doctors.newsletter_campaigns nc on nc.id = ns.newsletter_id
  order by ns.sent_at desc;
end;
$function$


CREATE OR REPLACE FUNCTION doctors.admin_list_shop_orders(p_admin_password text)
 RETURNS SETOF doctors.shop_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
begin
  perform doctors.assert_wheel_admin(p_admin_password);

  return query
  select * from doctors.shop_orders order by created_at desc;
end;
$function$


CREATE OR REPLACE FUNCTION doctors.admin_list_sms_sends(p_admin_password text)
 RETURNS TABLE(id uuid, doctor_id uuid, sms_campaign_id uuid, sms_campaign_title text, mobile text, message text, status text, provider_message_id text, error_message text, sent_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
begin
  perform doctors.assert_wheel_admin(p_admin_password);

  return query
  select
    sms_sends.id,
    sms_sends.doctor_id,
    sms_sends.sms_campaign_id,
    sms_campaigns.title,
    sms_sends.mobile,
    sms_sends.message,
    sms_sends.status,
    sms_sends.provider_message_id,
    sms_sends.error_message,
    sms_sends.sent_at
  from doctors.sms_sends
  left join doctors.sms_campaigns on sms_campaigns.id = sms_sends.sms_campaign_id
  order by sms_sends.sent_at desc;
end;
$function$


CREATE OR REPLACE FUNCTION doctors.admin_list_wheel_prizes(p_admin_password text)
 RETURNS TABLE(id uuid, label text, note text, color text, text_color text, chance_weight integer, total_stock integer, remaining_stock integer, is_active boolean, sort_order integer, claim_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
begin
  perform doctors.assert_wheel_admin(p_admin_password);

  return query
  select
    p.id, p.label, p.note, p.color, p.text_color,
    p.chance_weight, p.total_stock, p.remaining_stock,
    p.is_active, p.sort_order,
    coalesce(c.claim_count, 0) as claim_count
  from doctors.wheel_prizes p
  left join (
    select prize_id, count(*) as claim_count
    from doctors.wheel_claims
    group by prize_id
  ) c on c.prize_id = p.id
  order by p.sort_order, p.created_at;
end;
$function$


CREATE OR REPLACE FUNCTION doctors.admin_update_doctor_registration(p_admin_password text, p_doctor_id uuid, p_full_name text, p_email text, p_mobile text, p_tiktok_username text, p_specialty text, p_practice_location text, p_redirect_url text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, full_name text, email text, mobile text, tiktok_username text, routing_slug text, redirect_url text, specialty text, practice_location text, created_at timestamp with time zone, prize_label text, prize_claimed_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
begin
  perform doctors.assert_wheel_admin(p_admin_password);

  update doctors.doctor_registrations
  set
    full_name = trim(p_full_name),
    email = nullif(lower(trim(coalesce(p_email, ''))), ''),
    mobile = trim(p_mobile),
    tiktok_username = regexp_replace(lower(trim(coalesce(p_tiktok_username, ''))), '^@+', ''),
    redirect_url = nullif(trim(coalesce(p_redirect_url, '')), ''),
    specialty = trim(p_specialty),
    practice_location = trim(p_practice_location)
  where doctor_registrations.id = p_doctor_id;

  return query
  select *
  from doctors.admin_list_doctor_registrations(p_admin_password) registrations
  where registrations.id = p_doctor_id;
end;
$function$


CREATE OR REPLACE FUNCTION doctors.admin_update_shop_order(p_admin_password text, p_order_id uuid, p_status text, p_payment_status text, p_maya_reference text DEFAULT NULL::text, p_admin_notes text DEFAULT NULL::text)
 RETURNS SETOF doctors.shop_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
begin
  perform doctors.assert_wheel_admin(p_admin_password);

  update doctors.shop_orders
  set
    status = p_status,
    payment_status = p_payment_status,
    maya_reference = nullif(trim(coalesce(p_maya_reference, '')), ''),
    admin_notes = nullif(trim(coalesce(p_admin_notes, '')), ''),
    paid_at = case when p_payment_status = 'paid' then coalesce(paid_at, now()) else paid_at end
  where shop_orders.id = p_order_id;

  return query select * from doctors.admin_get_shop_order_unchecked(p_order_id);
end;
$function$


CREATE OR REPLACE FUNCTION doctors.admin_upsert_wheel_prize(p_admin_password text, p_id uuid, p_label text, p_note text, p_color text, p_text_color text, p_chance_weight integer, p_total_stock integer, p_remaining_stock integer, p_is_active boolean, p_sort_order integer)
 RETURNS TABLE(id uuid, label text, note text, color text, text_color text, chance_weight integer, total_stock integer, remaining_stock integer, is_active boolean, sort_order integer, claim_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
declare
  v_id uuid;
begin
  perform doctors.assert_wheel_admin(p_admin_password);

  if p_id is null then
    insert into doctors.wheel_prizes
      (label, note, color, text_color, chance_weight, total_stock, remaining_stock, is_active, sort_order)
    values
      (p_label, p_note, p_color, p_text_color, p_chance_weight, p_total_stock, p_remaining_stock, p_is_active, p_sort_order)
    returning wheel_prizes.id into v_id;
  else
    update doctors.wheel_prizes
    set label = p_label,
        note = p_note,
        color = p_color,
        text_color = p_text_color,
        chance_weight = p_chance_weight,
        total_stock = p_total_stock,
        remaining_stock = p_remaining_stock,
        is_active = p_is_active,
        sort_order = p_sort_order,
        updated_at = now()
    where wheel_prizes.id = p_id
    returning wheel_prizes.id into v_id;
  end if;

  return query
  select *
  from doctors.admin_list_wheel_prizes(p_admin_password) p
  where p.id = v_id;
end;
$function$


CREATE OR REPLACE FUNCTION doctors.assert_wheel_admin(p_admin_password text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
begin
  if not exists (
    select 1
    from doctors.wheel_admin_settings
    where id = true
      and admin_password = p_admin_password
  ) then
    raise exception 'Invalid admin password' using errcode = '28000';
  end if;
end;
$function$


CREATE OR REPLACE FUNCTION doctors.claim_prize(p_doctor_id uuid)
 RETURNS TABLE(prize_id uuid, prize_label text, prize_note text, color text, text_color text, chance_weight integer, total_stock integer, remaining_stock integer, is_active boolean, sort_order integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
declare
  v_total_weight integer;
  v_target double precision;
  v_running double precision := 0;
  v_prize doctors.wheel_prizes%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext(p_doctor_id::text));

  return query
  select
    c.prize_id,
    c.prize_label_snapshot,
    c.prize_note_snapshot,
    p.color,
    p.text_color,
    p.chance_weight,
    p.total_stock,
    p.remaining_stock,
    p.is_active,
    p.sort_order
  from doctors.wheel_claims c
  join doctors.wheel_prizes p on p.id = c.prize_id
  where c.doctor_id = p_doctor_id;

  if found then
    return;
  end if;

  select coalesce(sum(p.chance_weight), 0)
  into v_total_weight
  from doctors.wheel_prizes p
  where p.is_active = true
    and p.chance_weight > 0
    and p.remaining_stock > 0;

  if v_total_weight <= 0 then
    raise exception 'No wheel prizes available';
  end if;

  v_target := random() * v_total_weight;

  for v_prize in
    select *
    from doctors.wheel_prizes p
    where p.is_active = true
      and p.chance_weight > 0
      and p.remaining_stock > 0
    order by p.sort_order, p.created_at
    for update
  loop
    v_running := v_running + v_prize.chance_weight;
    exit when v_target <= v_running;
  end loop;

  update doctors.wheel_prizes wp
  set remaining_stock = wp.remaining_stock - 1,
      updated_at = now()
  where wp.id = v_prize.id
    and wp.remaining_stock > 0
  returning wp.* into v_prize;

  insert into doctors.wheel_claims
    (doctor_id, prize_id, prize_label_snapshot, prize_note_snapshot)
  values
    (p_doctor_id, v_prize.id, v_prize.label, v_prize.note);

  return query
  select
    v_prize.id,
    v_prize.label,
    v_prize.note,
    v_prize.color,
    v_prize.text_color,
    v_prize.chance_weight,
    v_prize.total_stock,
    v_prize.remaining_stock,
    v_prize.is_active,
    v_prize.sort_order;
end;
$function$


CREATE OR REPLACE FUNCTION doctors.create_shop_order(p_first_name text, p_last_name text, p_email text, p_mobile text, p_address text, p_city text, p_province text, p_barangay text, p_zip text, p_province_code text, p_city_municipality_code text, p_barangay_code text, p_shipping_region text, p_shipping_fee numeric, p_shipping_weight_grams integer, p_total_amount numeric, p_items jsonb, p_subtotal numeric, p_payment_method text DEFAULT 'maya'::text, p_referral_slug text DEFAULT NULL::text)
 RETURNS SETOF doctors.shop_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
declare
  v_order_id uuid;
  v_referral_slug text;
  v_referral_doctor_id uuid;
begin
  v_referral_slug := nullif(lower(trim(coalesce(p_referral_slug, ''))), '');

  -- Resolve the referrer, but refuse to credit a partner for their own order.
  -- Matching on email OR mobile so a second email address is not an easy dodge.
  if v_referral_slug is not null then
    select d.id into v_referral_doctor_id
    from doctors.doctor_registrations d
    where d.routing_slug = v_referral_slug
      and lower(trim(coalesce(d.email, ''))) is distinct from lower(trim(coalesce(p_email, '')))
      and nullif(regexp_replace(coalesce(d.mobile, ''), '\D', '', 'g'), '')
          is distinct from nullif(regexp_replace(coalesce(p_mobile, ''), '\D', '', 'g'), '')
    limit 1;
  end if;

  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'Order must include at least one item.';
  end if;

  if length(trim(coalesce(p_first_name, ''))) = 0 or length(trim(coalesce(p_last_name, ''))) = 0 then
    raise exception 'First and last name are required.';
  end if;

  insert into doctors.shop_orders (
    order_code,
    customer_name,
    first_name,
    last_name,
    email,
    mobile,
    address,
    city,
    province,
    barangay,
    zip,
    province_code,
    city_municipality_code,
    barangay_code,
    shipping_region,
    shipping_fee,
    shipping_weight_grams,
    total_amount,
    items,
    subtotal,
    payment_method,
    referral_slug,
    referral_doctor_id
  )
  values (
    doctors.generate_shop_order_code(),
    trim(p_first_name) || ' ' || trim(p_last_name),
    trim(p_first_name),
    trim(p_last_name),
    lower(trim(p_email)),
    trim(p_mobile),
    trim(p_address),
    trim(p_city),
    trim(p_province),
    trim(p_barangay),
    trim(p_zip),
    nullif(trim(coalesce(p_province_code, '')), ''),
    nullif(trim(coalesce(p_city_municipality_code, '')), ''),
    nullif(trim(coalesce(p_barangay_code, '')), ''),
    nullif(trim(coalesce(p_shipping_region, '')), ''),
    coalesce(p_shipping_fee, 0),
    coalesce(p_shipping_weight_grams, 0),
    coalesce(p_total_amount, coalesce(p_subtotal, 0) + coalesce(p_shipping_fee, 0)),
    p_items,
    coalesce(p_subtotal, 0),
    lower(trim(coalesce(p_payment_method, 'maya'))),
    v_referral_slug,
    v_referral_doctor_id
  )
  returning shop_orders.id into v_order_id;

  return query select * from doctors.admin_get_shop_order_unchecked(v_order_id);
end;
$function$


CREATE OR REPLACE FUNCTION doctors.generate_shop_order_code()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
declare
  v_code text;
begin
  -- 8 hex chars, not 4. get_shop_order_public exposes the order (including the delivery
  -- address) to anyone holding the code, and 4 chars is only 65k combinations per day -
  -- cheap to enumerate. 8 chars makes scraping infeasible. Older short codes still resolve.
  loop
    v_code := 'GG-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from doctors.shop_orders where order_code = v_code);
  end loop;

  return v_code;
end;
$function$


CREATE OR REPLACE FUNCTION doctors.get_doctor_redirect(p_routing_slug text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
  select redirect_url
  from doctors.doctor_registrations
  where routing_slug = lower(trim(p_routing_slug))
  limit 1;
$function$


CREATE OR REPLACE FUNCTION doctors.get_partner_invitation(p_slug text)
 RETURNS TABLE(routing_slug text, full_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
  select d.routing_slug, d.full_name
  from doctors.doctor_registrations d
  where d.routing_slug = lower(trim(coalesce(p_slug, '')))
  limit 1;
$function$


CREATE OR REPLACE FUNCTION doctors.get_referral_partner(p_slug text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
  select routing_slug
  from doctors.doctor_registrations
  where routing_slug = lower(trim(p_slug))
  limit 1;
$function$


CREATE OR REPLACE FUNCTION doctors.get_shop_order_public(p_order_code text)
 RETURNS TABLE(order_code text, status text, payment_status text, payment_attempts integer, maya_reference text, maya_fund_source text, first_name text, email_masked text, address text, barangay text, city text, province text, zip text, shipping_region text, shipping_fee numeric, subtotal numeric, total_amount numeric, items jsonb, created_at timestamp with time zone, paid_at timestamp with time zone, order_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
  select
    o.order_code,
    o.status,
    o.payment_status,
    coalesce(o.payment_attempts, 0),
    o.maya_reference,
    o.maya_fund_source,
    split_part(o.customer_name, ' ', 1),
    regexp_replace(o.email, '^(.).*@', '\1***@'),
    o.address,
    o.barangay,
    o.city,
    o.province,
    o.zip,
    o.shipping_region,
    coalesce(o.shipping_fee, 0),
    o.subtotal,
    coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0)),
    o.items,
    o.created_at,
    o.paid_at,
    o.id
  from doctors.shop_orders o
  where upper(trim(o.order_code)) = upper(trim(p_order_code))
  limit 1;
$function$


CREATE OR REPLACE FUNCTION doctors.list_wheel_prizes()
 RETURNS TABLE(id uuid, label text, note text, color text, text_color text, chance_weight integer, total_stock integer, remaining_stock integer, is_active boolean, sort_order integer, claim_count bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
  select
    p.id, p.label, p.note, p.color, p.text_color,
    p.chance_weight, p.total_stock, p.remaining_stock,
    p.is_active, p.sort_order,
    coalesce(c.claim_count, 0) as claim_count
  from doctors.wheel_prizes p
  left join (
    select prize_id, count(*) as claim_count
    from doctors.wheel_claims
    group by prize_id
  ) c on c.prize_id = p.id
  where p.is_active = true
    and p.chance_weight > 0
    and p.remaining_stock > 0
  order by p.sort_order, p.created_at;
$function$


CREATE OR REPLACE FUNCTION doctors.make_unique_doctor_slug(p_full_name text, p_doctor_id uuid DEFAULT NULL::uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
declare
  base_slug text;
  candidate text;
  suffix integer := 2;
begin
  base_slug := doctors.slugify_doctor_route(p_full_name);

  if base_slug is null or base_slug = '' then
    base_slug := 'doctor';
  end if;

  candidate := base_slug;

  while exists (
    select 1
    from doctors.doctor_registrations
    where routing_slug = candidate
      and (p_doctor_id is null or id <> p_doctor_id)
  ) loop
    candidate := base_slug || '-' || suffix::text;
    suffix := suffix + 1;
  end loop;

  return candidate;
end;
$function$


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


CREATE OR REPLACE FUNCTION sandbox.admin_list_shop_orders(p_admin_password text)
 RETURNS SETOF sandbox.shop_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sandbox', 'doctors', 'public'
AS $function$
begin
  perform doctors.assert_wheel_admin(p_admin_password);

  return query
  select * from sandbox.shop_orders order by created_at desc;
end;
$function$


CREATE OR REPLACE FUNCTION sandbox.admin_update_shop_order(p_admin_password text, p_order_id uuid, p_status text, p_payment_status text, p_maya_reference text DEFAULT NULL::text, p_admin_notes text DEFAULT NULL::text)
 RETURNS SETOF sandbox.shop_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sandbox', 'doctors', 'public'
AS $function$
begin
  perform doctors.assert_wheel_admin(p_admin_password);

  update sandbox.shop_orders
  set
    status = p_status,
    payment_status = p_payment_status,
    maya_reference = nullif(trim(coalesce(p_maya_reference, '')), ''),
    admin_notes = nullif(trim(coalesce(p_admin_notes, '')), ''),
    paid_at = case when p_payment_status = 'paid' then coalesce(paid_at, now()) else paid_at end
  where shop_orders.id = p_order_id;

  return query select * from sandbox.admin_get_shop_order_unchecked(p_order_id);
end;
$function$


CREATE OR REPLACE FUNCTION sandbox.create_shop_order(p_first_name text, p_last_name text, p_email text, p_mobile text, p_address text, p_city text, p_province text, p_barangay text, p_zip text, p_province_code text, p_city_municipality_code text, p_barangay_code text, p_shipping_region text, p_shipping_fee numeric, p_shipping_weight_grams integer, p_total_amount numeric, p_items jsonb, p_subtotal numeric, p_payment_method text DEFAULT 'maya'::text, p_referral_slug text DEFAULT NULL::text)
 RETURNS SETOF sandbox.shop_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sandbox', 'doctors', 'public'
AS $function$
declare
  v_order_id uuid;
  v_referral_slug text;
  v_referral_doctor_id uuid;
begin
  v_referral_slug := nullif(lower(trim(coalesce(p_referral_slug, ''))), '');

  -- Resolve the referrer, but refuse to credit a partner for their own order.
  -- Matching on email OR mobile so a second email address is not an easy dodge.
  if v_referral_slug is not null then
    select d.id into v_referral_doctor_id
    from doctors.doctor_registrations d
    where d.routing_slug = v_referral_slug
      and lower(trim(coalesce(d.email, ''))) is distinct from lower(trim(coalesce(p_email, '')))
      and nullif(regexp_replace(coalesce(d.mobile, ''), '\D', '', 'g'), '')
          is distinct from nullif(regexp_replace(coalesce(p_mobile, ''), '\D', '', 'g'), '')
    limit 1;
  end if;

  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'Order must include at least one item.';
  end if;

  if length(trim(coalesce(p_first_name, ''))) = 0 or length(trim(coalesce(p_last_name, ''))) = 0 then
    raise exception 'First and last name are required.';
  end if;

  insert into sandbox.shop_orders (
    order_code,
    customer_name,
    first_name,
    last_name,
    email,
    mobile,
    address,
    city,
    province,
    barangay,
    zip,
    province_code,
    city_municipality_code,
    barangay_code,
    shipping_region,
    shipping_fee,
    shipping_weight_grams,
    total_amount,
    items,
    subtotal,
    payment_method,
    referral_slug,
    referral_doctor_id
  )
  values (
    sandbox.generate_shop_order_code(),
    trim(p_first_name) || ' ' || trim(p_last_name),
    trim(p_first_name),
    trim(p_last_name),
    lower(trim(p_email)),
    trim(p_mobile),
    trim(p_address),
    trim(p_city),
    trim(p_province),
    trim(p_barangay),
    trim(p_zip),
    nullif(trim(coalesce(p_province_code, '')), ''),
    nullif(trim(coalesce(p_city_municipality_code, '')), ''),
    nullif(trim(coalesce(p_barangay_code, '')), ''),
    nullif(trim(coalesce(p_shipping_region, '')), ''),
    coalesce(p_shipping_fee, 0),
    coalesce(p_shipping_weight_grams, 0),
    coalesce(p_total_amount, coalesce(p_subtotal, 0) + coalesce(p_shipping_fee, 0)),
    p_items,
    coalesce(p_subtotal, 0),
    lower(trim(coalesce(p_payment_method, 'maya'))),
    v_referral_slug,
    v_referral_doctor_id
  )
  returning shop_orders.id into v_order_id;

  return query select * from sandbox.admin_get_shop_order_unchecked(v_order_id);
end;
$function$


CREATE OR REPLACE FUNCTION sandbox.generate_shop_order_code()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sandbox', 'doctors', 'public'
AS $function$
declare
  v_code text;
begin
  -- 8 hex chars, not 4. get_shop_order_public exposes the order (including the delivery
  -- address) to anyone holding the code, and 4 chars is only 65k combinations per day -
  -- cheap to enumerate. 8 chars makes scraping infeasible. Older short codes still resolve.
  loop
    v_code := 'GG-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from sandbox.shop_orders where order_code = v_code);
  end loop;

  return v_code;
end;
$function$


CREATE OR REPLACE FUNCTION sandbox.get_referral_partner(p_slug text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'sandbox', 'doctors', 'public'
AS $function$
  select routing_slug
  from doctors.doctor_registrations
  where routing_slug = lower(trim(p_slug))
  limit 1;
$function$


CREATE OR REPLACE FUNCTION sandbox.get_shop_order_public(p_order_code text)
 RETURNS TABLE(order_code text, status text, payment_status text, payment_attempts integer, maya_reference text, maya_fund_source text, first_name text, email_masked text, address text, barangay text, city text, province text, zip text, shipping_region text, shipping_fee numeric, subtotal numeric, total_amount numeric, items jsonb, created_at timestamp with time zone, paid_at timestamp with time zone, order_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'sandbox', 'doctors', 'public'
AS $function$
  select
    o.order_code,
    o.status,
    o.payment_status,
    coalesce(o.payment_attempts, 0),
    o.maya_reference,
    o.maya_fund_source,
    split_part(o.customer_name, ' ', 1),
    regexp_replace(o.email, '^(.).*@', '\1***@'),
    o.address,
    o.barangay,
    o.city,
    o.province,
    o.zip,
    o.shipping_region,
    coalesce(o.shipping_fee, 0),
    o.subtotal,
    coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0)),
    o.items,
    o.created_at,
    o.paid_at,
    o.id
  from sandbox.shop_orders o
  where upper(trim(o.order_code)) = upper(trim(p_order_code))
  limit 1;
$function$


CREATE OR REPLACE FUNCTION sandbox.partner_dashboard(p_scope text DEFAULT 'all'::text, p_status text DEFAULT NULL::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0, p_date_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_date_to timestamp with time zone DEFAULT NULL::timestamp with time zone, p_sort text DEFAULT 'newest'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'sandbox', 'doctors', 'public'
AS $function$
declare
  v_email text; v_doctor doctors.doctor_registrations;
  v_scope text := lower(trim(coalesce(p_scope, 'all')));
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_order_count bigint; v_orders jsonb;
begin
  if v_scope not in ('all', 'direct', 'referred') then raise exception 'Invalid order scope.' using errcode = '22023'; end if;
  if lower(coalesce(p_sort,'newest')) not in ('newest','oldest') then raise exception 'Invalid order sort.' using errcode='22023'; end if;
  v_email := nullif(lower(trim(coalesce(auth.jwt() ->> 'email', ''))), '');
  if v_email is null then raise exception 'Sign in to view your dashboard.' using errcode = '42501'; end if;
  select * into v_doctor from doctors.doctor_registrations where email = v_email limit 1;
  if v_doctor.id is null then raise exception 'This email is not registered as a GutGuard partner.' using errcode = '42501'; end if;

  select count(*) into v_order_count from sandbox.shop_orders o
  join doctors.doctor_registrations source on source.id = o.referral_doctor_id
  where (source.id = v_doctor.id or source.referred_by_partner_id = v_doctor.id)
    and (v_scope = 'all' or (v_scope = 'direct' and source.id = v_doctor.id) or (v_scope = 'referred' and source.referred_by_partner_id = v_doctor.id))
    and (nullif(lower(trim(coalesce(p_status, ''))), '') is null or lower(o.payment_status) = lower(trim(p_status)) or lower(o.status) = lower(trim(p_status)))
    and (p_date_from is null or o.created_at>=p_date_from) and (p_date_to is null or o.created_at<p_date_to+interval '1 day');

  select coalesce(jsonb_agg(entry order by
    case when lower(coalesce(p_sort,'newest'))='oldest' then sort_at end asc,
    case when lower(coalesce(p_sort,'newest'))='newest' then sort_at end desc),'[]'::jsonb) into v_orders from (
    select o.created_at sort_at, jsonb_build_object(
      'order_code', o.order_code, 'created_at', o.created_at, 'status', o.status,
      'payment_status', o.payment_status, 'total_amount', coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0)),
      'buyer_first_name', coalesce(o.first_name, split_part(o.customer_name, ' ', 1)), 'city', o.city, 'province', o.province,
      'source_type', case when source.id = v_doctor.id then 'direct' else 'referred' end,
      'source_partner_name', source.full_name, 'source_partner_slug', source.routing_slug) entry
    from sandbox.shop_orders o join doctors.doctor_registrations source on source.id = o.referral_doctor_id
    where (source.id = v_doctor.id or source.referred_by_partner_id = v_doctor.id)
      and (v_scope = 'all' or (v_scope = 'direct' and source.id = v_doctor.id) or (v_scope = 'referred' and source.referred_by_partner_id = v_doctor.id))
      and (nullif(lower(trim(coalesce(p_status, ''))), '') is null or lower(o.payment_status) = lower(trim(p_status)) or lower(o.status) = lower(trim(p_status)))
      and (p_date_from is null or o.created_at>=p_date_from) and (p_date_to is null or o.created_at<p_date_to+interval '1 day')
    order by case when lower(coalesce(p_sort,'newest'))='oldest' then o.created_at end asc,
      case when lower(coalesce(p_sort,'newest'))='newest' then o.created_at end desc limit v_limit offset v_offset
  ) page;

  return jsonb_build_object(
    'partner', jsonb_build_object('full_name', v_doctor.full_name, 'routing_slug', v_doctor.routing_slug, 'joined_at', v_doctor.created_at),
    'clicks', jsonb_build_object('total', (select count(*) from sandbox.referral_clicks c where c.doctor_id = v_doctor.id),
      'last_30_days', (select count(*) from sandbox.referral_clicks c where c.doctor_id = v_doctor.id and c.created_at >= now() - interval '30 days')),
    'totals', (select jsonb_build_object(
      'direct_orders', count(*) filter (where source.id = v_doctor.id),
      'referred_orders', count(*) filter (where source.referred_by_partner_id = v_doctor.id), 'orders', count(*),
      'paid_orders', count(*) filter (where o.payment_status = 'paid'),
      'direct_paid_amount', coalesce(sum(coalesce(nullif(o.total_amount,0),o.subtotal+coalesce(o.shipping_fee,0))) filter (where o.payment_status='paid' and source.id=v_doctor.id),0),
      'referred_paid_amount', coalesce(sum(coalesce(nullif(o.total_amount,0),o.subtotal+coalesce(o.shipping_fee,0))) filter (where o.payment_status='paid' and source.referred_by_partner_id=v_doctor.id),0),
      'paid_amount', coalesce(sum(coalesce(nullif(o.total_amount,0),o.subtotal+coalesce(o.shipping_fee,0))) filter (where o.payment_status='paid'),0),
      'referred_partners', (select count(*) from doctors.doctor_registrations d where d.referred_by_partner_id=v_doctor.id))
      from sandbox.shop_orders o join doctors.doctor_registrations source on source.id=o.referral_doctor_id
      where source.id=v_doctor.id or source.referred_by_partner_id=v_doctor.id),
    'orders', v_orders,
    'orders_page', jsonb_build_object('total',v_order_count,'limit',v_limit,'offset',v_offset,'has_more',v_offset+jsonb_array_length(v_orders)<v_order_count),
    'referred_partners', (select coalesce(jsonb_agg(entry order by joined_at desc),'[]'::jsonb) from (
      select child.created_at joined_at, jsonb_build_object('full_name',child.full_name,'routing_slug',child.routing_slug,
        'specialty',child.specialty,'practice_location',child.practice_location,'joined_at',child.created_at,'orders',count(o.id),
        'paid_order_value',coalesce(sum(coalesce(nullif(o.total_amount,0),o.subtotal+coalesce(o.shipping_fee,0))) filter(where o.payment_status='paid'),0)) entry
      from doctors.doctor_registrations child left join sandbox.shop_orders o on o.referral_doctor_id=child.id
      where child.referred_by_partner_id=v_doctor.id group by child.id order by child.created_at desc) partners)
  );
end;
$function$


CREATE OR REPLACE FUNCTION sandbox.touch_shop_order_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$


CREATE OR REPLACE FUNCTION sandbox.track_referral_click(p_slug text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sandbox', 'doctors', 'public'
AS $function$
declare
  v_slug text;
  v_doctor_id uuid;
begin
  select d.routing_slug, d.id into v_slug, v_doctor_id
  from doctors.doctor_registrations d
  where d.routing_slug = lower(trim(coalesce(p_slug, '')))
  limit 1;

  if v_slug is null then
    return null;
  end if;

  insert into sandbox.referral_clicks (routing_slug, doctor_id) values (v_slug, v_doctor_id);

  return v_slug;
end;
$function$
