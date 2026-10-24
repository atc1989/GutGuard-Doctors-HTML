-- Admin: transfer an Affiliate store to a new upline, and hand out unclaimed pass-up points.
--
-- Transfer moves the store's past pass-up (depth 1) points from the old upline to the new one,
-- in both doctors and sandbox (partners are shared, orders are not).
-- "Unclaimed" pass-up = a paid order by a non-Main store that earned depth-0 points but has no
-- depth-1 row (the store had no upline). Assigning gives those points to a partner; the
-- store's upline is unchanged. Refunds still clear them: revoke_order_points deletes by order.

-- 1. Transfer (doctors only: admin RPCs go through the doctors client, like the upgrade)
CREATE OR REPLACE FUNCTION doctors.admin_transfer_store(
  p_admin_password text,
  p_partner_id uuid,
  p_new_upline_id uuid,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = doctors, public
AS $$
DECLARE
  v_store doctors.doctor_registrations%ROWTYPE;
  v_upline doctors.doctor_registrations%ROWTYPE;
  v_main_store_id uuid;
  v_points_moved integer := 0;
  v_sandbox_points integer := 0;
BEGIN
  PERFORM doctors.assert_wheel_admin(p_admin_password);

  SELECT * INTO v_store FROM doctors.doctor_registrations WHERE id = p_partner_id FOR UPDATE;
  IF v_store.id IS NULL THEN
    RAISE EXCEPTION 'Store not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_store.store_type <> 'affiliate' THEN
    RAISE EXCEPTION 'Only Affiliate stores can be transferred. Current type is %', v_store.store_type USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_upline FROM doctors.doctor_registrations WHERE id = p_new_upline_id;
  IF v_upline.id IS NULL THEN
    RAISE EXCEPTION 'New upline not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_upline.id = v_store.id THEN
    RAISE EXCEPTION 'A store cannot be its own upline.' USING ERRCODE = '22023';
  END IF;
  IF v_upline.id IS NOT DISTINCT FROM v_store.referred_by_partner_id THEN
    RAISE EXCEPTION 'That partner is already this store''s upline.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    WITH RECURSIVE descendant_tree AS (
      SELECT id FROM doctors.doctor_registrations WHERE referred_by_partner_id = v_store.id
      UNION
      SELECT dr.id FROM doctors.doctor_registrations dr
      INNER JOIN descendant_tree dt ON dr.referred_by_partner_id = dt.id
    )
    SELECT 1 FROM descendant_tree WHERE id = v_upline.id
  ) THEN
    RAISE EXCEPTION 'The new upline is in this store''s own referral tree.' USING ERRCODE = '22023';
  END IF;

  v_main_store_id := CASE WHEN v_upline.store_type = 'main' THEN v_upline.id ELSE v_upline.main_store_id END;
  IF v_main_store_id IS NULL THEN
    RAISE EXCEPTION 'The new upline has no Main Store.' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('doctors.allow_referrer_change', 'on', true);
  UPDATE doctors.doctor_registrations
  SET referred_by_partner_id = v_upline.id,
      main_store_id = v_main_store_id
  WHERE id = v_store.id;
  PERFORM set_config('doctors.allow_referrer_change', '', true);

  -- Past pass-up points follow the store to its new upline. No old upline = nothing to move.
  IF v_store.referred_by_partner_id IS NOT NULL THEN
    WITH moved AS (
      UPDATE doctors.partner_points pp
      SET partner_id = v_upline.id
      FROM doctors.shop_orders so
      WHERE pp.order_id = so.id
        AND so.referral_doctor_id = v_store.id
        AND pp.depth = 1
        AND pp.partner_id = v_store.referred_by_partner_id
      RETURNING pp.points
    )
    SELECT coalesce(sum(points), 0) INTO v_points_moved FROM moved;

    WITH moved AS (
      UPDATE sandbox.partner_points pp
      SET partner_id = v_upline.id
      FROM sandbox.shop_orders so
      WHERE pp.order_id = so.id
        AND so.referral_doctor_id = v_store.id
        AND pp.depth = 1
        AND pp.partner_id = v_store.referred_by_partner_id
      RETURNING pp.points
    )
    SELECT coalesce(sum(points), 0) INTO v_sandbox_points FROM moved;
  END IF;

  INSERT INTO doctors.store_promotions (partner_id, from_type, to_type, trigger_type, trigger_admin_note)
  VALUES (
    v_store.id, 'affiliate', 'affiliate', 'admin_transfer',
    coalesce(p_note, '') || ' | Upline ' || coalesce(v_store.referred_by_partner_id::text, 'NULL')
    || ' -> ' || v_upline.id || ' | Moved ' || v_points_moved || ' pass-up points'
    || ' (sandbox ' || v_sandbox_points || ')'
  );

  RETURN jsonb_build_object(
    'success', true,
    'old_upline_id', v_store.referred_by_partner_id,
    'new_upline_id', v_upline.id,
    'main_store_id', v_main_store_id,
    'points_moved', v_points_moved,
    'sandbox_points_moved', v_sandbox_points
  );
