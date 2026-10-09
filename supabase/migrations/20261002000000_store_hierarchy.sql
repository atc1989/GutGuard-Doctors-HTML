-- ==============================================================================
-- Store Hierarchy Migration (Main Store -> Lifestyle Store -> Affiliate Store)
-- ==============================================================================

-- 1. Create Enum Types
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'doctors' AND t.typname = 'store_type') THEN
    CREATE TYPE doctors.store_type AS ENUM ('affiliate', 'lifestyle', 'main');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'sandbox' AND t.typname = 'store_type') THEN
    CREATE TYPE sandbox.store_type AS ENUM ('affiliate', 'lifestyle', 'main');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'store_type') THEN
    CREATE TYPE public.store_type AS ENUM ('affiliate', 'lifestyle', 'main');
  END IF;
END $$;

-- 2. Add New Columns to doctor_registrations (Initial default is lifestyle for migration)
ALTER TABLE doctors.doctor_registrations
  ADD COLUMN IF NOT EXISTS store_type doctors.store_type NOT NULL DEFAULT 'lifestyle',
  ADD COLUMN IF NOT EXISTS main_store_id UUID REFERENCES doctors.doctor_registrations(id),
  ADD COLUMN IF NOT EXISTS referral_qr_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS promoted_by TEXT;

CREATE INDEX IF NOT EXISTS idx_dr_main_store_id ON doctors.doctor_registrations(main_store_id);
CREATE INDEX IF NOT EXISTS idx_dr_store_type ON doctors.doctor_registrations(store_type);
CREATE INDEX IF NOT EXISTS idx_dr_main_store_type ON doctors.doctor_registrations(main_store_id, store_type);

-- 3. Create store_promotions Table (Audit log for transitions)
CREATE TABLE IF NOT EXISTS doctors.store_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES doctors.doctor_registrations(id) ON DELETE CASCADE,
  from_type doctors.store_type NOT NULL,
  to_type doctors.store_type NOT NULL,
  trigger_type TEXT NOT NULL, -- 'first_sale', 'admin_manual', 'admin_upgrade_main', 'admin_qr_toggle'
  trigger_order_id UUID,
  trigger_admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_promotions_partner ON doctors.store_promotions(partner_id);

CREATE TABLE IF NOT EXISTS sandbox.store_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES doctors.doctor_registrations(id) ON DELETE CASCADE,
  from_type sandbox.store_type NOT NULL,
  to_type sandbox.store_type NOT NULL,
  trigger_type TEXT NOT NULL,
  trigger_order_id UUID,
  trigger_admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sandbox_store_promotions_partner ON sandbox.store_promotions(partner_id);

-- 4. One-Time Setup: Create Root GutGuard Main Store & Classify Existing Partners
DO $$
DECLARE
  v_main_store_id UUID;
BEGIN
  -- Look for existing GutGuard main store or create one
  SELECT id INTO v_main_store_id
  FROM doctors.doctor_registrations
  WHERE routing_slug = 'gutguard-main' OR store_type = 'main'
  LIMIT 1;

  -- One-time setup: if a main store already exists this already ran. Re-running the
  -- classification below would demote every partner an admin promoted without a paid order.
  IF v_main_store_id IS NOT NULL THEN
    RETURN;
  END IF;

  IF v_main_store_id IS NULL THEN
    INSERT INTO doctors.doctor_registrations (
      full_name,
      email,
      mobile,
      routing_slug,
      store_type,
      referral_qr_enabled,
      specialty,
      practice_location,
      name_prefix
    ) VALUES (
      'GutGuard Main Store',
      'main@gutguard.ph',
      '+639000000000',
      'gutguard-main',
      'main',
      true,
      'Main Store',
      'GutGuard Philippines',
      ''
    ) RETURNING id INTO v_main_store_id;
  END IF;

  -- Assign all existing partners without a main store to this root main store
  UPDATE doctors.doctor_registrations
  SET main_store_id = v_main_store_id
  WHERE id != v_main_store_id AND main_store_id IS NULL;

  -- Classify partners with zero paid orders across all shop_orders as 'affiliate' (referral QR disabled)
  UPDATE doctors.doctor_registrations dr
  SET store_type = 'affiliate',
      referral_qr_enabled = false
  WHERE dr.id != v_main_store_id
    AND dr.store_type != 'main'
    AND NOT EXISTS (
      SELECT 1 FROM doctors.shop_orders so
      WHERE so.referral_doctor_id = dr.id
        AND so.payment_status = 'paid'
    )
    AND NOT EXISTS (
      SELECT 1 FROM sandbox.shop_orders sso
      WHERE sso.referral_doctor_id = dr.id
        AND sso.payment_status = 'paid'
    );
