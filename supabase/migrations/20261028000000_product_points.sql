-- E-Points per product instead of 1 point per PHP 1,000 of the order total.
--
--   Blister Trial 1 · Bottle Trial 3 · Start 3 · Grow 12 · Peak 33   (per unit, times qty)
--
-- products.points holds the value; NULL (a product added later without a value) or an item
-- id that is not in products falls back to the old rule for that line: floor(price * qty / 1000).
-- Shipping no longer earns points. An order still earns at least 1 point.
--
-- The award trigger keeps everything from 20261008000000 (never fails the payment, sandbox does
-- not promote production partners); only the points maths changes.
--
-- Past orders keep the points they were given. To recompute them with this rule run
-- supabase/data-fixes/20261028_recompute_product_points.sql (sandbox first).

-- 1. points column on products
ALTER TABLE doctors.products ADD COLUMN IF NOT EXISTS points integer CHECK (points >= 0);
ALTER TABLE sandbox.products ADD COLUMN IF NOT EXISTS points integer CHECK (points >= 0);

UPDATE doctors.products p SET points = v.points
FROM (VALUES ('trial-blister', 1), ('trial-bottle', 3), ('start', 3), ('grow', 12), ('peak', 33)) v(id, points)
WHERE p.id = v.id;

UPDATE sandbox.products p SET points = v.points
FROM (VALUES ('trial-blister', 1), ('trial-bottle', 3), ('start', 3), ('grow', 12), ('peak', 33)) v(id, points)
WHERE p.id = v.id;

-- 2. Points for an order's items ([{ id, qty, price, ... }])
CREATE OR REPLACE FUNCTION doctors.order_points(p_items jsonb) RETURNS integer
LANGUAGE sql
STABLE
SET search_path = doctors, public
AS $$
  SELECT greatest(coalesce(sum(
    coalesce(
      p.points * greatest(coalesce(nullif(item ->> 'qty', '')::numeric, 1), 0),
      floor(coalesce(nullif(item ->> 'price', '')::numeric, 0)
            * greatest(coalesce(nullif(item ->> 'qty', '')::numeric, 1), 0) / 1000)
    )
  ), 0)::integer, 1)
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_items) = 'array' THEN p_items ELSE '[]'::jsonb END) item
  LEFT JOIN doctors.products p ON p.id = item ->> 'id';
$$;

CREATE OR REPLACE FUNCTION sandbox.order_points(p_items jsonb) RETURNS integer
LANGUAGE sql
STABLE
SET search_path = sandbox, public
AS $$
  SELECT greatest(coalesce(sum(
    coalesce(
      p.points * greatest(coalesce(nullif(item ->> 'qty', '')::numeric, 1), 0),
      floor(coalesce(nullif(item ->> 'price', '')::numeric, 0)
            * greatest(coalesce(nullif(item ->> 'qty', '')::numeric, 1), 0) / 1000)
    )
  ), 0)::integer, 1)
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_items) = 'array' THEN p_items ELSE '[]'::jsonb END) item
  LEFT JOIN sandbox.products p ON p.id = item ->> 'id';
$$;

-- 3. Award triggers use it
CREATE OR REPLACE FUNCTION doctors.award_order_points() RETURNS trigger
LANGUAGE plpgsql
SET search_path = doctors, public
AS $$
DECLARE
  v_points integer;
  v_partner doctors.doctor_registrations%ROWTYPE;
BEGIN
  IF NEW.referral_doctor_id IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    -- Per-product points (see doctors.order_points). Inside the block so a bad items payload
    -- skips the points instead of failing the payment.
    v_points := doctors.order_points(NEW.items);

    SELECT * INTO v_partner FROM doctors.doctor_registrations WHERE id = NEW.referral_doctor_id;
    IF v_partner.id IS NULL THEN
      RETURN NEW;
    END IF;

    INSERT INTO doctors.partner_points (order_id, partner_id, points, depth)
    VALUES (NEW.id, v_partner.id, v_points, 0)
    ON CONFLICT (order_id, partner_id) DO NOTHING;

    IF v_partner.referred_by_partner_id IS NOT NULL THEN
      INSERT INTO doctors.partner_points (order_id, partner_id, points, depth)
      VALUES (NEW.id, v_partner.referred_by_partner_id, v_points, 1)
      ON CONFLICT (order_id, partner_id) DO NOTHING;
    END IF;

    -- First paid sale promotes an affiliate. The store_type guard in the WHERE makes two
    -- concurrent first sales produce one promotion, not two audit rows.
    UPDATE doctors.doctor_registrations
    SET store_type = 'lifestyle', referral_qr_enabled = true, promoted_at = now(), promoted_by = 'auto'
    WHERE id = v_partner.id AND store_type = 'affiliate';
    IF FOUND THEN
      INSERT INTO doctors.store_promotions (partner_id, from_type, to_type, trigger_type, trigger_order_id)
      VALUES (v_partner.id, 'affiliate', 'lifestyle', 'first_sale', NEW.id);
    END IF;

  EXCEPTION WHEN OTHERS THEN
    -- This runs inside the payment UPDATE. A points failure must not roll the payment back
    -- (the webhook would 500 forever and the buyer would be asked to pay again). Points can be
    -- re-awarded later: the insert is idempotent on (order_id, partner_id).
    RAISE WARNING 'doctors.award_order_points skipped order %: % (%)', NEW.id, SQLERRM, SQLSTATE;
  END;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION sandbox.award_order_points() RETURNS trigger
LANGUAGE plpgsql
SET search_path = sandbox, doctors, public
AS $$
DECLARE
  v_points integer;
  v_partner doctors.doctor_registrations%ROWTYPE;
BEGIN
  IF NEW.referral_doctor_id IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_points := sandbox.order_points(NEW.items);

    SELECT * INTO v_partner FROM doctors.doctor_registrations WHERE id = NEW.referral_doctor_id;
    IF v_partner.id IS NULL THEN
      RETURN NEW;
    END IF;

    INSERT INTO sandbox.partner_points (order_id, partner_id, points, depth)
    VALUES (NEW.id, v_partner.id, v_points, 0)
    ON CONFLICT (order_id, partner_id) DO NOTHING;

    IF v_partner.referred_by_partner_id IS NOT NULL THEN
      INSERT INTO sandbox.partner_points (order_id, partner_id, points, depth)
      VALUES (NEW.id, v_partner.referred_by_partner_id, v_points, 1)
      ON CONFLICT (order_id, partner_id) DO NOTHING;
    END IF;

    -- Partners are shared with production (there is no sandbox.doctor_registrations), so a QA
    -- payment must not promote a real partner. Auto-promotion runs from doctors.award_order_points only.

  EXCEPTION WHEN OTHERS THEN
    -- This runs inside the payment UPDATE. A points failure must not roll the payment back
    -- (the webhook would 500 forever and the buyer would be asked to pay again). Points can be
    -- re-awarded later: the insert is idempotent on (order_id, partner_id).
    RAISE WARNING 'sandbox.award_order_points skipped order %: % (%)', NEW.id, SQLERRM, SQLSTATE;
  END;

  RETURN NEW;
END;
$$;
