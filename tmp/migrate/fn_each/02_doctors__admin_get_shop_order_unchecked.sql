CREATE OR REPLACE FUNCTION doctors.admin_get_shop_order_unchecked(p_order_id uuid)
 RETURNS SETOF doctors.shop_orders
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
  select * from doctors.shop_orders where id = p_order_id limit 1;
$function$;