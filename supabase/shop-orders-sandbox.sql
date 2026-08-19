-- GutGuard Shop Orders - SANDBOX MIRROR
-- Generated from shop-orders.sql. Same objects, in the `sandbox` schema, so the
-- mirrored shop at sandbox.gutguard.ph runs identical code against separate data.
--
-- Shared with production on purpose (NOT duplicated):
--   public.doctor_registrations  - referral slugs work with the real partners
--   public.assert_wheel_admin    - one admin password for both systems
--
-- Run this AFTER shop-orders.sql and doctor-qr-redirect.sql.

create schema if not exists sandbox;
grant usage on schema sandbox to anon, authenticated, service_role;
alter default privileges in schema sandbox grant all on tables to service_role;

create table if not exists sandbox.shop_orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique,
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'payment_review', 'paid', 'confirmed', 'cancelled', 'fulfilled')),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'review', 'paid', 'failed', 'refunded')),
  payment_method text not null default 'maya',
  maya_reference text,
  customer_name text not null,
  email text not null,
  mobile text not null,
  address text not null,
  city text not null,
  province text not null,
  barangay text not null default '',
  zip text not null,
  province_code text,
  city_municipality_code text,
  barangay_code text,
  shipping_region text,
  shipping_fee numeric(12, 2) not null default 0,
  shipping_weight_grams integer not null default 0,
  total_amount numeric(12, 2) not null default 0,
  subtotal numeric(12, 2) not null default 0,
  items jsonb not null default '[]'::jsonb,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table sandbox.shop_orders add column if not exists barangay text not null default '';
alter table sandbox.shop_orders add column if not exists province_code text;
alter table sandbox.shop_orders add column if not exists city_municipality_code text;
alter table sandbox.shop_orders add column if not exists barangay_code text;
alter table sandbox.shop_orders add column if not exists shipping_region text;
alter table sandbox.shop_orders add column if not exists shipping_fee numeric(12, 2) not null default 0;
alter table sandbox.shop_orders add column if not exists shipping_weight_grams integer not null default 0;
alter table sandbox.shop_orders add column if not exists total_amount numeric(12, 2) not null default 0;

-- First/last name collected separately: Kount scores the buyer name, and splitting a
-- single field guesses wrong on compound Filipino surnames ("dela Cruz", "de los Santos").
-- customer_name stays populated so emails, admin and shipping labels are unaffected.
alter table sandbox.shop_orders add column if not exists first_name text;
alter table sandbox.shop_orders add column if not exists last_name text;

update sandbox.shop_orders
set
  first_name = coalesce(first_name, nullif(split_part(customer_name, ' ', 1), '')),
  last_name = coalesce(
    last_name,
    nullif(substr(customer_name, length(split_part(customer_name, ' ', 1)) + 2), '')
  )
where first_name is null or last_name is null;

-- Referral attribution (last-click, 30-day window set by the /r/[slug] cookie).
-- referral_slug records what the link claimed; referral_doctor_id is set only when the
-- referral is valid AND not a self-referral, so "attributed" means referral_doctor_id is
-- not null. Keeping the slug on a rejected self-referral leaves an audit trail.
alter table sandbox.shop_orders add column if not exists referral_slug text;
alter table sandbox.shop_orders add column if not exists referral_doctor_id uuid
  references public.doctor_registrations(id) on delete set null;

create index if not exists sandbox_shop_orders_referral_doctor_id_idx
  on sandbox.shop_orders (referral_doctor_id, created_at desc);

-- Maya Checkout API integration
alter table sandbox.shop_orders add column if not exists maya_checkout_id text;
alter table sandbox.shop_orders add column if not exists maya_payment_id text;
alter table sandbox.shop_orders add column if not exists maya_payment_status text;
alter table sandbox.shop_orders add column if not exists maya_request_reference text;
alter table sandbox.shop_orders add column if not exists maya_fund_source text;
alter table sandbox.shop_orders add column if not exists payment_attempts integer not null default 0;
alter table sandbox.shop_orders add column if not exists paid_at timestamptz;

