CREATE OR REPLACE FUNCTION sandbox.admin_get_shop_order_unchecked(p_order_id uuid)
 RETURNS SETOF sandbox.shop_orders
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'sandbox', 'doctors', 'public'
AS $function$
  select * from sandbox.shop_orders where id = p_order_id limit 1;
$function$;