END;
$$;

REVOKE ALL ON FUNCTION doctors.admin_transfer_store(text, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION doctors.admin_transfer_store(text, uuid, uuid, text) TO service_role;

-- 2. Unclaimed pass-up points: doctors
CREATE OR REPLACE FUNCTION doctors.admin_list_unclaimed_passup(p_admin_password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = doctors, public
AS $$
BEGIN
  PERFORM doctors.assert_wheel_admin(p_admin_password);

  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object('store_id', t.store_id, 'orders', t.orders, 'points', t.points))
    FROM (
      SELECT so.referral_doctor_id AS store_id, count(*) AS orders, sum(own.points) AS points
      FROM doctors.shop_orders so
      JOIN doctors.doctor_registrations dr ON dr.id = so.referral_doctor_id AND dr.store_type <> 'main'
      JOIN doctors.partner_points own
        ON own.order_id = so.id AND own.partner_id = so.referral_doctor_id AND own.depth = 0
      WHERE so.payment_status = 'paid'
        AND NOT EXISTS (SELECT 1 FROM doctors.partner_points up WHERE up.order_id = so.id AND up.depth = 1)
      GROUP BY so.referral_doctor_id
    ) t
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION doctors.admin_assign_unclaimed_passup(
  p_admin_password text,
  p_store_id uuid,
  p_partner_id uuid,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = doctors, public
AS $$
DECLARE
  v_store doctors.doctor_registrations%ROWTYPE;
  v_orders integer;
  v_points integer;
BEGIN
  PERFORM doctors.assert_wheel_admin(p_admin_password);

  -- Row lock serialises two admins assigning the same store at once.
  SELECT * INTO v_store FROM doctors.doctor_registrations WHERE id = p_store_id FOR UPDATE;
  IF v_store.id IS NULL THEN
    RAISE EXCEPTION 'Store not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_store.store_type = 'main' THEN
    RAISE EXCEPTION 'Main Store sales have no pass-up points to assign.' USING ERRCODE = '22023';
  END IF;
  IF p_partner_id = p_store_id THEN
    RAISE EXCEPTION 'A store cannot receive its own pass-up points.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM doctors.doctor_registrations WHERE id = p_partner_id) THEN
    RAISE EXCEPTION 'Partner not found.' USING ERRCODE = 'P0002';
  END IF;

  WITH ins AS (
    INSERT INTO doctors.partner_points (order_id, partner_id, points, depth)
    SELECT so.id, p_partner_id, own.points, 1
    FROM doctors.shop_orders so
    JOIN doctors.partner_points own
      ON own.order_id = so.id AND own.partner_id = so.referral_doctor_id AND own.depth = 0
    WHERE so.referral_doctor_id = p_store_id
      AND so.payment_status = 'paid'
      AND NOT EXISTS (SELECT 1 FROM doctors.partner_points up WHERE up.order_id = so.id AND up.depth = 1)
    ON CONFLICT (order_id, partner_id) DO NOTHING
    RETURNING points
  )
  SELECT count(*), coalesce(sum(points), 0) INTO v_orders, v_points FROM ins;

  IF v_orders = 0 THEN
    RAISE EXCEPTION 'This store has no unclaimed pass-up points.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO doctors.store_promotions (partner_id, from_type, to_type, trigger_type, trigger_admin_note)
  VALUES (
    v_store.id, v_store.store_type, v_store.store_type, 'admin_assign_passup',
    coalesce(p_note, '') || ' | Gave ' || v_points || ' pass-up points from ' || v_orders
    || ' orders to ' || p_partner_id
  );

  RETURN jsonb_build_object('success', true, 'orders', v_orders, 'points', v_points);
END;
$$;

REVOKE ALL ON FUNCTION doctors.admin_list_unclaimed_passup(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION doctors.admin_list_unclaimed_passup(text) TO service_role;
REVOKE ALL ON FUNCTION doctors.admin_assign_unclaimed_passup(text, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION doctors.admin_assign_unclaimed_passup(text, uuid, uuid, text) TO service_role;

-- 3. Unclaimed pass-up points: sandbox (same bodies against sandbox orders and points)
CREATE OR REPLACE FUNCTION sandbox.admin_list_unclaimed_passup(p_admin_password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sandbox, doctors, public
AS $$
BEGIN
  PERFORM doctors.assert_wheel_admin(p_admin_password);

  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object('store_id', t.store_id, 'orders', t.orders, 'points', t.points))
    FROM (
      SELECT so.referral_doctor_id AS store_id, count(*) AS orders, sum(own.points) AS points
      FROM sandbox.shop_orders so
      JOIN doctors.doctor_registrations dr ON dr.id = so.referral_doctor_id AND dr.store_type <> 'main'
      JOIN sandbox.partner_points own
        ON own.order_id = so.id AND own.partner_id = so.referral_doctor_id AND own.depth = 0
      WHERE so.payment_status = 'paid'
        AND NOT EXISTS (SELECT 1 FROM sandbox.partner_points up WHERE up.order_id = so.id AND up.depth = 1)
      GROUP BY so.referral_doctor_id
    ) t
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION sandbox.admin_assign_unclaimed_passup(
  p_admin_password text,
  p_store_id uuid,
  p_partner_id uuid,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sandbox, doctors, public
AS $$
DECLARE
  v_store doctors.doctor_registrations%ROWTYPE;
  v_orders integer;
  v_points integer;
BEGIN
  PERFORM doctors.assert_wheel_admin(p_admin_password);

  SELECT * INTO v_store FROM doctors.doctor_registrations WHERE id = p_store_id FOR UPDATE;
  IF v_store.id IS NULL THEN
    RAISE EXCEPTION 'Store not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_store.store_type = 'main' THEN
    RAISE EXCEPTION 'Main Store sales have no pass-up points to assign.' USING ERRCODE = '22023';
  END IF;
  IF p_partner_id = p_store_id THEN
    RAISE EXCEPTION 'A store cannot receive its own pass-up points.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM doctors.doctor_registrations WHERE id = p_partner_id) THEN
    RAISE EXCEPTION 'Partner not found.' USING ERRCODE = 'P0002';
  END IF;

  WITH ins AS (
    INSERT INTO sandbox.partner_points (order_id, partner_id, points, depth)
    SELECT so.id, p_partner_id, own.points, 1
    FROM sandbox.shop_orders so
    JOIN sandbox.partner_points own
      ON own.order_id = so.id AND own.partner_id = so.referral_doctor_id AND own.depth = 0
    WHERE so.referral_doctor_id = p_store_id
      AND so.payment_status = 'paid'
      AND NOT EXISTS (SELECT 1 FROM sandbox.partner_points up WHERE up.order_id = so.id AND up.depth = 1)
    ON CONFLICT (order_id, partner_id) DO NOTHING
    RETURNING points
  )
  SELECT count(*), coalesce(sum(points), 0) INTO v_orders, v_points FROM ins;

  IF v_orders = 0 THEN
    RAISE EXCEPTION 'This store has no unclaimed pass-up points.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO sandbox.store_promotions (partner_id, from_type, to_type, trigger_type, trigger_admin_note)
  VALUES (
    v_store.id, v_store.store_type::text::sandbox.store_type, v_store.store_type::text::sandbox.store_type,
    'admin_assign_passup',
    coalesce(p_note, '') || ' | Gave ' || v_points || ' pass-up points from ' || v_orders
    || ' orders to ' || p_partner_id
  );

  RETURN jsonb_build_object('success', true, 'orders', v_orders, 'points', v_points);
END;
$$;

REVOKE ALL ON FUNCTION sandbox.admin_list_unclaimed_passup(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION sandbox.admin_list_unclaimed_passup(text) TO service_role;
REVOKE ALL ON FUNCTION sandbox.admin_assign_unclaimed_passup(text, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION sandbox.admin_assign_unclaimed_passup(text, uuid, uuid, text) TO service_role;
