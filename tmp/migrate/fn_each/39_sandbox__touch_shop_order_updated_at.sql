CREATE OR REPLACE FUNCTION sandbox.touch_shop_order_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;