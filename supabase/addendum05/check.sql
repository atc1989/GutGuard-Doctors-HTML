-- Addendum 05: run after 20261002000000_prototype_shop.sql. Change `doctors` to `sandbox` to check the mirror.
-- After the final run (step all) every row must say ok = true.
-- After a `prepare` run, the last row says false on purpose (the browser can still create orders).
with s as (select 'doctors'::text as name)
select 'shop_orders: 3 new columns' as test,
       (select count(*) from information_schema.columns c, s
         where c.table_schema = s.name and c.table_name = 'shop_orders'
           and c.column_name in ('for_other', 'recipient_name', 'recipient_mobile')) = 3 as ok
union all
select 'Watch functions: service role only',
       (select bool_and(has_function_privilege('service_role', p.oid, 'execute')
                        and not has_function_privilege('anon', p.oid, 'execute')
                        and not has_function_privilege('authenticated', p.oid, 'execute'))
            and count(*) = 3
          from pg_proc p join pg_namespace n on n.oid = p.pronamespace, s
         where n.nspname = s.name and p.proname in ('shop_watch_eligible', 'shop_cancel_unpaid_watch', 'shop_watch_gifts'))
union all
select 'create_shop_order: closed to the browser',
       (select coalesce(bool_and(not has_function_privilege('anon', p.oid, 'execute')
                                 and has_function_privilege('service_role', p.oid, 'execute')), false)
          from pg_proc p join pg_namespace n on n.oid = p.pronamespace, s
         where n.nspname = s.name and p.proname = 'create_shop_order');
