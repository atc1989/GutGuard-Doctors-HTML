-- Move direct orders of Jerick Quijano (#10115) to his downline Daryl Joel Dumdum, as if Dumdum
-- sold them. Dumdum gets the points as direct (depth 0); Quijano keeps the same points as pass-up
-- (depth 1). Quijano's total does not change.
--
-- Requested: <who, date, reason>
--
-- Fill in v_codes, preview with the SELECT at the bottom, run on sandbox first (swap doctors ->
-- sandbox for shop_orders / partner_points / order_points). Everything aborts if any check fails.
-- Re-running after it succeeded aborts on "not Quijano's order" and changes nothing.

DO $$
DECLARE
  v_codes text[] := ARRAY[]::text[];  -- e.g. ARRAY['GG-20261026-00000000']
  v_quijano doctors.doctor_registrations%ROWTYPE;
  v_dumdum doctors.doctor_registrations%ROWTYPE;
  v_code text;
  v_order doctors.shop_orders%ROWTYPE;
BEGIN
  IF cardinality(v_codes) = 0 THEN
    RAISE EXCEPTION 'Fill in v_codes first.';
  END IF;

  SELECT * INTO v_quijano FROM doctors.doctor_registrations WHERE partner_code = 10115;
  IF v_quijano.id IS NULL THEN
    RAISE EXCEPTION 'Partner #10115 not found.';
  END IF;

  SELECT * INTO v_dumdum FROM doctors.doctor_registrations
  WHERE full_name = 'Daryl Joel Dumdum' AND referred_by_partner_id = v_quijano.id;
  IF v_dumdum.id IS NULL THEN
    RAISE EXCEPTION 'Daryl Joel Dumdum is not a partner directly under #10115.';
  END IF;

  FOREACH v_code IN ARRAY v_codes LOOP
    SELECT * INTO v_order FROM doctors.shop_orders WHERE order_code = v_code FOR UPDATE;
    IF v_order.id IS NULL THEN
      RAISE EXCEPTION 'Order % not found.', v_code;
    END IF;
    IF v_order.referral_doctor_id IS DISTINCT FROM v_quijano.id THEN
      RAISE EXCEPTION 'Order % is not Quijano''s direct order.', v_code;
    END IF;

    DELETE FROM doctors.partner_points WHERE order_id = v_order.id;

    UPDATE doctors.shop_orders
    SET referral_doctor_id = v_dumdum.id, referral_slug = v_dumdum.routing_slug
    WHERE id = v_order.id;

    -- Unpaid orders get their points from trigger_award_points when they are paid.
    IF v_order.payment_status = 'paid' THEN
      INSERT INTO doctors.partner_points (order_id, partner_id, points, depth)
      VALUES (v_order.id, v_dumdum.id, doctors.order_points(v_order.items), 0),
             (v_order.id, v_quijano.id, doctors.order_points(v_order.items), 1);
    END IF;

    RAISE NOTICE 'Moved % to Dumdum (% pts each)', v_code, doctors.order_points(v_order.items);
  END LOOP;
END $$;

-- Preview: Quijano's direct orders, newest first
-- SELECT so.order_code, so.created_at, so.payment_status, so.items, doctors.order_points(so.items) AS points
-- FROM doctors.shop_orders so
-- JOIN doctors.doctor_registrations d ON d.id = so.referral_doctor_id
-- WHERE d.partner_code = 10115
-- ORDER BY so.created_at DESC;