create index if not exists sandbox_shop_orders_order_code_idx on sandbox.shop_orders (order_code);
create index if not exists sandbox_shop_orders_maya_payment_id_idx on sandbox.shop_orders (maya_payment_id);

update sandbox.shop_orders
set total_amount = coalesce(nullif(total_amount, 0), subtotal + coalesce(shipping_fee, 0))
where total_amount = 0;

create index if not exists sandbox_shop_orders_created_at_idx on sandbox.shop_orders (created_at desc);
create index if not exists sandbox_shop_orders_status_idx on sandbox.shop_orders (status, payment_status);

alter table sandbox.shop_orders enable row level security;

create table if not exists sandbox.shop_order_email_sends (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references sandbox.shop_orders(id) on delete cascade,
  email text not null,
  subject text not null,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  resend_id text,
  error_message text,
  sent_at timestamptz not null default now()
);

create index if not exists sandbox_shop_order_email_sends_order_id_idx
  on sandbox.shop_order_email_sends (order_id, sent_at desc);

alter table sandbox.shop_order_email_sends enable row level security;

create or replace function sandbox.generate_shop_order_code()
returns text
language plpgsql
security definer
set search_path = sandbox, public
as $$
declare
  v_code text;
begin
  -- 8 hex chars, not 4. get_shop_order_public exposes the order (including the delivery
  -- address) to anyone holding the code, and 4 chars is only 65k combinations per day -
  -- cheap to enumerate. 8 chars makes scraping infeasible. Older short codes still resolve.
  loop
    v_code := 'GG-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from sandbox.shop_orders where order_code = v_code);
  end loop;

  return v_code;
end;
$$;

create or replace function sandbox.touch_shop_order_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists shop_orders_touch_updated_at on sandbox.shop_orders;
create trigger shop_orders_touch_updated_at
before update on sandbox.shop_orders
for each row execute function sandbox.touch_shop_order_updated_at();

drop function if exists sandbox.admin_update_shop_order(text, uuid, text, text, text, text);
drop function if exists sandbox.admin_get_shop_order(text, uuid);
drop function if exists sandbox.admin_list_shop_orders(text);
drop function if exists sandbox.create_shop_order(text, text, text, text, text, text, text, jsonb, numeric, text);
drop function if exists sandbox.create_shop_order(text, text, text, text, text, text, text, text, text, text, text, text, numeric, integer, numeric, jsonb, numeric, text);
drop function if exists sandbox.create_shop_order(text, text, text, text, text, text, text, text, text, text, text, text, text, numeric, integer, numeric, jsonb, numeric, text);
drop function if exists sandbox.create_shop_order(text, text, text, text, text, text, text, text, text, text, text, text, text, numeric, integer, numeric, jsonb, numeric, text, text);
drop function if exists sandbox.admin_get_shop_order_unchecked(uuid);
drop function if exists sandbox.get_shop_order_public(text);
drop function if exists sandbox.get_referral_partner(text);

-- Existence check for /r/[slug]. Returns the slug only - no name or contact - so the
-- endpoint cannot be used to enumerate partner details.
create or replace function sandbox.get_referral_partner(p_slug text)
returns text
language sql
stable
security definer
set search_path = sandbox, public
as $$
  select routing_slug
  from public.doctor_registrations
  where routing_slug = lower(trim(p_slug))
  limit 1;
$$;

grant execute on function sandbox.get_referral_partner(text) to anon, authenticated;

create or replace function sandbox.admin_get_shop_order_unchecked(p_order_id uuid)
returns setof sandbox.shop_orders
language sql
stable
security definer
set search_path = sandbox, public
as $$
  select * from sandbox.shop_orders where id = p_order_id limit 1;
$$;

