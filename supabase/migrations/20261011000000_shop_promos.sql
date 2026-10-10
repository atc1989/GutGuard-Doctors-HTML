-- Shop promos: percentage off per product, between two Manila calendar days.
-- Overlapping promos never stack - the app picks the biggest live discount per product
-- (lib/catalog.ts promoPrice), and the Maya checkout route re-derives prices the same way.
--
-- Created in every shop schema (doctors, and sandbox where the mirror exists) so promos
-- tried on sandbox.gutguard.ph never touch production prices.
--
-- Writes go through /api/admin/promos with the service role after the admin session check;
-- the public can only read switched-on promos.
do $promos$
declare
  v_schema text;
begin
  foreach v_schema in array array['doctors', 'sandbox'] loop
    if not exists (select 1 from information_schema.schemata where schema_name = v_schema) then
      continue;
    end if;

    execute format($sql$
      create table if not exists %1$I.promos (
        id uuid primary key default gen_random_uuid(),
        name text not null check (length(trim(name)) > 0),
        label text not null default '',
        starts_on date not null,
        ends_on date,
        enabled boolean not null default true,
        -- { "<catalog product id>": <whole percent 1-90> }
        discounts jsonb not null default '{}'::jsonb check (jsonb_typeof(discounts) = 'object'),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        check (ends_on is null or ends_on >= starts_on)
      );

      alter table %1$I.promos enable row level security;

      drop policy if exists promos_public_read on %1$I.promos;
      create policy promos_public_read on %1$I.promos
        for select to anon, authenticated using (enabled);

      revoke all on %1$I.promos from anon, authenticated;
      grant select on %1$I.promos to anon, authenticated;
      grant all on %1$I.promos to service_role;
    $sql$, v_schema);

    -- Starter promos, only into an empty table so re-running never duplicates them.
    execute format($sql$
      insert into %1$I.promos (name, label, starts_on, ends_on, discounts)
      select * from (values
        ('Standard discount', '', date '2026-10-01', null::date,
          '{"start": 7, "grow": 10, "peak": 15}'::jsonb),
        ('Holiday Promo', 'Holiday Promo', date '2026-10-01', date '2026-12-31',
          '{"start": 10, "grow": 20, "peak": 40}'::jsonb)
      ) seed
      where not exists (select 1 from %1$I.promos);
    $sql$, v_schema);
  end loop;
end
$promos$;
