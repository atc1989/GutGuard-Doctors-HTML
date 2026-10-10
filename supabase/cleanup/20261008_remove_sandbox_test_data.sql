-- Remove sandbox QA data that leaked into PRODUCTION (`doctors` schema, project GutGuard Life Style).
--
-- Not a migration: run it by hand in the SQL editor, once, after 20261008000000 is applied.
-- It ends in ROLLBACK. Read the "after" numbers, then change the last line to COMMIT and run
-- it again. Take a backup first (Database -> Backups) - this deletes rows.
--
-- What it fixes (counts as of 2026-10-08):
--   * 46 SBX-* test orders sit in doctors.shop_orders (copied by 20260814000100 and a later test).
--     401 of the 408 production e-points were awarded from them.
--   * One "unlocked" PHP 18,000 rebate row rests entirely on those test points.
--   * Partners promoted affiliate -> lifestyle by test orders (sandbox trigger, or the
--     20261002000000 backfill counting test orders) without a single real paid order.
--
-- Deliberately NOT touched:
--   * The six "SANDBOX QA Dr." partners: sandbox has no partner table of its own, so the QA
--     shop on sandbox.gutguard.ph needs them. They stay, but are skipped by the demotion below.
--   * Anything in the `sandbox` schema (that is QA data by definition).
--   * Main Stores and partners an admin promoted (promoted_by = 'admin').

-- ─── Preview (read-only) ───────────────────────────────────────────────────────
select 'test orders in prod' as what, count(*) as n from doctors.shop_orders where order_code like 'SBX-%'
union all
select 'points from test orders', coalesce(sum(p.points), 0) from doctors.partner_points p
  join doctors.shop_orders o on o.id = p.order_id where o.order_code like 'SBX-%'
union all
select 'points from real orders', coalesce(sum(p.points), 0) from doctors.partner_points p
  join doctors.shop_orders o on o.id = p.order_id where o.order_code not like 'SBX-%';

begin;

-- 1. Test orders. partner_points cascades; the receipt-log FK does not, so clear it first.
delete from doctors.shop_order_email_sends
where order_id in (select id from doctors.shop_orders where order_code like 'SBX-%');
delete from doctors.shop_orders where order_code like 'SBX-%';

-- 2. Rebate rows no longer backed by points (milestone N of cycle C needs (C-1)*1500 + N).
delete from doctors.milestone_unlocks m
where (select coalesce(sum(p.points), 0) from doctors.partner_points p where p.partner_id = m.partner_id)
      < (m.cycle_number - 1) * 1500 + m.milestone_pts
returning 'removed rebate' as what, m.partner_id, m.cycle_number, m.milestone_pts, m.rebate_amount;

-- 3. Lifestyle stores with no real paid order and no admin promotion go back to affiliate,
--    which is where every partner without a first sale starts (QR off).
with demoted as (
  update doctors.doctor_registrations d
  set store_type = 'affiliate', referral_qr_enabled = false, promoted_at = null, promoted_by = null
  where d.store_type = 'lifestyle'
    and coalesce(d.promoted_by, '') <> 'admin'
    and d.full_name not ilike 'sandbox qa%'
    and d.id::text not like '4fbb1000-%'
    and not exists (
      select 1 from doctors.shop_orders o
      where o.referral_doctor_id = d.id and o.payment_status = 'paid'
    )
  returning d.id, d.full_name, d.routing_slug
)
select 'demoted to affiliate' as what, full_name, routing_slug from demoted;

-- ─── After ─────────────────────────────────────────────────────────────────────
select 'orders left' as what, count(*) as n from doctors.shop_orders
union all
select 'points left', coalesce(sum(points), 0) from doctors.partner_points
union all
select 'rebate rows left', count(*) from doctors.milestone_unlocks
union all
select 'lifestyle stores left', count(*) from doctors.doctor_registrations where store_type = 'lifestyle';

rollback;  -- change to COMMIT once the numbers above look right