create or replace function sandbox.create_shop_order(
  p_first_name text,
  p_last_name text,
  p_email text,
  p_mobile text,
  p_address text,
  p_city text,
  p_province text,
  p_barangay text,
  p_zip text,
  p_province_code text,
  p_city_municipality_code text,
  p_barangay_code text,
  p_shipping_region text,
  p_shipping_fee numeric,
  p_shipping_weight_grams integer,
  p_total_amount numeric,
  p_items jsonb,
  p_subtotal numeric,
  p_payment_method text default 'maya',
  p_referral_slug text default null
)
returns setof sandbox.shop_orders
language plpgsql
security definer
set search_path = sandbox, public
as $$
declare
  v_order_id uuid;
  v_referral_slug text;
  v_referral_doctor_id uuid;
begin
  v_referral_slug := nullif(lower(trim(coalesce(p_referral_slug, ''))), '');

  -- Resolve the referrer, but refuse to credit a partner for their own order.
  -- Matching on email OR mobile so a second email address is not an easy dodge.
  if v_referral_slug is not null then
    select d.id into v_referral_doctor_id
    from public.doctor_registrations d
    where d.routing_slug = v_referral_slug
      and lower(trim(coalesce(d.email, ''))) is distinct from lower(trim(coalesce(p_email, '')))
      and nullif(regexp_replace(coalesce(d.mobile, ''), '\D', '', 'g'), '')
          is distinct from nullif(regexp_replace(coalesce(p_mobile, ''), '\D', '', 'g'), '')
    limit 1;
  end if;

  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'Order must include at least one item.';
  end if;

  if length(trim(coalesce(p_first_name, ''))) = 0 or length(trim(coalesce(p_last_name, ''))) = 0 then
    raise exception 'First and last name are required.';
  end if;

  insert into sandbox.shop_orders (
    order_code,
    customer_name,
    first_name,
    last_name,
    email,
    mobile,
    address,
    city,
    province,
    barangay,
    zip,
    province_code,
    city_municipality_code,
    barangay_code,
    shipping_region,
    shipping_fee,
    shipping_weight_grams,
    total_amount,
    items,
    subtotal,
    payment_method,
    referral_slug,
    referral_doctor_id
  )
  values (
    sandbox.generate_shop_order_code(),
    trim(p_first_name) || ' ' || trim(p_last_name),
    trim(p_first_name),
    trim(p_last_name),
    lower(trim(p_email)),
    trim(p_mobile),
    trim(p_address),
    trim(p_city),
    trim(p_province),
    trim(p_barangay),
    trim(p_zip),
    nullif(trim(coalesce(p_province_code, '')), ''),
    nullif(trim(coalesce(p_city_municipality_code, '')), ''),
    nullif(trim(coalesce(p_barangay_code, '')), ''),
    nullif(trim(coalesce(p_shipping_region, '')), ''),
    coalesce(p_shipping_fee, 0),
    coalesce(p_shipping_weight_grams, 0),
    coalesce(p_total_amount, coalesce(p_subtotal, 0) + coalesce(p_shipping_fee, 0)),
    p_items,
    coalesce(p_subtotal, 0),
    lower(trim(coalesce(p_payment_method, 'maya'))),
    v_referral_slug,
    v_referral_doctor_id
  )
  returning shop_orders.id into v_order_id;

  return query select * from sandbox.admin_get_shop_order_unchecked(v_order_id);
end;
$$;

