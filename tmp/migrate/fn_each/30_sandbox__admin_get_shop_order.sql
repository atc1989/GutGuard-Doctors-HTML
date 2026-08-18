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
$function$;