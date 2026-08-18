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
$function$;