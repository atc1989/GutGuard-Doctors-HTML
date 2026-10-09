-- Put Najeeb Mapantas (lifestyle) under the Main Store "new atc" (gutguardhq@gutguard.ph), so an
-- order through Najeeb's link shows in that Main Store's reports AND passes points up to it.
-- Run once in the SQL editor (GutGuard Life Style). One transaction: all or nothing.
--
-- Two fields decide "under":
--   main_store_id          -> which Main Store's reports / store directory include him
--   referred_by_partner_id -> who gets the depth-1 pass-up points on his sales
-- Both are set. referred_by is normally immutable; the doctors.allow_referrer_change flag
-- (20261008000000) opens it for this transaction only.
--
-- promoted_by = 'admin' keeps him lifestyle when cleanup/20261008_remove_sandbox_test_data.sql
-- runs (he has no real paid order, so it would otherwise send him back to affiliate).
--
-- His 7 direct referrals (6 "SANDBOX QA Dr." + KM / test-account) move with him, the same way a
-- new sign-up inherits its referrer's Main Store. Delete step 2 to leave them where they are.
--
-- Undo: the audit row in doctors.store_promotions records the previous values.

do $$
declare
  v_main uuid;
  v_najeeb uuid;
  v_moved integer := 0;
begin
  select id into v_main from doctors.doctor_registrations
  where lower(email) = 'gutguardhq@gutguard.ph' and store_type = 'main';
  select id into v_najeeb from doctors.doctor_registrations
  where lower(email) = 'najeebmapantas21@gmail.com' and store_type = 'lifestyle';
  if v_main is null or v_najeeb is null then
    raise exception 'Expected a Main Store gutguardhq@gutguard.ph and a lifestyle najeebmapantas21@gmail.com; nothing changed.';
  end if;

  -- 1. Najeeb -> under new atc
  perform set_config('doctors.allow_referrer_change', 'on', true);
  update doctors.doctor_registrations
  set referred_by_partner_id = v_main,
      main_store_id = v_main,
      promoted_by = 'admin',
      promoted_at = coalesce(promoted_at, now())
  where id = v_najeeb;
  perform set_config('doctors.allow_referrer_change', '', true);

  -- 2. His referral subtree follows him (Main Stores inside it keep their own subtree)
  with recursive tree as (
    select id from doctors.doctor_registrations where referred_by_partner_id = v_najeeb and store_type <> 'main'
    union
    select d.id from doctors.doctor_registrations d join tree t on d.referred_by_partner_id = t.id where d.store_type <> 'main'
  )
  update doctors.doctor_registrations set main_store_id = v_main where id in (select id from tree);
  get diagnostics v_moved = row_count;

  insert into doctors.store_promotions (partner_id, from_type, to_type, trigger_type, trigger_admin_note)
  values (v_najeeb, 'lifestyle', 'lifestyle', 'admin_reparent',
    'Placed under Main Store gutguardhq@gutguard.ph on ' || to_char(now(), 'YYYY-MM-DD')
    || '. Before: referred_by=NULL, main_store_id=GutGuard Main Store (gutguard-main), promoted_by=NULL, promoted_at=NULL. '
    || 'Moved ' || v_moved || ' downline stores from GutGuard Main Store.');
end $$;

-- Check
select d.full_name, d.store_type, d.promoted_by, r.full_name as referred_by, m.full_name as main_store
from doctors.doctor_registrations d
left join doctors.doctor_registrations r on r.id = d.referred_by_partner_id
left join doctors.doctor_registrations m on m.id = d.main_store_id
where lower(d.email) = 'najeebmapantas21@gmail.com'
   or d.referred_by_partner_id = (select id from doctors.doctor_registrations where lower(email) = 'najeebmapantas21@gmail.com')
order by d.referred_by_partner_id nulls first, d.full_name;
