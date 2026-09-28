-- Migration: E-Points Referral Pass-Up (1-Level, Cycles)

-- 1. Create tables in PUBLIC schema
CREATE TABLE IF NOT EXISTS public.partner_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.shop_orders(id) ON DELETE CASCADE,
    partner_id UUID NOT NULL REFERENCES public.doctor_registrations(id) ON DELETE CASCADE,
    points INTEGER NOT NULL,
    depth INTEGER NOT NULL CHECK (depth IN (0, 1)),
    created_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(order_id, partner_id) 
);

CREATE INDEX IF NOT EXISTS idx_partner_points_partner_id ON public.partner_points(partner_id);

CREATE TABLE IF NOT EXISTS public.milestone_unlocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL REFERENCES public.doctor_registrations(id) ON DELETE CASCADE,
    cycle_number INTEGER NOT NULL,
    milestone_pts INTEGER NOT NULL,
    rebate_amount NUMERIC NOT NULL,
    status VARCHAR(50) DEFAULT 'unlocked',
    created_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(partner_id, cycle_number, milestone_pts)
);

CREATE INDEX IF NOT EXISTS idx_milestone_unlocks_partner_id ON public.milestone_unlocks(partner_id);


-- 2. Create tables in SANDBOX schema
CREATE TABLE IF NOT EXISTS sandbox.partner_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES sandbox.shop_orders(id) ON DELETE CASCADE,
    partner_id UUID NOT NULL REFERENCES public.doctor_registrations(id) ON DELETE CASCADE,
    points INTEGER NOT NULL,
    depth INTEGER NOT NULL CHECK (depth IN (0, 1)),
    created_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(order_id, partner_id) 
);

CREATE INDEX IF NOT EXISTS idx_sbx_partner_points_partner_id ON sandbox.partner_points(partner_id);

CREATE TABLE IF NOT EXISTS sandbox.milestone_unlocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL REFERENCES public.doctor_registrations(id) ON DELETE CASCADE,
    cycle_number INTEGER NOT NULL,
    milestone_pts INTEGER NOT NULL,
    rebate_amount NUMERIC NOT NULL,
    status VARCHAR(50) DEFAULT 'unlocked',
    created_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(partner_id, cycle_number, milestone_pts)
);

CREATE INDEX IF NOT EXISTS idx_sbx_milestone_unlocks_partner_id ON sandbox.milestone_unlocks(partner_id);


-- 3. Update public.partner_dashboard()
CREATE OR REPLACE FUNCTION public.partner_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_doctor public.doctor_registrations;
BEGIN
  v_email := nullif(lower(trim(coalesce(auth.jwt() ->> 'email', ''))), '');

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Sign in to view your dashboard.' USING errcode = '42501';
  END IF;

  SELECT * INTO v_doctor
  FROM public.doctor_registrations
  WHERE email = v_email
  LIMIT 1;

  IF v_doctor.id IS NULL THEN
    RAISE EXCEPTION 'This email is not registered as a GutGuard partner.' USING errcode = '42501';
  END IF;

  RETURN jsonb_build_object(
    'partner', jsonb_build_object(
      'full_name', v_doctor.full_name,
      'routing_slug', v_doctor.routing_slug,
      'joined_at', v_doctor.created_at
    ),
    'clicks', jsonb_build_object(
      'total', (
        SELECT count(*) FROM public.referral_clicks c WHERE c.doctor_id = v_doctor.id
      ),
      'last_30_days', (
        SELECT count(*) FROM public.referral_clicks c
        WHERE c.doctor_id = v_doctor.id AND c.created_at >= now() - interval '30 days'
      )
    ),
    'points', (
      SELECT jsonb_build_object(
        'total_all_time', coalesce(sum(p.points), 0),
        'current_cycle', floor(coalesce(sum(p.points), 0) / 1500) + 1,
        'points_in_cycle', coalesce(sum(p.points), 0) % 1500
      )
      FROM public.partner_points p
      WHERE p.partner_id = v_doctor.id
    ),
    'rebates', (
      SELECT coalesce(jsonb_agg(
        jsonb_build_object(
          'cycle_number', m.cycle_number,
          'milestone_pts', m.milestone_pts,
          'rebate_amount', m.rebate_amount,
          'status', m.status,
          'unlocked_at', m.created_at
        ) ORDER BY m.created_at DESC
      ), '[]'::jsonb)
      FROM public.milestone_unlocks m
      WHERE m.partner_id = v_doctor.id
    ),
    'totals', (
      SELECT jsonb_build_object(
        'orders', count(*),
        'paid_orders', count(*) filter (where o.payment_status = 'paid'),
        'paid_amount', coalesce(sum(
          coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0))
        ) filter (where o.payment_status = 'paid'), 0)
      )
      FROM public.shop_orders o
      WHERE o.referral_doctor_id = v_doctor.id
    ),
    'orders', (
      SELECT coalesce(jsonb_agg(entry order by sort_at desc), '[]'::jsonb)
      FROM (
        SELECT o.created_at as sort_at, jsonb_build_object(
          'order_code', o.order_code,
          'created_at', o.created_at,
          'status', o.status,
          'payment_status', o.payment_status,
          'total_amount', coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0)),
          'buyer_first_name', coalesce(o.first_name, split_part(o.customer_name, ' ', 1)),
          'city', o.city,
          'province', o.province
        ) as entry
        FROM public.shop_orders o
        WHERE o.referral_doctor_id = v_doctor.id
        ORDER BY o.created_at DESC
        LIMIT 200
      ) recent
    )
  );