-- Public receipt / payment-status lookup for /shop/order/[code].
-- The order code is a weak secret, so contact details are masked and admin notes withheld.
create or replace function sandbox.get_shop_order_public(p_order_code text)
returns table (
  order_code text,
  status text,
  payment_status text,
  payment_attempts integer,
  maya_reference text,
  maya_fund_source text,
  first_name text,
  email_masked text,
  address text,
  barangay text,
  city text,
  province text,
  zip text,
  shipping_region text,
  shipping_fee numeric,
  subtotal numeric,
  total_amount numeric,
  items jsonb,
  created_at timestamptz,
  paid_at timestamptz,
  order_id uuid
)
language sql
stable
security definer
set search_path = sandbox, public
as $$
  select
    o.order_code,
    o.status,
    o.payment_status,
    coalesce(o.payment_attempts, 0),
    o.maya_reference,
    o.maya_fund_source,
    split_part(o.customer_name, ' ', 1),
    regexp_replace(o.email, '^(.).*@', '\1***@'),
    o.address,
    o.barangay,
    o.city,
    o.province,
    o.zip,
    o.shipping_region,
    coalesce(o.shipping_fee, 0),
    o.subtotal,
    coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0)),
    o.items,
    o.created_at,
    o.paid_at,
    o.id
  from sandbox.shop_orders o
  where upper(trim(o.order_code)) = upper(trim(p_order_code))
  limit 1;
$$;

create or replace function sandbox.admin_list_shop_orders(p_admin_password text)
returns setof sandbox.shop_orders
language plpgsql
security definer
set search_path = sandbox, public
as $$
begin
  perform public.assert_wheel_admin(p_admin_password);

  return query
  select * from sandbox.shop_orders order by created_at desc;
end;
$$;

create or replace function sandbox.admin_get_shop_order(p_admin_password text, p_order_id uuid)
returns setof sandbox.shop_orders
language plpgsql
security definer
set search_path = sandbox, public
as $$
begin
  perform public.assert_wheel_admin(p_admin_password);

  return query select * from sandbox.admin_get_shop_order_unchecked(p_order_id);
end;
$$;

-- Admin override only. Maya's webhook is the normal writer of status/payment_status;
-- maya_reference stays editable so a phone-confirmed payment can still be reconciled by hand.
create or replace function sandbox.admin_update_shop_order(
  p_admin_password text,
  p_order_id uuid,
  p_status text,
  p_payment_status text,
  p_maya_reference text default null,
  p_admin_notes text default null
)
returns setof sandbox.shop_orders
language plpgsql
security definer
set search_path = sandbox, public
as $$
begin
  perform public.assert_wheel_admin(p_admin_password);

  update sandbox.shop_orders
  set
    status = p_status,
    payment_status = p_payment_status,
    maya_reference = nullif(trim(coalesce(p_maya_reference, '')), ''),
    admin_notes = nullif(trim(coalesce(p_admin_notes, '')), ''),
    paid_at = case when p_payment_status = 'paid' then coalesce(paid_at, now()) else paid_at end
  where shop_orders.id = p_order_id;

  return query select * from sandbox.admin_get_shop_order_unchecked(p_order_id);
end;
$$;

grant execute on function sandbox.create_shop_order(text, text, text, text, text, text, text, text, text, text, text, text, text, numeric, integer, numeric, jsonb, numeric, text, text) to anon, authenticated;
grant execute on function sandbox.get_shop_order_public(text) to anon, authenticated;
grant execute on function sandbox.admin_list_shop_orders(text) to anon, authenticated;
grant execute on function sandbox.admin_get_shop_order(text, uuid) to anon, authenticated;
grant execute on function sandbox.admin_update_shop_order(text, uuid, text, text, text, text) to anon, authenticated;

-- Belt and braces: default privileges only cover tables created after they are set, so
-- grant explicitly too. anon/authenticated deliberately get NO table rights - RLS is on
-- and every read/write goes through the security-definer functions granted above.
grant select, insert, update, delete on all tables in schema sandbox to service_role;

-- REMINDER: expose the schema to the Data API or every call 404s:
--   Supabase Dashboard -> Settings -> API -> Data API -> Exposed schemas -> add "sandbox"

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
drop function if exists sandbox.partner_dashboard(text, text, integer, integer, timestamptz, timestamptz, text);

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

