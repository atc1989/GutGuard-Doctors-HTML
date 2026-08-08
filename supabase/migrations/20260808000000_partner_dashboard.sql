-- Partner dashboard: referral clicks, click tracking, and the partner-facing read.
-- Sections are generated from doctor-qr-redirect.sql, shop-orders.sql and
-- shop-orders-sandbox.sql, which remain the source of truth. Every statement is idempotent.

-- ─── Partner login identity ────────────────────────────────────────────────────
-- The partner dashboard signs in with Supabase Auth email OTP and matches the verified
-- address against this table, which promotes `email` from a contact field to an identity.
-- No auth_user_id column on purpose: the OTP already proves the partner controls the
-- address, so a second link would only add a row to seed for every partner who registered
-- before this shipped.
--
-- Run this FIRST - the unique index below fails outright if two partners share an address:
--   select count(*) filter (where coalesce(trim(email), '') = '') as no_email,
--          count(*) filter (where coalesce(trim(email), '') <> '')
--            - count(distinct lower(trim(email))) filter (where coalesce(trim(email), '') <> '')
--            as dupes
--   from public.doctor_registrations;

-- Normalise in place, never to null: this column is NOT NULL in production, so "no email"
-- is stored as an empty string and writing null here would abort the whole migration.
-- Rows that are already null (if the constraint is ever relaxed) compare as null and are
-- left alone, so this is correct either way.
update public.doctor_registrations
set email = lower(trim(email))
where email <> lower(trim(email));

-- Partial, so the legacy rows with no email do not collide with each other - both '' and
-- null fall outside the index. Those partners cannot sign in until an address is set via
-- admin_update_doctor_registration, which is deliberately better than inventing a
-- placeholder address, as that would be a login anyone could claim.
-- Dropped first, not `if not exists`: an earlier attempt at this migration used the
-- predicate `where email is not null`, which on a NOT NULL column indexes every row and
-- so collides on the '' markers. `if not exists` would silently keep that wrong index.
drop index if exists public.doctor_registrations_email_key;

create unique index doctor_registrations_email_key
  on public.doctor_registrations (email)
  where email <> '';

-- ─── Partner dashboard ─────────────────────────────────────────────────────────

create table if not exists public.referral_clicks (
  id uuid primary key default gen_random_uuid(),
  routing_slug text not null,
  doctor_id uuid references public.doctor_registrations(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- No IP, user agent or visitor id stored on purpose. The dashboard only ever shows counts,
-- and keeping an identifier would turn a click counter into personal data with nothing
-- asking for it.
-- ponytail: every hit counts, including refreshes and bots. Conversion is a ratio so modest
-- inflation is survivable; add a per-day hashed-IP dedupe if the numbers stop being credible.
create index if not exists referral_clicks_doctor_id_idx
  on public.referral_clicks (doctor_id, created_at desc);

alter table public.referral_clicks enable row level security;

drop function if exists public.track_referral_click(text);
drop function if exists public.partner_dashboard();

-- Supersedes get_referral_partner for /r/[slug]: same return value, plus the click. Doing
-- both in one call keeps the redirect at a single round trip - that link is on printed QR
-- codes, so it is the one call that must not get slower.
create or replace function public.track_referral_click(p_slug text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text;
  v_doctor_id uuid;
begin
  select d.routing_slug, d.id into v_slug, v_doctor_id
  from public.doctor_registrations d
  where d.routing_slug = lower(trim(coalesce(p_slug, '')))
  limit 1;

  -- Unknown slug: no row, no click. Counting misses would let anyone inflate a partner's
  -- numbers by hitting /r/<anything>.
  if v_slug is null then
    return null;
  end if;

  insert into public.referral_clicks (routing_slug, doctor_id) values (v_slug, v_doctor_id);

  return v_slug;
end;
$$;

grant execute on function public.track_referral_click(text) to anon, authenticated;

-- Partner-facing read. Takes no parameters on purpose: the caller is whoever the Supabase
-- Auth JWT says they are, so there is no partner id to tamper with.
--
-- Buyer email, mobile and street address are deliberately NOT selected. A partner needs to
-- know an order happened, not where it ships. Rows are matched on referral_doctor_id, never
-- referral_slug, so a rejected self-referral stays invisible here while remaining on the row
-- as an audit trail.
create or replace function public.partner_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text;
  v_doctor public.doctor_registrations;
begin
  v_email := nullif(lower(trim(coalesce(auth.jwt() ->> 'email', ''))), '');

  if v_email is null then
    raise exception 'Sign in to view your dashboard.' using errcode = '42501';
  end if;

  select * into v_doctor
  from public.doctor_registrations
  where email = v_email
  limit 1;

  -- Anyone can create an auth account, so this is the actual access gate, not the sign-in.
  if v_doctor.id is null then
    raise exception 'This email is not registered as a GutGuard partner.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'partner', jsonb_build_object(
      'full_name', v_doctor.full_name,
      'routing_slug', v_doctor.routing_slug,
      'joined_at', v_doctor.created_at
    ),
    'clicks', jsonb_build_object(
      'total', (
        select count(*) from public.referral_clicks c where c.doctor_id = v_doctor.id
      ),
      'last_30_days', (
        select count(*) from public.referral_clicks c
        where c.doctor_id = v_doctor.id and c.created_at >= now() - interval '30 days'
      )
    ),
    -- paid_amount is gross order value, NOT commission. Commission is a separate,
    -- deliberately unbuilt calculation - do not surface this as "earnings".
    'totals', (
      select jsonb_build_object(
        'orders', count(*),
        'paid_orders', count(*) filter (where o.payment_status = 'paid'),
        'paid_amount', coalesce(sum(
          coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0))
        ) filter (where o.payment_status = 'paid'), 0)
      )
      from public.shop_orders o
      where o.referral_doctor_id = v_doctor.id
    ),
    -- ponytail: newest 200, no pagination. Add it when a partner actually passes 200 orders.
    'orders', (
      -- Sorted at the aggregate, not just in the subquery: a subquery's order is not
      -- contractually preserved through jsonb_agg, and the newest order must come first.
      select coalesce(jsonb_agg(entry order by sort_at desc), '[]'::jsonb)
      from (
        select o.created_at as sort_at, jsonb_build_object(
          'order_code', o.order_code,
          'created_at', o.created_at,
          'status', o.status,
          'payment_status', o.payment_status,
          'total_amount', coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0)),
          'buyer_first_name', coalesce(o.first_name, split_part(o.customer_name, ' ', 1)),
          'city', o.city,
          'province', o.province
        ) as entry
        from public.shop_orders o
        where o.referral_doctor_id = v_doctor.id
        order by o.created_at desc
        limit 200
      ) recent
    )
  );
