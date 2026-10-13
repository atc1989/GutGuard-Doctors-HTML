-- Full Protocol redesign (boss's mockup, 2026-10-13): per-product dosage line and a
-- "What's included" list with a note, shown on the package cards. Admin-editable in
-- /admin/products. Both shop schemas, seeded with the mockup's copy.
--
-- Also aligns Peak with the mockup: tag "Recommended", phase "90-day full protocol".
-- Safe for the live site: production's current code does not read the products table.
do $details$
declare
  v_schema text;
begin
  foreach v_schema in array array['doctors', 'sandbox'] loop
    if not exists (select 1 from information_schema.tables where table_schema = v_schema and table_name = 'products') then
      continue;
    end if;

    execute format($sql$
      alter table %1$I.products add column if not exists dosage text not null default '';
      alter table %1$I.products add column if not exists includes jsonb not null default '[]'::jsonb
        check (jsonb_typeof(includes) = 'array');
      alter table %1$I.products add column if not exists includes_note text not null default '';

      update %1$I.products set dosage = '1–2 capsules a day' where id = 'start' and dosage = '';
      update %1$I.products set dosage = '2–4 capsules a day' where id = 'grow' and dosage = '';
      update %1$I.products
        set dosage = case when dosage = '' then '4–6 capsules a day' else dosage end,
            includes = case when includes = '[]'::jsonb
              then '["SynBIOTIC+ (330 capsules)", "Lifestyle Protocol"]'::jsonb else includes end,
            includes_note = case when includes_note = ''
              then 'Lower rate for completing the full 90 days.' else includes_note end,
            tag = 'Recommended',
            phase = '90-day full protocol'
        where id = 'peak';
    $sql$, v_schema);
  end loop;
end
$details$;