create or replace function sandbox.partner_dashboard(
  p_scope text default 'all',
  p_status text default null,
  p_limit integer default 25,
  p_offset integer default 0,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null,
  p_sort text default 'newest'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = sandbox, public
as $$
declare
  v_email text;
  v_doctor public.doctor_registrations;
  v_scope text := lower(trim(coalesce(p_scope, 'all')));
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_order_count bigint;
  v_orders jsonb;
begin
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

  select * into v_doctor from public.doctor_registrations where email = v_email limit 1;
  if v_doctor.id is null then
    raise exception 'This email is not registered as a GutGuard partner.' using errcode = '42501';
  end if;

  select count(*) into v_order_count
  from sandbox.shop_orders o
  join public.doctor_registrations source on source.id = o.referral_doctor_id
  where (source.id = v_doctor.id or source.referred_by_partner_id = v_doctor.id)
    and (
      v_scope = 'all'
      or (v_scope = 'direct' and source.id = v_doctor.id)
      or (v_scope = 'referred' and source.referred_by_partner_id = v_doctor.id)
    )
    and (
      nullif(lower(trim(coalesce(p_status, ''))), '') is null
      or lower(o.payment_status) = lower(trim(p_status))
      or lower(o.status) = lower(trim(p_status))
    )
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
      'city', o.city,
      'province', o.province,
      'source_type', case when source.id = v_doctor.id then 'direct' else 'referred' end,
      'source_partner_name', source.full_name,
      'source_partner_slug', source.routing_slug
    ) as entry
    from sandbox.shop_orders o
    join public.doctor_registrations source on source.id = o.referral_doctor_id
    where (source.id = v_doctor.id or source.referred_by_partner_id = v_doctor.id)
      and (
        v_scope = 'all'
        or (v_scope = 'direct' and source.id = v_doctor.id)
        or (v_scope = 'referred' and source.referred_by_partner_id = v_doctor.id)
      )
      and (
        nullif(lower(trim(coalesce(p_status, ''))), '') is null
        or lower(o.payment_status) = lower(trim(p_status))
        or lower(o.status) = lower(trim(p_status))
      )
      and (p_date_from is null or o.created_at >= p_date_from)
      and (p_date_to is null or o.created_at < p_date_to + interval '1 day')
    order by
      case when lower(coalesce(p_sort, 'newest')) = 'oldest' then o.created_at end asc,
      case when lower(coalesce(p_sort, 'newest')) = 'newest' then o.created_at end desc
    limit v_limit offset v_offset
  ) page;

  return jsonb_build_object(
    'partner', jsonb_build_object(
      'full_name', v_doctor.full_name,
      'routing_slug', v_doctor.routing_slug,
      'joined_at', v_doctor.created_at
    ),
    'clicks', jsonb_build_object(
      'total', (select count(*) from sandbox.referral_clicks c where c.doctor_id = v_doctor.id),
      'last_30_days', (
        select count(*) from sandbox.referral_clicks c
        where c.doctor_id = v_doctor.id and c.created_at >= now() - interval '30 days'
      )
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
          select count(*) from public.doctor_registrations d where d.referred_by_partner_id = v_doctor.id
        )
      )
      from sandbox.shop_orders o
      join public.doctor_registrations source on source.id = o.referral_doctor_id
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
          'joined_at', child.created_at,
          'orders', count(o.id),
          'paid_order_value', coalesce(sum(
            coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0))
          ) filter (where o.payment_status = 'paid'), 0)
        ) as entry
        from public.doctor_registrations child
        left join sandbox.shop_orders o on o.referral_doctor_id = child.id
        where child.referred_by_partner_id = v_doctor.id
        group by child.id
        order by child.created_at desc
      ) partners
    )
  );
end;
$$;

-- See the note in shop-orders.sql: the revoke is what actually keeps anon out.
revoke all on function sandbox.partner_dashboard(text, text, integer, integer, timestamptz, timestamptz, text) from public, anon;
grant execute on function sandbox.partner_dashboard(text, text, integer, integer, timestamptz, timestamptz, text) to authenticated;
