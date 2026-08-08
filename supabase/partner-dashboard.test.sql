-- Self-contained check for the partner dashboard SQL.
--
-- Run it with:
--
--   bash supabase/partner-dashboard.test.sh
--
-- Do NOT run this file against your Supabase project. It creates stand-ins for
-- doctor_registrations, shop_orders and auth.jwt(), which would collide with the real
-- tables - the script above spins up a throwaway Postgres in Docker instead, and slices
-- the sections under test straight out of the real schema files so they cannot drift.
--
-- What this is guarding: partner_dashboard() decides what one partner may see about other
-- people's orders. The expensive failures are showing an order that is not theirs and
-- leaking a buyer's contact details, and neither is visible by reading the function.

-- ─── Stand-ins for what Supabase provides ──────────────────────────────────────
create role anon;
create role authenticated;
create role service_role;

create schema auth;
create or replace function auth.jwt() returns jsonb
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
$$;

create table public.doctor_registrations (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  -- NOT NULL with '' as the "no email" marker, matching production. This table predates
  -- the schema files, so its real shape is only visible in the live database - an earlier
  -- version of this stub guessed `email text` and the checks passed against a table that
  -- does not exist anywhere.
  email text not null default '',
  mobile text,
  tiktok_username text,
  specialty text,
  practice_location text,
  routing_slug text not null,
  redirect_url text,
  created_at timestamptz not null default now()
);

create table public.shop_orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique,
  status text not null default 'pending_payment',
  payment_status text not null default 'pending',
  customer_name text not null,
  first_name text,
  city text not null,
  province text not null,
  shipping_fee numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  subtotal numeric(12,2) not null default 0,
  referral_slug text,
  referral_doctor_id uuid references public.doctor_registrations(id) on delete set null,
  created_at timestamptz not null default now()
);

create schema sandbox;
create table sandbox.shop_orders (like public.shop_orders including all);

-- Legacy rows seeded BEFORE the migration runs, in the shape production actually has:
-- mixed case, padding, and empty-string "no email" markers. Without these the
-- normalisation UPDATE is exercised against an empty table and proves nothing - which is
-- how a version that wrote null into a NOT NULL column passed its own check.
insert into public.doctor_registrations (full_name, email, routing_slug)
values ('Legacy Mixed Case', '  Legacy@Clinic.PH ', 'legacy-mixed'),
       ('Legacy No Email', '', 'legacy-no-email'),
       ('Legacy No Email Two', '', 'legacy-no-email-2');

\echo 'Stubs created.'

-- ─── CHECKS ────────────────────────────────────────────────────────────────────
insert into public.doctor_registrations (full_name, email, routing_slug)
values ('Dr Ana Reyes', 'ana@clinic.ph', 'dr-ana-reyes'),
       ('Dr Ben Cruz', 'ben@clinic.ph', 'dr-ben-cruz');

select public.track_referral_click('dr-ana-reyes');
select public.track_referral_click('DR-ANA-REYES  ');
select public.track_referral_click('not-a-partner');

do $$
declare
  v_clicks int;
  v_ana uuid;
  v_ben uuid;
  v_result jsonb;
