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


