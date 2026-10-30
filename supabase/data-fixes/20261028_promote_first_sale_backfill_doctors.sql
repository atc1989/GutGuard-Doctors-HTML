-- PRODUCTION (doctors). Partners live only in doctors, so there is no sandbox copy.
--
-- Auto-promotion on a first paid sale went live on production on 2026-10-07 (first
-- 'first_sale' row in store_promotions). An affiliate whose first sale was paid before then
-- was never promoted. On 2026-10-28 that is one partner: Karlene Mae Hernaez
-- (order GG-20261005-388A8D57, paid 2026-10-05).
--
-- Makes the same change trigger_award_points makes on a first sale, logged as a first_sale
-- promotion from the partner's first paid order. Re-runnable: promoted partners are no longer
-- affiliates. Expect 1 row back.

begin;

with first_paid as (
  select distinct on (o.referral_doctor_id) o.referral_doctor_id as partner_id, o.id as order_id
  from doctors.shop_orders o
  where o.payment_status = 'paid' and o.referral_doctor_id is not null
  order by o.referral_doctor_id, o.created_at
), promoted as (
  update doctors.doctor_registrations d
  set store_type = 'lifestyle', referral_qr_enabled = true, promoted_at = now(), promoted_by = 'auto'
  from first_paid f
  where d.id = f.partner_id and d.store_type = 'affiliate'
  returning d.id, d.full_name, f.order_id
)
insert into doctors.store_promotions (partner_id, from_type, to_type, trigger_type, trigger_order_id, trigger_admin_note)
select id, 'affiliate', 'lifestyle', 'first_sale', order_id, 'Backfill: first sale was paid before auto-promotion went live'
from promoted
returning partner_id, trigger_order_id;

commit;