END;
$$;


-- 4. Update sandbox.partner_dashboard()
CREATE OR REPLACE FUNCTION sandbox.partner_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = sandbox, public
AS $$
DECLARE
  v_email text;
  v_doctor public.doctor_registrations;
BEGIN
  v_email := nullif(lower(trim(coalesce(auth.jwt() ->> 'email', ''))), '');

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Sign in to view your dashboard.' USING errcode = '42501';
  END IF;

  SELECT * INTO v_doctor
  FROM public.doctor_registrations
  WHERE email = v_email
  LIMIT 1;

  IF v_doctor.id IS NULL THEN
    RAISE EXCEPTION 'This email is not registered as a GutGuard partner.' USING errcode = '42501';
  END IF;

  RETURN jsonb_build_object(
    'partner', jsonb_build_object(
      'full_name', v_doctor.full_name,
      'routing_slug', v_doctor.routing_slug,
      'joined_at', v_doctor.created_at
    ),
    'clicks', jsonb_build_object(
      'total', (
        SELECT count(*) FROM sandbox.referral_clicks c WHERE c.doctor_id = v_doctor.id
      ),
      'last_30_days', (
        SELECT count(*) FROM sandbox.referral_clicks c
        WHERE c.doctor_id = v_doctor.id AND c.created_at >= now() - interval '30 days'
      )
    ),
    'points', (
      SELECT jsonb_build_object(
        'total_all_time', coalesce(sum(p.points), 0),
        'current_cycle', floor(coalesce(sum(p.points), 0) / 1500) + 1,
        'points_in_cycle', coalesce(sum(p.points), 0) % 1500
      )
      FROM sandbox.partner_points p
      WHERE p.partner_id = v_doctor.id
    ),
    'rebates', (
      SELECT coalesce(jsonb_agg(
        jsonb_build_object(
          'cycle_number', m.cycle_number,
          'milestone_pts', m.milestone_pts,
          'rebate_amount', m.rebate_amount,
          'status', m.status,
          'unlocked_at', m.created_at
        ) ORDER BY m.created_at DESC
      ), '[]'::jsonb)
      FROM sandbox.milestone_unlocks m
      WHERE m.partner_id = v_doctor.id
    ),
    'totals', (
      SELECT jsonb_build_object(
        'orders', count(*),
        'paid_orders', count(*) filter (where o.payment_status = 'paid'),
        'paid_amount', coalesce(sum(
          coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0))
        ) filter (where o.payment_status = 'paid'), 0)
      )
      FROM sandbox.shop_orders o
      WHERE o.referral_doctor_id = v_doctor.id
    ),
    'orders', (
      SELECT coalesce(jsonb_agg(entry order by sort_at desc), '[]'::jsonb)
      FROM (
        SELECT o.created_at as sort_at, jsonb_build_object(
          'order_code', o.order_code,
          'created_at', o.created_at,
          'status', o.status,
          'payment_status', o.payment_status,
          'total_amount', coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0)),
          'buyer_first_name', coalesce(o.first_name, split_part(o.customer_name, ' ', 1)),
          'city', o.city,
          'province', o.province
        ) as entry
        FROM sandbox.shop_orders o
        WHERE o.referral_doctor_id = v_doctor.id
        ORDER BY o.created_at DESC
        LIMIT 200
      ) recent
    )
  );
END;
$$;

-- 5. RPC to process points (called from Next.js server on webhook)
-- We need two versions, one for public, one for sandbox, or we can do it in application code.
-- Because Next.js already handles the schemas correctly via `getSupabaseAdmin(schema)`,
-- doing the points calculation in application code (lib/maya-orders.ts) is actually better
-- and more aligned with their existing codebase pattern!
