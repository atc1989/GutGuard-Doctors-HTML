-- Wallet earnings (sandbox schema only; the other schema has its own file with the same body).
--   1. Commission: 10% of the products subtotal (shipping not included) of every paid order,
--      credited to the partner whose shop link sold it. From this migration on; no backfill.
--   2. Convert: a partner turns direct G-Points into cash in their wallet:
--      300 pts = PHP 18,000, 750 pts = PHP 70,000, 1,500 pts = PHP 150,000.
--      Only the converted points are used up; the rest stay.
-- Refunds do not take commissions or conversions back yet (planned separately).
-- Requires 20261030000000_partner_wallet.sql.

-- 1. Commissions
CREATE TABLE IF NOT EXISTS sandbox.partner_commissions (
  order_id uuid PRIMARY KEY,
  partner_id uuid NOT NULL REFERENCES doctors.doctor_registrations(id),
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sandbox_partner_commissions_partner ON sandbox.partner_commissions (partner_id);
ALTER TABLE sandbox.partner_commissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE sandbox.partner_commissions FROM PUBLIC, anon, authenticated;

-- Fires on the same pending -> paid change as award_order_points, once per order (primary key).
CREATE OR REPLACE FUNCTION sandbox.credit_order_commission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sandbox, doctors, public
AS $$
BEGIN
  BEGIN
    IF NEW.referral_doctor_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM doctors.doctor_registrations d WHERE d.id = NEW.referral_doctor_id) THEN
      INSERT INTO sandbox.partner_commissions (order_id, partner_id, amount)
      VALUES (NEW.id, NEW.referral_doctor_id, round(coalesce(NEW.subtotal, 0) * 0.10, 2))
      ON CONFLICT (order_id) DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Same rule as the points trigger: a commission error never fails the payment.
    RAISE WARNING 'sandbox.credit_order_commission skipped order %: % (%)', NEW.id, SQLERRM, SQLSTATE;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION sandbox.credit_order_commission() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trigger_credit_commission ON sandbox.shop_orders;
CREATE TRIGGER trigger_credit_commission
  AFTER UPDATE OF payment_status ON sandbox.shop_orders
  FOR EACH ROW WHEN (NEW.payment_status = 'paid' AND OLD.payment_status <> 'paid')
  EXECUTE FUNCTION sandbox.credit_order_commission();

-- 2. Point conversions
CREATE TABLE IF NOT EXISTS sandbox.partner_point_conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES doctors.doctor_registrations(id),
  points integer NOT NULL CHECK (points IN (300, 750, 1500)),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sandbox_partner_point_conversions_partner ON sandbox.partner_point_conversions (partner_id);
ALTER TABLE sandbox.partner_point_conversions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE sandbox.partner_point_conversions FROM PUBLIC, anon, authenticated;

