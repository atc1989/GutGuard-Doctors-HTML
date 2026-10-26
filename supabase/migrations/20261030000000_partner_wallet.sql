-- Partner wallet: partners withdraw their milestone rebates (milestone_unlocks) to GCash, Maya or a bank.
-- Minimum PHP 500, a fixed PHP 60 fee off the requested amount, and admin approves or rejects each request.
-- Same table and RPCs in doctors and sandbox (rebates are per schema; partners are shared).
-- Partner RPCs are called through supabaseShop, admin RPCs through supabaseAdminShop.
--
-- As of this migration nothing inserts into milestone_unlocks, so balances stay PHP 0 until
-- rebate crediting is built.

-- ===================== doctors =====================
-- 0. Withdrawal requests
CREATE TABLE IF NOT EXISTS doctors.partner_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES doctors.doctor_registrations(id),
  amount numeric(12,2) NOT NULL CHECK (amount >= 500),
  fee numeric(12,2) NOT NULL DEFAULT 60 CHECK (fee >= 0 AND fee < amount),
  method text NOT NULL CHECK (method IN ('gcash', 'maya', 'bank')),
  bank_name text NOT NULL DEFAULT '',
  account_name text NOT NULL,
  account_number text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reference text NOT NULL DEFAULT '',
  admin_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_doctors_partner_withdrawals_partner ON doctors.partner_withdrawals (partner_id, created_at DESC);
ALTER TABLE doctors.partner_withdrawals ENABLE ROW LEVEL SECURITY;
-- Only the security definer RPCs below read or write it.
REVOKE ALL ON TABLE doctors.partner_withdrawals FROM PUBLIC, anon, authenticated;

