-- Promo final price typed by admin per product ({ "<product id>": <pesos> }).
-- Overrides the % maths for that product while the promo is the winning one; the shop
-- still shows the entered % ("Save 40%"). Blank/missing = the calculation.
-- Checkout charges and verifies this price (lib/catalog.ts promoPrice).
do $prices$
declare
  v_schema text;
begin
  foreach v_schema in array array['doctors', 'sandbox'] loop
    if exists (select 1 from information_schema.tables where table_schema = v_schema and table_name = 'promos') then
      execute format(
        'alter table %I.promos add column if not exists prices jsonb not null default ''{}''::jsonb check (jsonb_typeof(prices) = ''object'')',
        v_schema
      );
    end if;
  end loop;
end
$prices$;
