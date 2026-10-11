-- Admin-editable products (price, per-capsule price, capsules, labels, status).
-- Seeded with the exact values that were hardcoded in lib/catalog.ts, so nothing changes
-- until an admin edits a product. lib/catalog.ts keeps the same list as the fallback.
--
-- Products are never deleted - only hidden or archived - because orders and promos
-- reference the id. The id is fixed once created.
--
-- Also adds promos.per_cap: the promo per-capsule price admin types per product
-- ({ "<product id>": <pesos> }, display only; checkout charges the product price).
--
-- Created in every shop schema (doctors, and sandbox where the mirror exists).
do $products$
declare
  v_schema text;
begin
  foreach v_schema in array array['doctors', 'sandbox'] loop
    if not exists (select 1 from information_schema.schemata where schema_name = v_schema) then
      continue;
    end if;

    execute format($sql$
      create table if not exists %1$I.products (
        id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
        kind text not null check (kind in ('protocol', 'trial')),
        name text not null check (length(trim(name)) > 0),
        phase text not null default '',
        days integer not null default 0 check (days >= 0),
        caps integer not null check (caps > 0),
        price integer not null check (price > 0),
        per_cap_price integer not null check (per_cap_price > 0),
        tag text not null default '',
        image text not null default '',
        sort_order integer not null default 0,
        status text not null default 'active' check (status in ('active', 'hidden', 'archived')),
        updated_at timestamptz not null default now()
      );

      alter table %1$I.products enable row level security;

      drop policy if exists products_public_read on %1$I.products;
      create policy products_public_read on %1$I.products
        for select to anon, authenticated using (status = 'active');

      revoke all on %1$I.products from anon, authenticated;
      grant select on %1$I.products to anon, authenticated;
      grant all on %1$I.products to service_role;

      insert into %1$I.products (id, kind, name, phase, days, caps, price, per_cap_price, tag, image, sort_order)
      values
        ('start', 'protocol', 'Start', '30-day', 30, 30, 3999, 133, '', '', 1),
        ('grow', 'protocol', 'Grow', '60-day', 60, 90, 10999, 122, 'Popular', '', 2),
        ('peak', 'protocol', 'Peak', '90-day', 90, 330, 29999, 90, 'Best rate', '', 3),
        ('trial-blister', 'trial', 'Blister Trial', '', 0, 10, 1499, 150, '', '/shop/blister.png', 1),
        ('trial-bottle', 'trial', 'Bottle Trial', '', 0, 30, 4299, 143, '', '/shop/bottle.png', 2)
      on conflict (id) do nothing;

      alter table %1$I.promos
        add column if not exists per_cap jsonb not null default '{}'::jsonb
        check (jsonb_typeof(per_cap) = 'object');
    $sql$, v_schema);
  end loop;
end
$products$;
