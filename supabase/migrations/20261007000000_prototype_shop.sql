-- Prototype shop port (Addendum 05).
-- 1. Orders paid for someone else keep who takes the capsules.
-- 2. The 5-Night Watch first-buyer rule, checked on the server.
-- 3. Orders are created by the server only (POST /api/shop/order), never straight from the browser.
-- Applied to both shop schemas: `doctors` (production) and `sandbox` (sandbox.gutguard.ph).
--
-- Two optional settings, for a safe rollout (Addendum 05, Part B). Put them on the first lines
-- of the same SQL editor run:
--   set addendum05.schemas = 'sandbox';  -- only this schema (default: doctors,sandbox)
--   set addendum05.step = 'prepare';     -- add columns and functions, but keep create_shop_order
--                                        -- open to the browser, so the old live shop keeps working
-- Run once more without addendum05.step after the new website is live, to close create_shop_order.
-- Running the file twice is safe.

do $$
declare
  s text;
  fn regprocedure;
  schemas text[] := string_to_array(replace(coalesce(nullif(current_setting('addendum05.schemas', true), ''), 'doctors,sandbox'), ' ', ''), ',');
  step text := coalesce(nullif(current_setting('addendum05.step', true), ''), 'all');
begin
  if step not in ('all', 'prepare') then
    raise exception 'addendum05.step must be all or prepare, not %', step;
  end if;
  if not schemas <@ array['doctors', 'sandbox'] then
    raise exception 'addendum05.schemas must list doctors and/or sandbox, not %', schemas;
  end if;
  foreach s in array schemas loop
    if to_regclass(format('%I.shop_orders', s)) is null then
      continue;
    end if;

    execute format('alter table %I.shop_orders add column if not exists for_other boolean not null default false', s);
    execute format('alter table %I.shop_orders add column if not exists recipient_name text', s);
    execute format('alter table %I.shop_orders add column if not exists recipient_mobile text', s);

    -- The Watch is for a first order: no paid order in the last 12 months on the number of the
    -- person who takes the capsules (the buyer, or the recipient when bought for someone else).
    -- A Watch order still waiting for payment (last 24 hours) also counts, so two orders cannot
    -- both get the Watch. p_exclude is the order being paid, so it does not count against itself.
    execute format($f$
      create or replace function %1$I.shop_watch_eligible(p_mobile text, p_exclude uuid default null)
      returns boolean
      language sql
      stable
      security definer
      set search_path = %1$I
      as $body$
        with n as (select right(regexp_replace(coalesce(p_mobile, ''), '\D', '', 'g'), 10) as d)
        select length((select d from n)) = 10
          and not exists (
            select 1
            from %1$I.shop_orders o, n
            where (p_exclude is null or o.id <> p_exclude)
              and right(regexp_replace(
                    case when o.for_other then coalesce(o.recipient_mobile, '') else coalesce(o.mobile, '') end,
                    '\D', '', 'g'), 10) = n.d
              and (
                (o.payment_status = 'paid' and o.created_at > now() - interval '12 months')
                or (o.payment_status in ('pending', 'review')
                    and o.status <> 'cancelled'
                    and o.items @> '[{"id":"watch"}]'::jsonb
                    and o.created_at > now() - interval '24 hours')
              )
          );
      $body$;
    $f$, s);

    -- A buyer who starts again (new address, new items) replaces their own unpaid Watch order.
    execute format($f$
      create or replace function %1$I.shop_cancel_unpaid_watch(p_mobile text)
      returns integer
      language sql
      security definer
      set search_path = %1$I
      as $body$
        with n as (select right(regexp_replace(coalesce(p_mobile, ''), '\D', '', 'g'), 10) as d),
        upd as (
          update %1$I.shop_orders o
             set status = 'cancelled', updated_at = now()
            from n
           where o.payment_status = 'pending'
             and o.status = 'pending_payment'
             and o.items @> '[{"id":"watch"}]'::jsonb
             and right(regexp_replace(
                   case when o.for_other then coalesce(o.recipient_mobile, '') else coalesce(o.mobile, '') end,
                   '\D', '', 'g'), 10) = n.d
          returning 1
        )
        select count(*)::integer from upd;
      $body$;
    $f$, s);

    -- Paid Watches one payer has bought for other people in the last 12 months (gift limit).
    execute format($f$
      create or replace function %1$I.shop_watch_gifts(p_payer_mobile text)
      returns integer
      language sql
      stable
      security definer
      set search_path = %1$I
      as $body$
        select count(*)::integer
        from %1$I.shop_orders o
        where o.for_other
          and o.payment_status = 'paid'
          and o.items @> '[{"id":"watch"}]'::jsonb
          and o.created_at > now() - interval '12 months'
          and right(regexp_replace(coalesce(o.mobile, ''), '\D', '', 'g'), 10)
            = right(regexp_replace(coalesce(p_payer_mobile, ''), '\D', '', 'g'), 10);
      $body$;
    $f$, s);

    -- Server routes only. Not for anon: they would let anyone test numbers.
    execute format('revoke all on function %I.shop_watch_eligible(text, uuid) from public, anon, authenticated', s);
    execute format('revoke all on function %I.shop_cancel_unpaid_watch(text) from public, anon, authenticated', s);
    execute format('revoke all on function %I.shop_watch_gifts(text) from public, anon, authenticated', s);
    execute format('grant execute on function %I.shop_watch_eligible(text, uuid) to service_role', s);
    execute format('grant execute on function %I.shop_cancel_unpaid_watch(text) to service_role', s);
    execute format('grant execute on function %I.shop_watch_gifts(text) to service_role', s);

  end loop;

  if step = 'prepare' then
    raise notice 'prepare: create_shop_order left as it was. Run again without addendum05.step after the new site is live.';
    return;
  end if;

  -- Orders now come only from POST /api/shop/order (service role), which applies the Watch
  -- rule and builds every price. The browser can no longer call create_shop_order directly.
  -- (`public` holds an older copy; it is closed together with `doctors`.)
  for fn in
    select p.oid::regprocedure
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where (ns.nspname = any(schemas) or (ns.nspname = 'public' and 'doctors' = any(schemas)))
      and p.proname = 'create_shop_order'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end $$;
