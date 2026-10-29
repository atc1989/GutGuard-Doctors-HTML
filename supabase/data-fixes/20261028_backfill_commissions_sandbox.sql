-- SANDBOX (QA) (sandbox schema only; the other schema has its own file).
--
-- The 10% commission (20261101000000_wallet_earnings_*) only credits orders that turn paid
-- after it was installed. This credits the orders that were already paid: 10% of the
-- products subtotal (no shipping) to the partner whose link sold each order.
-- Same amount and rule as credit_order_commission. Re-runnable: one commission per order.
-- Run this first, then the _doctors file.

insert into sandbox.partner_commissions (order_id, partner_id, amount)
select o.id, o.referral_doctor_id, round(coalesce(o.subtotal, 0) * 0.10, 2)
from sandbox.shop_orders o
where o.payment_status = 'paid'
  and exists (select 1 from doctors.doctor_registrations d where d.id = o.referral_doctor_id)
on conflict (order_id) do nothing
returning order_id, partner_id, amount;
