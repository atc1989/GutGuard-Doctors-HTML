-- Calculate retroactive points for SANDBOX
DO $$
DECLARE
  v_order RECORD;
  v_points INTEGER;
  v_grandparent_id UUID;
BEGIN
  FOR v_order IN SELECT id, referral_doctor_id, total_amount FROM sandbox.shop_orders WHERE payment_status = 'paid' AND referral_doctor_id IS NOT NULL
  LOOP
    -- Calculate points
    v_points := FLOOR(COALESCE(v_order.total_amount, 0) / 1000);
    IF v_points < 1 THEN v_points := 1; END IF;

    -- Direct (Depth 0)
    INSERT INTO sandbox.partner_points (order_id, partner_id, points, depth)
    VALUES (v_order.id, v_order.referral_doctor_id, v_points, 0) ON CONFLICT DO NOTHING;
    
    -- Pass-up (Depth 1)
    SELECT referred_by_partner_id INTO v_grandparent_id 
    FROM doctors.doctor_registrations WHERE id = v_order.referral_doctor_id;

    IF v_grandparent_id IS NOT NULL THEN
      INSERT INTO sandbox.partner_points (order_id, partner_id, points, depth)
      VALUES (v_order.id, v_grandparent_id, v_points, 1) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- Calculate retroactive points for DOCTORS
DO $$
DECLARE
  v_order RECORD;
  v_points INTEGER;
  v_grandparent_id UUID;
BEGIN
  FOR v_order IN SELECT id, referral_doctor_id, total_amount FROM doctors.shop_orders WHERE payment_status = 'paid' AND referral_doctor_id IS NOT NULL
  LOOP
    -- Calculate points
    v_points := FLOOR(COALESCE(v_order.total_amount, 0) / 1000);
    IF v_points < 1 THEN v_points := 1; END IF;

    -- Direct (Depth 0)
    INSERT INTO doctors.partner_points (order_id, partner_id, points, depth)
    VALUES (v_order.id, v_order.referral_doctor_id, v_points, 0) ON CONFLICT DO NOTHING;
    
    -- Pass-up (Depth 1)
    SELECT referred_by_partner_id INTO v_grandparent_id 
    FROM doctors.doctor_registrations WHERE id = v_order.referral_doctor_id;

    IF v_grandparent_id IS NOT NULL THEN
      INSERT INTO doctors.partner_points (order_id, partner_id, points, depth)
      VALUES (v_order.id, v_grandparent_id, v_points, 1) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;
