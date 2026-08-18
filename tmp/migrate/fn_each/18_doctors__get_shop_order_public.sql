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
$function$;