begin
  -- The migration ran over the legacy rows seeded above: normalised in place, and the
  -- empty-string markers left alone rather than turned into nulls.
  assert (select email from public.doctor_registrations where routing_slug = 'legacy-mixed')
    = 'legacy@clinic.ph', 'legacy email was not normalised';
  assert (select count(*) from public.doctor_registrations where email = '') = 2,
    'empty-string emails must survive the migration untouched';

  select count(*) into v_clicks from public.referral_clicks;
  assert v_clicks = 2, 'unknown slug must not record a click, got ' || v_clicks;

  select id into v_ana from public.doctor_registrations where routing_slug = 'dr-ana-reyes';
  select id into v_ben from public.doctor_registrations where routing_slug = 'dr-ben-cruz';

  insert into public.shop_orders
    (order_code, payment_status, status, customer_name, first_name, city, province,
     subtotal, shipping_fee, total_amount, referral_slug, referral_doctor_id, created_at)
  values
    ('GG-1', 'paid',    'paid',            'Maria Santos', 'Maria', 'Davao City', 'Davao del Sur',
     1000, 100, 1100, 'dr-ana-reyes', v_ana, now() - interval '2 days'),
    ('GG-2', 'pending', 'pending_payment', 'Jose Rizal',   'Jose',  'Cebu City',  'Cebu',
     500, 0, 500, 'dr-ana-reyes', v_ana, now()),
    -- Self-referral: slug kept as an audit trail, doctor id rejected. Must stay invisible.
    ('GG-3', 'paid',    'paid',            'Ana Reyes',    'Ana',   'Manila',     'NCR',
     900, 0, 900, 'dr-ana-reyes', null, now()),
    -- Another partner's order.
    ('GG-4', 'paid',    'paid',            'Pedro Cruz',   'Pedro', 'Iloilo',     'Iloilo',
     700, 0, 700, 'dr-ben-cruz', v_ben, now());

  -- Mixed case and trailing space: the JWT address is whatever the partner typed.
  perform set_config('request.jwt.claims', '{"email":"ANA@clinic.ph "}', true);
  v_result := public.partner_dashboard();

  assert v_result -> 'partner' ->> 'routing_slug' = 'dr-ana-reyes', 'wrong partner resolved';
  assert (v_result -> 'clicks' ->> 'total')::int = 2,
    'click total wrong: ' || (v_result -> 'clicks' ->> 'total');
  assert (v_result -> 'clicks' ->> 'last_30_days')::int = 2, 'click window wrong';
  assert (v_result -> 'totals' ->> 'orders')::int = 2,
    'order count must exclude the self-referral and the other partner, got '
    || (v_result -> 'totals' ->> 'orders');
  assert (v_result -> 'totals' ->> 'paid_orders')::int = 1, 'paid count wrong';
  assert (v_result -> 'totals' ->> 'paid_amount')::numeric = 1100,
    'paid amount must use total_amount, got ' || (v_result -> 'totals' ->> 'paid_amount');
  assert jsonb_array_length(v_result -> 'orders') = 2, 'order list wrong length';
  assert v_result -> 'orders' -> 0 ->> 'order_code' = 'GG-2',
    'newest order must come first, got ' || (v_result -> 'orders' -> 0 ->> 'order_code');

  -- Buyer contact details must never leave the database.
  assert not (v_result -> 'orders' -> 0 ? 'email'), 'buyer email leaked';
  assert not (v_result -> 'orders' -> 0 ? 'mobile'), 'buyer mobile leaked';
  assert not (v_result -> 'orders' -> 0 ? 'address'), 'buyer address leaked';

  -- A verified address that belongs to no partner gets nothing. This is the real access
  -- gate: sign-up is open, so anyone can hold a session.
  perform set_config('request.jwt.claims', '{"email":"stranger@example.com"}', true);
  begin
    perform public.partner_dashboard();
    raise exception 'non-partner email must be rejected';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claims', '', true);
  begin
    perform public.partner_dashboard();
    raise exception 'anonymous caller must be rejected';
  exception when insufficient_privilege then null;
  end;

  -- Email is an identity now, so a second partner cannot claim one.
  begin
    insert into public.doctor_registrations (full_name, email, routing_slug)
    values ('Impostor', 'ana@clinic.ph', 'impostor');
    raise exception 'duplicate partner email must be rejected';
  exception when unique_violation then null;
  end;

  -- ...but the partial index still lets the legacy no-email rows coexist. These are ''
  -- rather than null, which is the case that made the first migration attempt fail.
  insert into public.doctor_registrations (full_name, email, routing_slug)
  values ('No Email One', '', 'no-email-1'), ('No Email Two', '', 'no-email-2');

  -- An empty-email partner must never be reachable by signing in, whatever the JWT says.
  perform set_config('request.jwt.claims', '{"email":""}', true);
  begin
    perform public.partner_dashboard();
    raise exception 'empty email must be rejected';
  exception when insufficient_privilege then null;
  end;

  -- Grants, not just behaviour. Postgres gives EXECUTE to PUBLIC on every new function and
  -- Supabase's default privileges add anon in `public`, so "grant to authenticated" alone
  -- leaves this reachable with the anon key.
  assert not has_function_privilege('anon', 'public.partner_dashboard()', 'execute'),
    'anon must not be able to execute partner_dashboard';
  assert has_function_privilege('authenticated', 'public.partner_dashboard()', 'execute'),
    'authenticated must be able to execute partner_dashboard';
  -- The redirect runs on the anon key, so this one has to stay open.
  assert has_function_privilege('anon', 'public.track_referral_click(text)', 'execute'),
    'anon must be able to execute track_referral_click';

  raise notice 'ALL CHECKS PASSED';
end;
$$;
