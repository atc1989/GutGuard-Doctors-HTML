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
$function$;