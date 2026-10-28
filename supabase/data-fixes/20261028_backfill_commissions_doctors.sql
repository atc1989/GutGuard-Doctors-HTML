-- PRODUCTION (doctors schema only; the other schema has its own file).
--
-- The 10% commission (20261101000000_wallet_earnings_*) only credits orders that turn paid
-- after it was installed. This credits the orders that were already paid: 10% of the
-- products subtotal (no shipping) to the partner whose link sold each order.
-- Same amount and rule as credit_order_commission. Re-runnable: one commission per order.
-- On 2026-10-28: 7 orders, PHP 11,619.30 in total (Daryl 8,999.70, Frederick 1,939.90, Grace 379.90, Rudolph 149.90, Karlene 149.90).

insert into doctors.partner_commissions (order_id, partner_id, amount)
select o.id, o.referral_doctor_id, round(coalesce(o.subtotal, 0) * 0.10, 2)
from doctors.shop_orders o
where o.payment_status = 'paid'
  and exists (select 1 from doctors.doctor_registrations d where d.id = o.referral_doctor_id)
on conflict (order_id) do nothing
returning order_id, partner_id, amount;