END $$;

-- 5. Set default values for future registrations
ALTER TABLE doctors.doctor_registrations
  ALTER COLUMN store_type SET DEFAULT 'affiliate',
  ALTER COLUMN referral_qr_enabled SET DEFAULT false;

-- 6. Constraints and Validation Trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_main_store_no_parent'
  ) THEN
    ALTER TABLE doctors.doctor_registrations
      ADD CONSTRAINT chk_main_store_no_parent
      CHECK (store_type != 'main' OR main_store_id IS NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_non_main_must_have_parent'
  ) THEN
    ALTER TABLE doctors.doctor_registrations
      ADD CONSTRAINT chk_non_main_must_have_parent
      CHECK (store_type = 'main' OR main_store_id IS NOT NULL);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION doctors.validate_main_store_reference()
RETURNS TRIGGER AS $$
DECLARE
  v_target_type doctors.store_type;
BEGIN
  IF NEW.main_store_id IS NOT NULL THEN
    SELECT store_type INTO v_target_type
    FROM doctors.doctor_registrations
    WHERE id = NEW.main_store_id;

    IF v_target_type IS NULL OR v_target_type != 'main' THEN
      RAISE EXCEPTION 'main_store_id must reference an account with store_type = main';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validate_main_store_ref ON doctors.doctor_registrations;
CREATE TRIGGER trigger_validate_main_store_ref
  BEFORE INSERT OR UPDATE OF main_store_id
  ON doctors.doctor_registrations
  FOR EACH ROW
  EXECUTE FUNCTION doctors.validate_main_store_reference();

-- 7. Update register_doctor RPC
CREATE OR REPLACE FUNCTION doctors.register_doctor(
  p_full_name text,
  p_email text,
  p_mobile text,
  p_tiktok_username text,
  p_specialty text,
  p_practice_location text,
  p_referrer_slug text default null,
  p_name_prefix text default ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = doctors, public
AS $$
DECLARE
  v_doctor_id uuid;
  v_referrer_id uuid;
  v_referrer_record doctors.doctor_registrations%ROWTYPE;
  v_main_store_id uuid;
  v_tiktok_username text;
BEGIN
  v_tiktok_username := regexp_replace(lower(trim(coalesce(p_tiktok_username, ''))), '^@+', '');
  
  IF nullif(lower(trim(coalesce(p_referrer_slug, ''))), '') IS NOT NULL THEN
    SELECT * INTO v_referrer_record
    FROM doctors.doctor_registrations d
    WHERE d.routing_slug = lower(trim(p_referrer_slug))
    LIMIT 1;

    IF v_referrer_record.id IS NOT NULL THEN
      v_referrer_id := v_referrer_record.id;
      IF v_referrer_record.store_type = 'main' THEN
        v_main_store_id := v_referrer_record.id;
      ELSE
        v_main_store_id := v_referrer_record.main_store_id;
      END IF;
    END IF;
  END IF;

  -- Fallback to default main store if no referrer or referrer has no main_store_id
  IF v_main_store_id IS NULL THEN
    SELECT id INTO v_main_store_id
    FROM doctors.doctor_registrations
    WHERE store_type = 'main'
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  -- Allocate non-colliding 5-char link key
  LOOP
    v_doctor_id := gen_random_uuid();
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM doctors.doctor_registrations d
      WHERE right(d.id::text, 5) = right(v_doctor_id::text, 5)
    );
  END LOOP;

  INSERT INTO doctors.doctor_registrations (
    id, name_prefix, full_name, email, mobile, tiktok_username, specialty, practice_location,
    routing_slug, redirect_url, referred_by_partner_id,
    store_type, referral_qr_enabled, main_store_id
  ) VALUES (
    v_doctor_id,
    trim(coalesce(p_name_prefix, '')),
    trim(p_full_name),
    coalesce(nullif(lower(trim(coalesce(p_email, ''))), ''), ''),
    trim(p_mobile),
    v_tiktok_username,
    trim(p_specialty),
    trim(p_practice_location),
    doctors.make_unique_doctor_slug(p_full_name),
    case when v_tiktok_username = '' then null else 'https://www.tiktok.com/@' || v_tiktok_username end,
    v_referrer_id,
    'affiliate',
    false,
    v_main_store_id
  ) RETURNING id INTO v_doctor_id;

  IF v_referrer_id = v_doctor_id THEN
    RAISE EXCEPTION 'A partner cannot refer themselves.' USING ERRCODE = '23514';
  END IF;

  RETURN v_doctor_id;
