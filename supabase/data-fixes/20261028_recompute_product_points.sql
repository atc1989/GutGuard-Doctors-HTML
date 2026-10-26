-- Recompute E-Points on past paid orders with the per-product rule from
-- 20261028000000_product_points.sql (run that migration first). Run on sandbox first.
--
-- Updates every existing points row (the seller's and the upline's, including pass-up points an
-- admin assigned) to order_points(items). Most orders go up (e.g. 3 x Peak: 89 -> 99), but
-- Bottle Trial goes down (4 -> 3 per bottle) and shipping no longer counts.
-- Re-running it changes nothing. Preview first with the SELECT at the bottom.

BEGIN;

UPDATE sandbox.partner_points pp
SET points = sandbox.order_points(so.items)
FROM sandbox.shop_orders so
WHERE so.id = pp.order_id
  AND pp.points IS DISTINCT FROM sandbox.order_points(so.items);

UPDATE doctors.partner_points pp
SET points = doctors.order_points(so.items)
FROM doctors.shop_orders so
WHERE so.id = pp.order_id
  AND pp.points IS DISTINCT FROM doctors.order_points(so.items);

COMMIT;

-- Preview (run before the UPDATEs; swap doctors -> sandbox for the QA mirror):
-- SELECT so.order_code, dr.full_name, pp.depth, pp.points AS old_points,
--        doctors.order_points(so.items) AS new_points
-- FROM doctors.partner_points pp
-- JOIN doctors.shop_orders so ON so.id = pp.order_id
-- JOIN doctors.doctor_registrations dr ON dr.id = pp.partner_id
-- WHERE pp.points IS DISTINCT FROM doctors.order_points(so.items)
-- ORDER BY so.created_at;