-- Balance = rebates earned - withdrawals still pending or approved (a rejection gives the money back).
-- ponytail: rebates already marked 'paid' were settled outside the wallet, so they are not withdrawable.
CREATE OR REPLACE FUNCTION doctors.partner_wallet_balance(p_partner_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = doctors, doctors, public
AS $$
  SELECT jsonb_build_object(
    'earned', e.earned,
    'pending', w.pending,
    'withdrawn', w.withdrawn,
    'available', e.earned - w.pending - w.withdrawn
  )
  FROM (
    SELECT coalesce(sum(m.rebate_amount), 0) AS earned
    FROM doctors.milestone_unlocks m
    WHERE m.partner_id = p_partner_id AND coalesce(m.status, 'unlocked') <> 'paid'
  ) e,
  (
    SELECT
      coalesce(sum(amount) FILTER (WHERE status = 'pending'), 0) AS pending,
      coalesce(sum(amount) FILTER (WHERE status = 'approved'), 0) AS withdrawn
    FROM doctors.partner_withdrawals
    WHERE partner_id = p_partner_id
  ) w;
$$;
REVOKE ALL ON FUNCTION doctors.partner_wallet_balance(uuid) FROM PUBLIC, anon, authenticated;

-- 1. Partner: balance and history (signed-in partner, found by email like partner_dashboard)
CREATE OR REPLACE FUNCTION doctors.partner_wallet()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = doctors, doctors, public
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

  RETURN doctors.partner_wallet_balance(v_partner_id) || jsonb_build_object(
    'withdrawals', coalesce((
      SELECT jsonb_agg(to_jsonb(w) - 'partner_id' ORDER BY w.created_at DESC)
      FROM doctors.partner_withdrawals w
      WHERE w.partner_id = v_partner_id
    ), '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION doctors.partner_wallet() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION doctors.partner_wallet() TO authenticated;

-- 2. Partner: request a withdrawal. The fixed PHP 60 fee comes off the requested amount.
CREATE OR REPLACE FUNCTION doctors.request_partner_withdrawal(
  p_amount numeric,
  p_method text,
  p_account_name text,
  p_account_number text,
  p_bank_name text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = doctors, doctors, public
AS $$
DECLARE
  v_email text := nullif(lower(trim(coalesce(auth.jwt() ->> 'email', ''))), '');
  v_partner_id uuid;
  v_available numeric;
  v_method text := lower(trim(coalesce(p_method, '')));
  v_bank text := left(trim(coalesce(p_bank_name, '')), 80);
  v_row doctors.partner_withdrawals;
BEGIN
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Sign in to request a withdrawal.' USING ERRCODE = '42501';
  END IF;
  -- Row lock on the partner serialises two requests at once, so both cannot spend the same balance.
  SELECT d.id INTO v_partner_id FROM doctors.doctor_registrations d WHERE d.email = v_email LIMIT 1 FOR UPDATE;
  IF v_partner_id IS NULL THEN
    RAISE EXCEPTION 'This email is not registered as a GutGuard partner.' USING ERRCODE = '42501';
  END IF;

  IF p_amount IS NULL OR p_amount < 500 THEN
    RAISE EXCEPTION 'The minimum withdrawal is PHP 500.' USING ERRCODE = '22023';
  END IF;
  IF p_amount <> round(p_amount, 2) THEN
    RAISE EXCEPTION 'Enter an amount in pesos and centavos.' USING ERRCODE = '22023';
  END IF;
  IF v_method NOT IN ('gcash', 'maya', 'bank') THEN
    RAISE EXCEPTION 'Choose GCash, Maya or bank transfer.' USING ERRCODE = '22023';
  END IF;
  IF v_method <> 'bank' THEN
    v_bank := '';
  ELSIF v_bank = '' THEN
    RAISE EXCEPTION 'Enter the bank name.' USING ERRCODE = '22023';
  END IF;
  IF trim(coalesce(p_account_name, '')) = '' OR trim(coalesce(p_account_number, '')) = '' THEN
    RAISE EXCEPTION 'Enter the account name and number.' USING ERRCODE = '22023';
  END IF;

  v_available := (doctors.partner_wallet_balance(v_partner_id) ->> 'available')::numeric;
  IF p_amount > v_available THEN
    RAISE EXCEPTION 'That is more than your available balance.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO doctors.partner_withdrawals (partner_id, amount, fee, method, bank_name, account_name, account_number)
  VALUES (v_partner_id, p_amount, 60, v_method, v_bank, left(trim(p_account_name), 120), left(trim(p_account_number), 40))
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row) - 'partner_id';
END;
$$;
REVOKE ALL ON FUNCTION doctors.request_partner_withdrawal(numeric, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION doctors.request_partner_withdrawal(numeric, text, text, text, text) TO authenticated;

-- 3. Admin: every request with the partner's contact details, pending first
CREATE OR REPLACE FUNCTION doctors.admin_list_partner_withdrawals(p_admin_password text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = doctors, doctors, public
AS $$
BEGIN
  PERFORM doctors.assert_wheel_admin(p_admin_password);

  RETURN coalesce((
    SELECT jsonb_agg(
      to_jsonb(w) || jsonb_build_object(
        'partner_name', d.full_name,
        'partner_email', d.email,
        'partner_mobile', d.mobile
      ) ORDER BY (w.status = 'pending') DESC, w.created_at DESC
    )
    FROM doctors.partner_withdrawals w
    JOIN doctors.doctor_registrations d ON d.id = w.partner_id
  ), '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION doctors.admin_list_partner_withdrawals(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION doctors.admin_list_partner_withdrawals(text) TO service_role;

-- 4. Admin: approve (with the transfer reference) or reject (with a reason). Pending requests only.
CREATE OR REPLACE FUNCTION doctors.admin_process_partner_withdrawal(
  p_admin_password text,
  p_id uuid,
  p_status text,
  p_reference text DEFAULT '',
  p_note text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = doctors, doctors, public
AS $$
DECLARE
  v_row doctors.partner_withdrawals;
BEGIN
  PERFORM doctors.assert_wheel_admin(p_admin_password);

  IF p_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Status must be approved or rejected.' USING ERRCODE = '22023';
  END IF;
  IF p_status = 'approved' AND trim(coalesce(p_reference, '')) = '' THEN
    RAISE EXCEPTION 'Enter the transfer reference number.' USING ERRCODE = '22023';
  END IF;
  IF p_status = 'rejected' AND trim(coalesce(p_note, '')) = '' THEN
    RAISE EXCEPTION 'Enter a reason for rejecting.' USING ERRCODE = '22023';
  END IF;

  UPDATE doctors.partner_withdrawals
  SET status = p_status,
      reference = left(trim(coalesce(p_reference, '')), 120),
      admin_note = left(trim(coalesce(p_note, '')), 500),
      processed_at = now()
  WHERE id = p_id AND status = 'pending'
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'This request was not found or was already processed.' USING ERRCODE = 'P0002';
  END IF;
  RETURN to_jsonb(v_row);
END;
$$;
REVOKE ALL ON FUNCTION doctors.admin_process_partner_withdrawal(text, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION doctors.admin_process_partner_withdrawal(text, uuid, text, text, text) TO service_role;

-- ===================== sandbox =====================
-- 0. Withdrawal requests
CREATE TABLE IF NOT EXISTS sandbox.partner_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES doctors.doctor_registrations(id),
  amount numeric(12,2) NOT NULL CHECK (amount >= 500),
  fee numeric(12,2) NOT NULL DEFAULT 60 CHECK (fee >= 0 AND fee < amount),
  method text NOT NULL CHECK (method IN ('gcash', 'maya', 'bank')),
  bank_name text NOT NULL DEFAULT '',
  account_name text NOT NULL,
  account_number text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reference text NOT NULL DEFAULT '',
  admin_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_sandbox_partner_withdrawals_partner ON sandbox.partner_withdrawals (partner_id, created_at DESC);
ALTER TABLE sandbox.partner_withdrawals ENABLE ROW LEVEL SECURITY;
-- Only the security definer RPCs below read or write it.
REVOKE ALL ON TABLE sandbox.partner_withdrawals FROM PUBLIC, anon, authenticated;

-- Balance = rebates earned - withdrawals still pending or approved (a rejection gives the money back).
-- ponytail: rebates already marked 'paid' were settled outside the wallet, so they are not withdrawable.
CREATE OR REPLACE FUNCTION sandbox.partner_wallet_balance(p_partner_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = sandbox, doctors, public
AS $$
  SELECT jsonb_build_object(
    'earned', e.earned,
    'pending', w.pending,
    'withdrawn', w.withdrawn,
    'available', e.earned - w.pending - w.withdrawn
  )
  FROM (
    SELECT coalesce(sum(m.rebate_amount), 0) AS earned
    FROM sandbox.milestone_unlocks m
    WHERE m.partner_id = p_partner_id AND coalesce(m.status, 'unlocked') <> 'paid'
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

-- 1. Partner: balance and history (signed-in partner, found by email like partner_dashboard)
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
    ), '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION sandbox.partner_wallet() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION sandbox.partner_wallet() TO authenticated;

-- 2. Partner: request a withdrawal. The fixed PHP 60 fee comes off the requested amount.
CREATE OR REPLACE FUNCTION sandbox.request_partner_withdrawal(
  p_amount numeric,
  p_method text,
  p_account_name text,
  p_account_number text,
  p_bank_name text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sandbox, doctors, public
AS $$
DECLARE
  v_email text := nullif(lower(trim(coalesce(auth.jwt() ->> 'email', ''))), '');
  v_partner_id uuid;
  v_available numeric;
  v_method text := lower(trim(coalesce(p_method, '')));
  v_bank text := left(trim(coalesce(p_bank_name, '')), 80);
  v_row sandbox.partner_withdrawals;
BEGIN
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Sign in to request a withdrawal.' USING ERRCODE = '42501';
  END IF;
  -- Row lock on the partner serialises two requests at once, so both cannot spend the same balance.
  SELECT d.id INTO v_partner_id FROM doctors.doctor_registrations d WHERE d.email = v_email LIMIT 1 FOR UPDATE;
  IF v_partner_id IS NULL THEN
    RAISE EXCEPTION 'This email is not registered as a GutGuard partner.' USING ERRCODE = '42501';
  END IF;

  IF p_amount IS NULL OR p_amount < 500 THEN
    RAISE EXCEPTION 'The minimum withdrawal is PHP 500.' USING ERRCODE = '22023';
  END IF;
  IF p_amount <> round(p_amount, 2) THEN
    RAISE EXCEPTION 'Enter an amount in pesos and centavos.' USING ERRCODE = '22023';
  END IF;
  IF v_method NOT IN ('gcash', 'maya', 'bank') THEN
    RAISE EXCEPTION 'Choose GCash, Maya or bank transfer.' USING ERRCODE = '22023';
  END IF;
  IF v_method <> 'bank' THEN
    v_bank := '';
  ELSIF v_bank = '' THEN
    RAISE EXCEPTION 'Enter the bank name.' USING ERRCODE = '22023';
  END IF;
  IF trim(coalesce(p_account_name, '')) = '' OR trim(coalesce(p_account_number, '')) = '' THEN
    RAISE EXCEPTION 'Enter the account name and number.' USING ERRCODE = '22023';
  END IF;

  v_available := (sandbox.partner_wallet_balance(v_partner_id) ->> 'available')::numeric;
  IF p_amount > v_available THEN
    RAISE EXCEPTION 'That is more than your available balance.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO sandbox.partner_withdrawals (partner_id, amount, fee, method, bank_name, account_name, account_number)
  VALUES (v_partner_id, p_amount, 60, v_method, v_bank, left(trim(p_account_name), 120), left(trim(p_account_number), 40))
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row) - 'partner_id';
END;
$$;
REVOKE ALL ON FUNCTION sandbox.request_partner_withdrawal(numeric, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION sandbox.request_partner_withdrawal(numeric, text, text, text, text) TO authenticated;

-- 3. Admin: every request with the partner's contact details, pending first
CREATE OR REPLACE FUNCTION sandbox.admin_list_partner_withdrawals(p_admin_password text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = sandbox, doctors, public
AS $$
BEGIN
  PERFORM doctors.assert_wheel_admin(p_admin_password);

  RETURN coalesce((
    SELECT jsonb_agg(
      to_jsonb(w) || jsonb_build_object(
        'partner_name', d.full_name,
        'partner_email', d.email,
        'partner_mobile', d.mobile
      ) ORDER BY (w.status = 'pending') DESC, w.created_at DESC
    )
    FROM sandbox.partner_withdrawals w
    JOIN doctors.doctor_registrations d ON d.id = w.partner_id
  ), '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION sandbox.admin_list_partner_withdrawals(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION sandbox.admin_list_partner_withdrawals(text) TO service_role;

-- 4. Admin: approve (with the transfer reference) or reject (with a reason). Pending requests only.
CREATE OR REPLACE FUNCTION sandbox.admin_process_partner_withdrawal(
  p_admin_password text,
  p_id uuid,
  p_status text,
  p_reference text DEFAULT '',
  p_note text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sandbox, doctors, public
AS $$
DECLARE
  v_row sandbox.partner_withdrawals;
BEGIN
  PERFORM doctors.assert_wheel_admin(p_admin_password);

  IF p_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Status must be approved or rejected.' USING ERRCODE = '22023';
  END IF;
  IF p_status = 'approved' AND trim(coalesce(p_reference, '')) = '' THEN
    RAISE EXCEPTION 'Enter the transfer reference number.' USING ERRCODE = '22023';
  END IF;
  IF p_status = 'rejected' AND trim(coalesce(p_note, '')) = '' THEN
    RAISE EXCEPTION 'Enter a reason for rejecting.' USING ERRCODE = '22023';
  END IF;

  UPDATE sandbox.partner_withdrawals
  SET status = p_status,
      reference = left(trim(coalesce(p_reference, '')), 120),
      admin_note = left(trim(coalesce(p_note, '')), 500),
      processed_at = now()
  WHERE id = p_id AND status = 'pending'
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'This request was not found or was already processed.' USING ERRCODE = 'P0002';
  END IF;
  RETURN to_jsonb(v_row);
END;
$$;
REVOKE ALL ON FUNCTION sandbox.admin_process_partner_withdrawal(text, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION sandbox.admin_process_partner_withdrawal(text, uuid, text, text, text) TO service_role;