-- Direct (depth 0) G-Points not converted yet.
-- ponytail: a refund deletes the order's points (revoke_order_points), so this can go below 0
-- after a conversion; it then blocks new conversions until earned back. Refund rules come later.
CREATE OR REPLACE FUNCTION sandbox.partner_direct_points_available(p_partner_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = sandbox, doctors, public
AS $$
  SELECT (
    coalesce((SELECT sum(pp.points) FROM sandbox.partner_points pp WHERE pp.partner_id = p_partner_id AND pp.depth = 0), 0)
    - coalesce((SELECT sum(c.points) FROM sandbox.partner_point_conversions c WHERE c.partner_id = p_partner_id), 0)
  )::integer;
$$;
REVOKE ALL ON FUNCTION sandbox.partner_direct_points_available(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION sandbox.convert_partner_points(p_points integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sandbox, doctors, public
AS $$
DECLARE
  v_email text := nullif(lower(trim(coalesce(auth.jwt() ->> 'email', ''))), '');
  v_partner_id uuid;
  v_amount numeric := CASE p_points WHEN 300 THEN 18000 WHEN 750 THEN 70000 WHEN 1500 THEN 150000 END;
  v_row sandbox.partner_point_conversions;
BEGIN
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Sign in to convert points.' USING ERRCODE = '42501';
  END IF;
  -- Row lock serialises two conversions at once, so the same points cannot be converted twice.
  SELECT d.id INTO v_partner_id FROM doctors.doctor_registrations d WHERE d.email = v_email LIMIT 1 FOR UPDATE;
  IF v_partner_id IS NULL THEN
    RAISE EXCEPTION 'This email is not registered as a GutGuard partner.' USING ERRCODE = '42501';
  END IF;
  IF v_amount IS NULL THEN
    RAISE EXCEPTION 'Convert 300, 750 or 1,500 points.' USING ERRCODE = '22023';
  END IF;
  IF sandbox.partner_direct_points_available(v_partner_id) < p_points THEN
    RAISE EXCEPTION 'You do not have enough direct G-Points to convert.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO sandbox.partner_point_conversions (partner_id, points, amount)
  VALUES (v_partner_id, p_points, v_amount)
  RETURNING * INTO v_row;
  RETURN to_jsonb(v_row) - 'partner_id';
END;
$$;
REVOKE ALL ON FUNCTION sandbox.convert_partner_points(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION sandbox.convert_partner_points(integer) TO authenticated;

-- 3. Balance now counts commissions and conversions as well as milestone rebates.
CREATE OR REPLACE FUNCTION sandbox.partner_wallet_balance(p_partner_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = sandbox, doctors, public
AS $$
  SELECT jsonb_build_object(
    'earned', e.rebates + e.commissions + e.converted,
    'rebates', e.rebates,
    'commissions', e.commissions,
    'converted', e.converted,
    'direct_points', sandbox.partner_direct_points_available(p_partner_id),
    'pending', w.pending,
    'withdrawn', w.withdrawn,
    'available', e.rebates + e.commissions + e.converted - w.pending - w.withdrawn
  )
  FROM (
    SELECT
      -- ponytail: rebates already marked 'paid' were settled outside the wallet.
      coalesce((SELECT sum(m.rebate_amount) FROM sandbox.milestone_unlocks m
                WHERE m.partner_id = p_partner_id AND coalesce(m.status, 'unlocked') <> 'paid'), 0) AS rebates,
      coalesce((SELECT sum(c.amount) FROM sandbox.partner_commissions c WHERE c.partner_id = p_partner_id), 0) AS commissions,
      coalesce((SELECT sum(v.amount) FROM sandbox.partner_point_conversions v WHERE v.partner_id = p_partner_id), 0) AS converted
  ) e,
  (
    SELECT
      coalesce(sum(amount) FILTER (WHERE status = 'pending'), 0) AS pending,
      coalesce(sum(amount) FILTER (WHERE status = 'approved'), 0) AS withdrawn
    FROM sandbox.partner_withdrawals
    WHERE partner_id = p_partner_id
  ) w;
$$;
REVOKE ALL ON FUNCTION sandbox.partner_wallet_balance(uuid) FROM PUBLIC, anon, authenticated;

-- 4. Wallet: balance, withdrawals, and every credit (commission, conversion, rebate), newest first.
CREATE OR REPLACE FUNCTION sandbox.partner_wallet()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = sandbox, doctors, public
AS $$
DECLARE
  v_email text := nullif(lower(trim(coalesce(auth.jwt() ->> 'email', ''))), '');
  v_partner_id uuid;
BEGIN
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Sign in to view your wallet.' USING ERRCODE = '42501';
  END IF;
  SELECT d.id INTO v_partner_id FROM doctors.doctor_registrations d WHERE d.email = v_email LIMIT 1;
  IF v_partner_id IS NULL THEN
    RAISE EXCEPTION 'This email is not registered as a GutGuard partner.' USING ERRCODE = '42501';
  END IF;

  RETURN sandbox.partner_wallet_balance(v_partner_id) || jsonb_build_object(
    'withdrawals', coalesce((
      SELECT jsonb_agg(to_jsonb(w) - 'partner_id' ORDER BY w.created_at DESC)
      FROM sandbox.partner_withdrawals w
      WHERE w.partner_id = v_partner_id
    ), '[]'::jsonb),
    'credits', coalesce((
      SELECT jsonb_agg(c ORDER BY c->>'created_at' DESC)
      FROM (
        SELECT jsonb_build_object('type', 'commission', 'amount', pc.amount, 'order_code', o.order_code,
                                  'subtotal', o.subtotal, 'created_at', pc.created_at) AS c
        FROM sandbox.partner_commissions pc
        LEFT JOIN sandbox.shop_orders o ON o.id = pc.order_id
        WHERE pc.partner_id = v_partner_id
        UNION ALL
        SELECT jsonb_build_object('type', 'conversion', 'amount', v.amount, 'points', v.points, 'created_at', v.created_at)
        FROM sandbox.partner_point_conversions v
        WHERE v.partner_id = v_partner_id
        UNION ALL
        SELECT jsonb_build_object('type', 'rebate', 'amount', m.rebate_amount, 'points', m.milestone_pts, 'created_at', m.created_at)
        FROM sandbox.milestone_unlocks m
        WHERE m.partner_id = v_partner_id AND coalesce(m.status, 'unlocked') <> 'paid'
      ) credits
    ), '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION sandbox.partner_wallet() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION sandbox.partner_wallet() TO authenticated;
