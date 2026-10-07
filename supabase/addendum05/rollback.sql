-- Addendum 05 rollback for 20261007000000_prototype_shop.sql, both shop schemas.
-- Use it together with the app rollback (Vercel: promote the previous Production deployment),
-- because the old shop creates orders from the browser and needs create_shop_order open again.
-- The three new shop_orders columns are kept: they are harmless to the old code and keep who
-- the gift orders were for.
begin;
do $$
declare
  s text;
  fn regprocedure;
begin
  foreach s in array array['doctors', 'sandbox'] loop
    execute format('drop function if exists %I.shop_watch_eligible(text, uuid)', s);
    execute format('drop function if exists %I.shop_cancel_unpaid_watch(text)', s);
    execute format('drop function if exists %I.shop_watch_gifts(text)', s);
  end loop;
  for fn in
    select p.oid::regprocedure
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname in ('public', 'doctors', 'sandbox') and p.proname = 'create_shop_order'
  loop
    execute format('grant execute on function %s to anon, authenticated', fn);
  end loop;
end $$;
commit;