end;
$$;

-- authenticated only. anon has no business calling this even though it would find no email.
grant execute on function public.partner_dashboard() to authenticated;

-- ─── Partner dashboard ─────────────────────────────────────────────────────────
-- referral_clicks is mirrored rather than shared: sandbox link testing would otherwise
-- inflate the click and conversion numbers real partners are shown.

create table if not exists sandbox.referral_clicks (
  id uuid primary key default gen_random_uuid(),
  routing_slug text not null,
  doctor_id uuid references public.doctor_registrations(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists referral_clicks_doctor_id_idx
  on sandbox.referral_clicks (doctor_id, created_at desc);

alter table sandbox.referral_clicks enable row level security;

drop function if exists sandbox.track_referral_click(text);
drop function if exists sandbox.partner_dashboard();

create or replace function sandbox.track_referral_click(p_slug text)
returns text
language plpgsql
security definer
set search_path = sandbox, public
as $$
declare
  v_slug text;
  v_doctor_id uuid;
begin
  select d.routing_slug, d.id into v_slug, v_doctor_id
  from public.doctor_registrations d
  where d.routing_slug = lower(trim(coalesce(p_slug, '')))
  limit 1;

  if v_slug is null then
    return null;
  end if;

  insert into sandbox.referral_clicks (routing_slug, doctor_id) values (v_slug, v_doctor_id);

  return v_slug;
end;
$$;

grant execute on function sandbox.track_referral_click(text) to anon, authenticated;

create or replace function sandbox.partner_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = sandbox, public
as $$
declare
  v_email text;
  v_doctor public.doctor_registrations;
begin
  v_email := nullif(lower(trim(coalesce(auth.jwt() ->> 'email', ''))), '');

  if v_email is null then
    raise exception 'Sign in to view your dashboard.' using errcode = '42501';
  end if;

  select * into v_doctor
  from public.doctor_registrations
  where email = v_email
  limit 1;

  if v_doctor.id is null then
    raise exception 'This email is not registered as a GutGuard partner.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'partner', jsonb_build_object(
      'full_name', v_doctor.full_name,
      'routing_slug', v_doctor.routing_slug,
      'joined_at', v_doctor.created_at
    ),
    'clicks', jsonb_build_object(
      'total', (
        select count(*) from sandbox.referral_clicks c where c.doctor_id = v_doctor.id
      ),
      'last_30_days', (
        select count(*) from sandbox.referral_clicks c
        where c.doctor_id = v_doctor.id and c.created_at >= now() - interval '30 days'
      )
    ),
    'totals', (
      select jsonb_build_object(
        'orders', count(*),
        'paid_orders', count(*) filter (where o.payment_status = 'paid'),
        'paid_amount', coalesce(sum(
          coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0))
        ) filter (where o.payment_status = 'paid'), 0)
      )
      from sandbox.shop_orders o
      where o.referral_doctor_id = v_doctor.id
    ),
    'orders', (
      select coalesce(jsonb_agg(entry order by sort_at desc), '[]'::jsonb)
      from (
        select o.created_at as sort_at, jsonb_build_object(
          'order_code', o.order_code,
          'created_at', o.created_at,
          'status', o.status,
          'payment_status', o.payment_status,
          'total_amount', coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0)),
          'buyer_first_name', coalesce(o.first_name, split_part(o.customer_name, ' ', 1)),
          'city', o.city,
          'province', o.province
        ) as entry
        from sandbox.shop_orders o
        where o.referral_doctor_id = v_doctor.id
        order by o.created_at desc
        limit 200
      ) recent
    )
  );
end;
$$;

grant execute on function sandbox.partner_dashboard() to authenticated;
