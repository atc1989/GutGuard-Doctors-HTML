-- Prototype shop port (Addendum 05).
-- 1. Orders paid for someone else keep who takes the capsules.
-- 2. The 5-Night Watch first-buyer rule, checked on the server.
-- Applied to both shop schemas: `doctors` (production) and `sandbox` (sandbox.gutguard.ph).

do $$
declare
  s text;
begin
  foreach s in array array['doctors', 'sandbox'] loop
    if to_regclass(format('%I.shop_orders', s)) is null then
      continue;
    end if;

    execute format('alter table %I.shop_orders add column if not exists for_other boolean not null default false', s);
    execute format('alter table %I.shop_orders add column if not exists recipient_name text', s);
    execute format('alter table %I.shop_orders add column if not exists recipient_mobile text', s);

    -- The Watch is for a first order: a number with no paid order in the last 12 months.
    -- It checks the person who takes the capsules: the buyer, or the recipient when bought for someone else.
    execute format($f$
      create or replace function %1$I.shop_watch_eligible(p_mobile text)
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
            where o.payment_status = 'paid'
              and o.created_at > now() - interval '12 months'
              and right(regexp_replace(
                    case when o.for_other then coalesce(o.recipient_mobile, '') else coalesce(o.mobile, '') end,
                    '\D', '', 'g'), 10) = n.d
          );
      $body$;
    $f$, s);

    -- Server routes only (service role). Not exposed to anon: it would let anyone test numbers.
    execute format('revoke all on function %I.shop_watch_eligible(text) from public, anon, authenticated', s);
  end loop;
end $$;
