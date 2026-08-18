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
$function$;