END;
$$;

-- Sandbox counterpart for register_doctor
CREATE OR REPLACE FUNCTION sandbox.register_doctor(
  p_full_name text,
  p_email text,
  p_mobile text,
  p_tiktok_username text,
  p_specialty text,
  p_practice_location text,
  p_referrer_slug text default null,
  p_name_prefix text default ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sandbox, doctors, public
AS $$
BEGIN
  RETURN doctors.register_doctor(
    p_full_name, p_email, p_mobile, p_tiktok_username,
    p_specialty, p_practice_location, p_referrer_slug, p_name_prefix
  );
END;
$$;

-- 8. Update Automated Points Trigger with Auto-Promotion (doctors & sandbox)
CREATE OR REPLACE FUNCTION doctors.award_order_points() RETURNS trigger AS $$
DECLARE
  v_points INTEGER;
  v_grandparent_id UUID;
  v_partner doctors.doctor_registrations%ROWTYPE;
BEGIN
  -- 1. Calculate points (1 point per ₱1000 spent, min 1)
  v_points := FLOOR(COALESCE(NEW.total_amount, 0) / 1000);
  IF v_points < 1 THEN
    v_points := 1;
  END IF;

  IF NEW.referral_doctor_id IS NOT NULL THEN
    -- Fetch referral partner
    SELECT * INTO v_partner
    FROM doctors.doctor_registrations
    WHERE id = NEW.referral_doctor_id;

    IF v_partner.id IS NOT NULL THEN
      -- 2. Award Direct Points (Depth 0)
      INSERT INTO doctors.partner_points (order_id, partner_id, points, depth)
      VALUES (NEW.id, v_partner.id, v_points, 0)
      ON CONFLICT (order_id, partner_id) DO NOTHING;

      -- 3. Award Pass-Up Points to Upline (Depth 1)
      IF v_partner.referred_by_partner_id IS NOT NULL THEN
        INSERT INTO doctors.partner_points (order_id, partner_id, points, depth)
        VALUES (NEW.id, v_partner.referred_by_partner_id, v_points, 1)
        ON CONFLICT (order_id, partner_id) DO NOTHING;
      END IF;

      -- 4. Auto-Promote Affiliate to Lifestyle on First Paid Sale
      IF v_partner.store_type = 'affiliate' THEN
        UPDATE doctors.doctor_registrations
        SET store_type = 'lifestyle',
            referral_qr_enabled = true,
            promoted_at = now(),
            promoted_by = 'auto'
        WHERE id = v_partner.id;

        INSERT INTO doctors.store_promotions (
          partner_id, from_type, to_type, trigger_type, trigger_order_id
        ) VALUES (
          v_partner.id, 'affiliate', 'lifestyle', 'first_sale', NEW.id
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sandbox.award_order_points() RETURNS trigger AS $$
DECLARE
  v_points INTEGER;
  v_partner doctors.doctor_registrations%ROWTYPE;
BEGIN
  v_points := FLOOR(COALESCE(NEW.total_amount, 0) / 1000);
  IF v_points < 1 THEN
    v_points := 1;
  END IF;

  IF NEW.referral_doctor_id IS NOT NULL THEN
    SELECT * INTO v_partner
    FROM doctors.doctor_registrations
    WHERE id = NEW.referral_doctor_id;

    IF v_partner.id IS NOT NULL THEN
      INSERT INTO sandbox.partner_points (order_id, partner_id, points, depth)
      VALUES (NEW.id, v_partner.id, v_points, 0)
      ON CONFLICT (order_id, partner_id) DO NOTHING;

      IF v_partner.referred_by_partner_id IS NOT NULL THEN
        INSERT INTO sandbox.partner_points (order_id, partner_id, points, depth)
        VALUES (NEW.id, v_partner.referred_by_partner_id, v_points, 1)
        ON CONFLICT (order_id, partner_id) DO NOTHING;
      END IF;

      IF v_partner.store_type = 'affiliate' THEN
        UPDATE doctors.doctor_registrations
        SET store_type = 'lifestyle',
            referral_qr_enabled = true,
            promoted_at = now(),
            promoted_by = 'auto'
        WHERE id = v_partner.id;

        INSERT INTO sandbox.store_promotions (
          partner_id, from_type, to_type, trigger_type, trigger_order_id
        ) VALUES (
          v_partner.id, 'affiliate', 'lifestyle', 'first_sale', NEW.id
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. Admin RPC: Upgrade Lifestyle Store to Main Store (Breakaway)
CREATE OR REPLACE FUNCTION doctors.admin_upgrade_to_main_store(
  p_admin_password text,
  p_partner_id uuid,
  p_note text default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = doctors, public
AS $$
DECLARE
  v_partner doctors.doctor_registrations%ROWTYPE;
  v_old_main_store_id UUID;
  v_descendants_moved INTEGER := 0;
BEGIN
  PERFORM public.assert_wheel_admin(p_admin_password);

  SELECT * INTO v_partner
  FROM doctors.doctor_registrations
  WHERE id = p_partner_id;

  IF v_partner.id IS NULL THEN
    RAISE EXCEPTION 'Partner not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_partner.store_type != 'lifestyle' THEN
    RAISE EXCEPTION 'Can only upgrade a Lifestyle Store to Main Store. Current type is %', v_partner.store_type USING ERRCODE = '22023';
  END IF;

  v_old_main_store_id := v_partner.main_store_id;

  -- 1. Upgrade partner to Main Store & sever upline referral link
  UPDATE doctors.doctor_registrations
  SET store_type = 'main',
      main_store_id = NULL,
      referred_by_partner_id = NULL,
      referral_qr_enabled = true,
      promoted_at = now(),
      promoted_by = 'admin'
  WHERE id = p_partner_id;

  -- 2. Breakaway: Re-parent all recursive descendants to this new Main Store
  WITH RECURSIVE descendant_tree AS (
    SELECT id FROM doctors.doctor_registrations
    WHERE referred_by_partner_id = p_partner_id

    UNION ALL

    SELECT dr.id
    FROM doctors.doctor_registrations dr
    INNER JOIN descendant_tree dt ON dr.referred_by_partner_id = dt.id
  )
  UPDATE doctors.doctor_registrations
  SET main_store_id = p_partner_id
  WHERE id IN (SELECT id FROM descendant_tree);

  GET DIAGNOSTICS v_descendants_moved = ROW_COUNT;

  -- 3. Audit log
  INSERT INTO doctors.store_promotions (
    partner_id, from_type, to_type, trigger_type, trigger_admin_note
  ) VALUES (
    p_partner_id, 'lifestyle', 'main', 'admin_upgrade_main',
    COALESCE(p_note, '') || ' | Broke away from main_store_id=' || COALESCE(v_old_main_store_id::text, 'NULL')
    || ' | Transferred ' || v_descendants_moved || ' descendant stores'
  );

  RETURN jsonb_build_object(
    'success', true,
    'partner_id', p_partner_id,
    'old_main_store_id', v_old_main_store_id,
    'descendants_moved', v_descendants_moved
  );
END;
$$;

-- 10. Admin RPC: Toggle Referral QR & Promote Partner
CREATE OR REPLACE FUNCTION doctors.admin_toggle_referral_qr(
  p_admin_password text,
  p_partner_id uuid,
  p_enabled boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = doctors, public
AS $$
DECLARE
  v_partner doctors.doctor_registrations%ROWTYPE;
BEGIN
  PERFORM public.assert_wheel_admin(p_admin_password);

  SELECT * INTO v_partner
  FROM doctors.doctor_registrations WHERE id = p_partner_id;

  IF v_partner.id IS NULL THEN
    RAISE EXCEPTION 'Partner not found.' USING ERRCODE = 'P0002';
  END IF;

  UPDATE doctors.doctor_registrations
  SET referral_qr_enabled = p_enabled
  WHERE id = p_partner_id;

  INSERT INTO doctors.store_promotions (
    partner_id, from_type, to_type, trigger_type, trigger_admin_note
  ) VALUES (
    p_partner_id, v_partner.store_type, v_partner.store_type, 'admin_qr_toggle',
    CASE WHEN p_enabled THEN 'Referral QR enabled by admin' ELSE 'Referral QR disabled by admin' END
  );

  RETURN jsonb_build_object('success', true, 'partner_id', p_partner_id, 'referral_qr_enabled', p_enabled);
END;
$$;

CREATE OR REPLACE FUNCTION doctors.admin_promote_partner(
  p_admin_password text,
  p_partner_id uuid,
  p_note text default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = doctors, public
AS $$
DECLARE
  v_partner doctors.doctor_registrations%ROWTYPE;
BEGIN
  PERFORM public.assert_wheel_admin(p_admin_password);

  SELECT * INTO v_partner
  FROM doctors.doctor_registrations WHERE id = p_partner_id;

  IF v_partner.id IS NULL THEN
    RAISE EXCEPTION 'Partner not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_partner.store_type != 'affiliate' THEN
    RAISE EXCEPTION 'Can only promote affiliate accounts to lifestyle.' USING ERRCODE = '22023';
  END IF;

  UPDATE doctors.doctor_registrations
  SET store_type = 'lifestyle',
      referral_qr_enabled = true,
      promoted_at = now(),
      promoted_by = 'admin'
  WHERE id = p_partner_id;

  INSERT INTO doctors.store_promotions (
    partner_id, from_type, to_type, trigger_type, trigger_admin_note
  ) VALUES (
    p_partner_id, 'affiliate', 'lifestyle', 'admin_manual', p_note
  );

  RETURN jsonb_build_object('success', true, 'partner_id', p_partner_id, 'store_type', 'lifestyle');
END;
$$;

-- 11. Main Store Dashboard & Reports RPCs
CREATE OR REPLACE FUNCTION doctors.get_main_store_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = doctors, public
AS $$
DECLARE
  v_email text;
  v_main_store doctors.doctor_registrations%ROWTYPE;
  v_result jsonb;
BEGIN
  v_email := nullif(lower(trim(coalesce(auth.jwt() ->> 'email', ''))), '');
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Sign in to view Main Store dashboard.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_main_store
  FROM doctors.doctor_registrations
  WHERE email = v_email AND store_type = 'main'
  LIMIT 1;

  IF v_main_store.id IS NULL THEN
    RAISE EXCEPTION 'This account is not a GutGuard Main Store.' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'main_store', jsonb_build_object(
      'id', v_main_store.id,
      'full_name', v_main_store.full_name,
      'routing_slug', v_main_store.routing_slug,
      'email', v_main_store.email,
      'store_type', v_main_store.store_type,
      'referral_qr_enabled', v_main_store.referral_qr_enabled
    ),
    'lifestyle_count', (
      SELECT count(*) FROM doctors.doctor_registrations
      WHERE main_store_id = v_main_store.id AND store_type = 'lifestyle'
    ),
    'affiliate_count', (
      SELECT count(*) FROM doctors.doctor_registrations
      WHERE main_store_id = v_main_store.id AND store_type = 'affiliate'
    ),
    'total_orders', (
      SELECT count(*) FROM doctors.shop_orders so
      JOIN doctors.doctor_registrations dr ON so.referral_doctor_id = dr.id
      WHERE (dr.main_store_id = v_main_store.id OR dr.id = v_main_store.id)
        AND so.payment_status = 'paid'
    ),
    'total_revenue', (
      SELECT coalesce(sum(so.total_amount), 0) FROM doctors.shop_orders so
      JOIN doctors.doctor_registrations dr ON so.referral_doctor_id = dr.id
      WHERE (dr.main_store_id = v_main_store.id OR dr.id = v_main_store.id)
        AND so.payment_status = 'paid'
    ),
    'combined_points', (
      -- Main Store combined points: depth 0 (own shop sales) + depth 1 (direct child pass-ups)
      SELECT coalesce(sum(points), 0) FROM doctors.partner_points
      WHERE partner_id = v_main_store.id
    ),
    'own_points', (
      SELECT coalesce(sum(points), 0) FROM doctors.partner_points
      WHERE partner_id = v_main_store.id AND depth = 0
    ),
    'passup_points', (
      SELECT coalesce(sum(points), 0) FROM doctors.partner_points
      WHERE partner_id = v_main_store.id AND depth = 1
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Main Store Reports RPC (Paginated orders across all descendant stores)
CREATE OR REPLACE FUNCTION doctors.get_main_store_reports(
  p_scope text default 'all',
  p_store_id uuid default null,
  p_status text default null,
  p_limit integer default 25,
  p_offset integer default 0,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null,
  p_sort text default 'newest'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = doctors, public
AS $$
DECLARE
  v_email text;
  v_main_store doctors.doctor_registrations%ROWTYPE;
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_total_orders bigint;
  v_orders jsonb;
  v_stores jsonb;
BEGIN
  v_email := nullif(lower(trim(coalesce(auth.jwt() ->> 'email', ''))), '');
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Sign in to view Main Store reports.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_main_store
  FROM doctors.doctor_registrations
  WHERE email = v_email AND store_type = 'main'
  LIMIT 1;

  IF v_main_store.id IS NULL THEN
    RAISE EXCEPTION 'This account is not a GutGuard Main Store.' USING ERRCODE = '42501';
  END IF;

  -- Count matching orders
  SELECT count(*) INTO v_total_orders
  FROM doctors.shop_orders o
  JOIN doctors.doctor_registrations dr ON o.referral_doctor_id = dr.id
  WHERE (dr.main_store_id = v_main_store.id OR dr.id = v_main_store.id)
    AND (p_store_id IS NULL OR dr.id = p_store_id)
    AND doctors.partner_order_matches_status(o.payment_status, o.status, p_status)
    AND (p_date_from IS NULL OR o.created_at >= p_date_from)
    AND (p_date_to IS NULL OR o.created_at < p_date_to + interval '1 day');

  -- Aggregate orders
  SELECT coalesce(jsonb_agg(entry order by
    case when lower(coalesce(p_sort, 'newest')) = 'oldest' then sort_at end asc,
    case when lower(coalesce(p_sort, 'newest')) = 'newest' then sort_at end desc
  ), '[]'::jsonb) INTO v_orders
  FROM (
    SELECT o.created_at as sort_at, jsonb_build_object(
      'order_code', o.order_code,
      'created_at', o.created_at,
      'status', o.status,
      'payment_status', o.payment_status,
      'total_amount', coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0)),
      'buyer_name', coalesce(nullif(trim(o.customer_name), ''), trim(coalesce(o.first_name, '') || ' ' || coalesce(o.last_name, ''))),
      'store_id', dr.id,
      'store_name', dr.full_name,
      'store_type', dr.store_type,
      'store_slug', dr.routing_slug
    ) AS entry
    FROM doctors.shop_orders o
    JOIN doctors.doctor_registrations dr ON o.referral_doctor_id = dr.id
    WHERE (dr.main_store_id = v_main_store.id OR dr.id = v_main_store.id)
      AND (p_store_id IS NULL OR dr.id = p_store_id)
      AND doctors.partner_order_matches_status(o.payment_status, o.status, p_status)
      AND (p_date_from IS NULL OR o.created_at >= p_date_from)
      AND (p_date_to IS NULL OR o.created_at < p_date_to + interval '1 day')
    ORDER BY
      case when lower(coalesce(p_sort, 'newest')) = 'oldest' then o.created_at end asc,
      case when lower(coalesce(p_sort, 'newest')) = 'newest' then o.created_at end desc
    LIMIT v_limit OFFSET v_offset
  ) sub;

  -- Store Directory list under this Main Store
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', dr.id,
    'full_name', dr.full_name,
    'store_type', dr.store_type,
    'routing_slug', dr.routing_slug,
    'specialty', dr.specialty,
    'practice_location', dr.practice_location,
    'created_at', dr.created_at,
    'referral_qr_enabled', dr.referral_qr_enabled,
    'orders_count', (
      SELECT count(*) FROM doctors.shop_orders so
      WHERE so.referral_doctor_id = dr.id AND so.payment_status = 'paid'
    ),
    'revenue', (
      SELECT coalesce(sum(so.total_amount), 0) FROM doctors.shop_orders so
      WHERE so.referral_doctor_id = dr.id AND so.payment_status = 'paid'
    ),
    'points', (
      SELECT coalesce(sum(points), 0) FROM doctors.partner_points pp
      WHERE pp.partner_id = dr.id
    )
  ) ORDER BY dr.created_at DESC), '[]'::jsonb) INTO v_stores
  FROM doctors.doctor_registrations dr
  WHERE dr.main_store_id = v_main_store.id;

  RETURN jsonb_build_object(
    'total_orders', v_total_orders,
    'orders', v_orders,
    'stores', v_stores
  );
END;
$$;

-- Sandbox counterpart for get_main_store_reports
CREATE OR REPLACE FUNCTION sandbox.get_main_store_reports(
  p_scope text default 'all',
  p_store_id uuid default null,
  p_status text default null,
  p_limit integer default 25,
  p_offset integer default 0,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null,
  p_sort text default 'newest'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = sandbox, doctors, public
AS $$
BEGIN
  RETURN doctors.get_main_store_reports(
    p_scope, p_store_id, p_status, p_limit, p_offset, p_date_from, p_date_to, p_sort
  );
END;
$$;

-- Sandbox counterpart for get_main_store_dashboard
CREATE OR REPLACE FUNCTION sandbox.get_main_store_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = sandbox, doctors, public
AS $$
BEGIN
  RETURN doctors.get_main_store_dashboard();
END;
$$;

-- 12. Update partner_dashboard in doctors & sandbox to expose store_type fields
CREATE OR REPLACE FUNCTION doctors.partner_dashboard(
  p_scope text default 'all',
  p_status text default null,
  p_limit integer default 25,
  p_offset integer default 0,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null,
  p_sort text default 'newest'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = doctors, public
AS $$
DECLARE
  v_email text;
  v_doctor doctors.doctor_registrations;
  v_scope text := lower(trim(coalesce(p_scope, 'all')));
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_order_count bigint;
  v_orders jsonb;
BEGIN
  if v_scope not in ('all', 'direct', 'referred') then
    raise exception 'Invalid order scope.' using errcode = '22023';
  end if;
  if lower(coalesce(p_sort, 'newest')) not in ('newest', 'oldest') then
    raise exception 'Invalid order sort.' using errcode = '22023';
  end if;

  v_email := nullif(lower(trim(coalesce(auth.jwt() ->> 'email', ''))), '');
  if v_email is null then
    raise exception 'Sign in to view your dashboard.' using errcode = '42501';
  end if;

  select * into v_doctor
  from doctors.doctor_registrations
  where email = v_email
  limit 1;

  if v_doctor.id is null then
    raise exception 'This email is not registered as a GutGuard partner.' using errcode = '42501';
  end if;

  select count(*) into v_order_count
  from doctors.shop_orders o
  join doctors.doctor_registrations source on source.id = o.referral_doctor_id
  where (source.id = v_doctor.id or source.referred_by_partner_id = v_doctor.id)
    and (
      v_scope = 'all'
      or (v_scope = 'direct' and source.id = v_doctor.id)
      or (v_scope = 'referred' and source.referred_by_partner_id = v_doctor.id)
    )
    and doctors.partner_order_matches_status(o.payment_status, o.status, p_status)
    and (p_date_from is null or o.created_at >= p_date_from)
    and (p_date_to is null or o.created_at < p_date_to + interval '1 day');

  select coalesce(jsonb_agg(entry order by
    case when lower(coalesce(p_sort, 'newest')) = 'oldest' then sort_at end asc,
    case when lower(coalesce(p_sort, 'newest')) = 'newest' then sort_at end desc
  ), '[]'::jsonb) into v_orders
  from (
    select o.created_at as sort_at, jsonb_build_object(
      'order_code', o.order_code,
      'created_at', o.created_at,
      'status', o.status,
      'payment_status', o.payment_status,
      'total_amount', coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0)),
      'buyer_first_name', coalesce(o.first_name, split_part(o.customer_name, ' ', 1)),
      'buyer_name', coalesce(
        nullif(trim(o.customer_name), ''),
        nullif(trim(concat_ws(' ', o.first_name, o.last_name)), '')
      ),
      'buyer_email', coalesce(o.email, ''),
      'buyer_mobile', coalesce(o.mobile, ''),
      'address', coalesce(o.address, ''),
      'barangay', coalesce(o.barangay, ''),
      'zip', coalesce(o.zip, ''),
      'city', o.city,
      'province', o.province,
      'source_type', case when source.id = v_doctor.id then 'direct' else 'referred' end,
      'source_partner_name', source.full_name,
      'source_partner_slug', source.routing_slug
    ) as entry
    from doctors.shop_orders o
    join doctors.doctor_registrations source on source.id = o.referral_doctor_id
    where (source.id = v_doctor.id or source.referred_by_partner_id = v_doctor.id)
      and (
        v_scope = 'all'
        or (v_scope = 'direct' and source.id = v_doctor.id)
        or (v_scope = 'referred' and source.referred_by_partner_id = v_doctor.id)
      )
      and doctors.partner_order_matches_status(o.payment_status, o.status, p_status)
      and (p_date_from is null or o.created_at >= p_date_from)
      and (p_date_to is null or o.created_at < p_date_to + interval '1 day')
    order by
      case when lower(coalesce(p_sort, 'newest')) = 'oldest' then o.created_at end asc,
      case when lower(coalesce(p_sort, 'newest')) = 'newest' then o.created_at end desc
    limit v_limit offset v_offset
  ) page;

  return jsonb_build_object(
    'partner', jsonb_build_object(
      'id', v_doctor.id,
      'full_name', v_doctor.full_name,
      'routing_slug', v_doctor.routing_slug,
      'store_type', v_doctor.store_type,
      'referral_qr_enabled', v_doctor.referral_qr_enabled,
      'main_store_id', v_doctor.main_store_id,
      'promoted_at', v_doctor.promoted_at,
      'promoted_by', v_doctor.promoted_by,
      'joined_at', v_doctor.created_at
    ),
    'clicks', jsonb_build_object(
      'total', (
        select count(*) from doctors.referral_clicks c where c.doctor_id = v_doctor.id
      ),
      'last_30_days', (
        select count(*) from doctors.referral_clicks c
        where c.doctor_id = v_doctor.id and c.created_at >= now() - interval '30 days'
      )
    ),
    'points', (
      SELECT jsonb_build_object(
        'total_all_time', coalesce(sum(p.points), 0),
        'own_points', coalesce(sum(p.points) filter (where p.depth = 0), 0),
        'passup_points', coalesce(sum(p.points) filter (where p.depth = 1), 0),
        'current_cycle', floor(coalesce(sum(p.points), 0) / 1500) + 1,
        'points_in_cycle', coalesce(sum(p.points), 0) % 1500
      )
      FROM doctors.partner_points p
      WHERE p.partner_id = v_doctor.id
    ),
    'rebates', (
      SELECT coalesce(jsonb_agg(
        jsonb_build_object(
          'cycle_number', m.cycle_number,
          'milestone_pts', m.milestone_pts,
          'rebate_amount', m.rebate_amount,
          'status', m.status,
          'created_at', m.created_at
        ) ORDER BY m.created_at DESC
      ), '[]'::jsonb)
      FROM doctors.milestone_unlocks m
      WHERE m.partner_id = v_doctor.id
    ),
    'totals', (
      select jsonb_build_object(
        'direct_orders', count(*) filter (where source.id = v_doctor.id),
        'referred_orders', count(*) filter (where source.referred_by_partner_id = v_doctor.id),
        'orders', count(*),
        'paid_orders', count(*) filter (where o.payment_status = 'paid'),
        'direct_paid_amount', coalesce(sum(
          coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0))
        ) filter (where o.payment_status = 'paid' and source.id = v_doctor.id), 0),
        'referred_paid_amount', coalesce(sum(
          coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0))
        ) filter (where o.payment_status = 'paid' and source.referred_by_partner_id = v_doctor.id), 0),
        'paid_amount', coalesce(sum(
          coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0))
        ) filter (where o.payment_status = 'paid'), 0),
        'referred_partners', (
          select count(*) from doctors.doctor_registrations d
          where d.referred_by_partner_id = v_doctor.id
        )
      )
      from doctors.shop_orders o
      join doctors.doctor_registrations source on source.id = o.referral_doctor_id
      where source.id = v_doctor.id or source.referred_by_partner_id = v_doctor.id
    ),
    'orders', v_orders,
    'orders_page', jsonb_build_object(
      'total', v_order_count,
      'limit', v_limit,
      'offset', v_offset,
      'has_more', v_offset + jsonb_array_length(v_orders) < v_order_count
    ),
    'referred_partners', (
      select coalesce(jsonb_agg(entry order by joined_at desc), '[]'::jsonb)
      from (
        select child.created_at as joined_at, jsonb_build_object(
          'full_name', child.full_name,
          'routing_slug', child.routing_slug,
          'specialty', child.specialty,
          'practice_location', child.practice_location,
          'store_type', child.store_type,
          'referral_qr_enabled', child.referral_qr_enabled,
          'joined_at', child.created_at,
          'orders', count(o.id),
          'paid_order_value', coalesce(sum(
            coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0))
          ) filter (where o.payment_status = 'paid'), 0)
        ) as entry
        from doctors.doctor_registrations child
        left join doctors.shop_orders o on o.referral_doctor_id = child.id
        where child.referred_by_partner_id = v_doctor.id
        group by child.id
        order by child.created_at desc
      ) partners
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION sandbox.partner_dashboard(
  p_scope text default 'all',
  p_status text default null,
  p_limit integer default 25,
  p_offset integer default 0,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null,
  p_sort text default 'newest'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = sandbox, doctors, public
AS $$
BEGIN
  RETURN doctors.partner_dashboard(
    p_scope, p_status, p_limit, p_offset, p_date_from, p_date_to, p_sort
  );
END;
$$;

-- 13. Update permissions on admin RPCs
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT n.nspname as schema_name, p.proname, pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname in ('doctors', 'sandbox')
      AND p.proname IN ('admin_upgrade_to_main_store', 'admin_toggle_referral_qr', 'admin_promote_partner')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM public, anon, authenticated',
                   fn.schema_name, fn.proname, fn.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role',
                   fn.schema_name, fn.proname, fn.args);
  END LOOP;
END $$;
