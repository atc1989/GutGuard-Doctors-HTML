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
$function$;