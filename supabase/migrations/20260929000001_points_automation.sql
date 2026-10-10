-- This file originally began by TRUNCATE-ing sandbox/doctors partner_points and
-- milestone_unlocks to clear dummy data. That ran once (2026-09-29). It is removed so that a
-- re-run (e.g. `supabase db push` without `migration repair`) cannot wipe live balances.

-- Automated Points Trigger for SANDBOX
CREATE OR REPLACE FUNCTION sandbox.award_order_points() RETURNS trigger AS $$
DECLARE
  v_points INTEGER;
  v_grandparent_id UUID;
BEGIN
  -- 1. Calculate points (1 point per ₱1000 spent)
  v_points := FLOOR(COALESCE(NEW.total_amount, 0) / 1000);
  IF v_points < 1 THEN
    v_points := 1; -- Minimum 1 point for any paid order
  END IF;

  -- 2. Award Direct Points (Depth 0)
  IF NEW.referral_doctor_id IS NOT NULL THEN
    INSERT INTO sandbox.partner_points (order_id, partner_id, points, depth)
    VALUES (NEW.id, NEW.referral_doctor_id, v_points, 0)
    ON CONFLICT (order_id, partner_id) DO NOTHING;
    
    -- 3. Award Pass-Up Points to Downline (Depth 1)
    SELECT referred_by_partner_id INTO v_grandparent_id 
    FROM doctors.doctor_registrations WHERE id = NEW.referral_doctor_id;

    IF v_grandparent_id IS NOT NULL THEN
      INSERT INTO sandbox.partner_points (order_id, partner_id, points, depth)
      VALUES (NEW.id, v_grandparent_id, v_points, 1)
      ON CONFLICT (order_id, partner_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_award_points ON sandbox.shop_orders;
CREATE TRIGGER trigger_award_points
  AFTER UPDATE OF payment_status ON sandbox.shop_orders
  FOR EACH ROW
  WHEN (NEW.payment_status = 'paid' AND OLD.payment_status != 'paid')
  EXECUTE FUNCTION sandbox.award_order_points();

-- Automated Points Trigger for DOCTORS
CREATE OR REPLACE FUNCTION doctors.award_order_points() RETURNS trigger AS $$
DECLARE
  v_points INTEGER;
  v_grandparent_id UUID;
BEGIN
  -- 1. Calculate points (1 point per ₱1000 spent)
  v_points := FLOOR(COALESCE(NEW.total_amount, 0) / 1000);
  IF v_points < 1 THEN
    v_points := 1; -- Minimum 1 point for any paid order
  END IF;

  -- 2. Award Direct Points (Depth 0)
  IF NEW.referral_doctor_id IS NOT NULL THEN
    INSERT INTO doctors.partner_points (order_id, partner_id, points, depth)
    VALUES (NEW.id, NEW.referral_doctor_id, v_points, 0)
    ON CONFLICT (order_id, partner_id) DO NOTHING;
    
    -- 3. Award Pass-Up Points to Downline (Depth 1)
    SELECT referred_by_partner_id INTO v_grandparent_id 
    FROM doctors.doctor_registrations WHERE id = NEW.referral_doctor_id;

    IF v_grandparent_id IS NOT NULL THEN
      INSERT INTO doctors.partner_points (order_id, partner_id, points, depth)
      VALUES (NEW.id, v_grandparent_id, v_points, 1)
      ON CONFLICT (order_id, partner_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_award_points ON doctors.shop_orders;
CREATE TRIGGER trigger_award_points
  AFTER UPDATE OF payment_status ON doctors.shop_orders
  FOR EACH ROW
  WHEN (NEW.payment_status = 'paid' AND OLD.payment_status != 'paid')
  EXECUTE FUNCTION doctors.award_order_points();
