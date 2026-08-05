-- GutGuard Shop Orders
-- Run this in the Supabase SQL editor for the GutGuard Doctors project.

create table if not exists public.shop_orders (
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

alter table public.shop_orders add column if not exists barangay text not null default '';
alter table public.shop_orders add column if not exists province_code text;
alter table public.shop_orders add column if not exists city_municipality_code text;
alter table public.shop_orders add column if not exists barangay_code text;
alter table public.shop_orders add column if not exists shipping_region text;
alter table public.shop_orders add column if not exists shipping_fee numeric(12, 2) not null default 0;
alter table public.shop_orders add column if not exists shipping_weight_grams integer not null default 0;
alter table public.shop_orders add column if not exists total_amount numeric(12, 2) not null default 0;

-- First/last name collected separately: Kount scores the buyer name, and splitting a
-- single field guesses wrong on compound Filipino surnames ("dela Cruz", "de los Santos").
-- customer_name stays populated so emails, admin and shipping labels are unaffected.
alter table public.shop_orders add column if not exists first_name text;
alter table public.shop_orders add column if not exists last_name text;

update public.shop_orders
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
alter table public.shop_orders add column if not exists referral_slug text;
alter table public.shop_orders add column if not exists referral_doctor_id uuid
  references public.doctor_registrations(id) on delete set null;

create index if not exists shop_orders_referral_doctor_id_idx
  on public.shop_orders (referral_doctor_id, created_at desc);

-- Maya Checkout API integration
alter table public.shop_orders add column if not exists maya_checkout_id text;
alter table public.shop_orders add column if not exists maya_payment_id text;
alter table public.shop_orders add column if not exists maya_payment_status text;
alter table public.shop_orders add column if not exists maya_request_reference text;
alter table public.shop_orders add column if not exists maya_fund_source text;
alter table public.shop_orders add column if not exists payment_attempts integer not null default 0;
alter table public.shop_orders add column if not exists paid_at timestamptz;

create index if not exists shop_orders_order_code_idx on public.shop_orders (order_code);
create index if not exists shop_orders_maya_payment_id_idx on public.shop_orders (maya_payment_id);

update public.shop_orders
set total_amount = coalesce(nullif(total_amount, 0), subtotal + coalesce(shipping_fee, 0))
where total_amount = 0;

create index if not exists shop_orders_created_at_idx on public.shop_orders (created_at desc);
create index if not exists shop_orders_status_idx on public.shop_orders (status, payment_status);

alter table public.shop_orders enable row level security;

create table if not exists public.shop_order_email_sends (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.shop_orders(id) on delete cascade,
  email text not null,
  subject text not null,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  resend_id text,
  error_message text,
  sent_at timestamptz not null default now()
);

create index if not exists shop_order_email_sends_order_id_idx
  on public.shop_order_email_sends (order_id, sent_at desc);

alter table public.shop_order_email_sends enable row level security;

create or replace function public.generate_shop_order_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  -- 8 hex chars, not 4. get_shop_order_public exposes the order (including the delivery
  -- address) to anyone holding the code, and 4 chars is only 65k combinations per day -
  -- cheap to enumerate. 8 chars makes scraping infeasible. Older short codes still resolve.
  loop
    v_code := 'GG-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from public.shop_orders where order_code = v_code);
  end loop;

  return v_code;
end;
$$;

create or replace function public.touch_shop_order_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists shop_orders_touch_updated_at on public.shop_orders;
create trigger shop_orders_touch_updated_at
before update on public.shop_orders
for each row execute function public.touch_shop_order_updated_at();

drop function if exists public.admin_update_shop_order(text, uuid, text, text, text, text);
drop function if exists public.admin_get_shop_order(text, uuid);
drop function if exists public.admin_list_shop_orders(text);
drop function if exists public.create_shop_order(text, text, text, text, text, text, text, jsonb, numeric, text);
drop function if exists public.create_shop_order(text, text, text, text, text, text, text, text, text, text, text, text, numeric, integer, numeric, jsonb, numeric, text);
drop function if exists public.create_shop_order(text, text, text, text, text, text, text, text, text, text, text, text, text, numeric, integer, numeric, jsonb, numeric, text);
drop function if exists public.create_shop_order(text, text, text, text, text, text, text, text, text, text, text, text, text, numeric, integer, numeric, jsonb, numeric, text, text);
drop function if exists public.admin_get_shop_order_unchecked(uuid);
drop function if exists public.get_shop_order_public(text);
drop function if exists public.get_referral_partner(text);

-- Existence check for /r/[slug]. Returns the slug only - no name or contact - so the
-- endpoint cannot be used to enumerate partner details.
create or replace function public.get_referral_partner(p_slug text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select routing_slug
  from public.doctor_registrations
  where routing_slug = lower(trim(p_slug))
  limit 1;
$$;

grant execute on function public.get_referral_partner(text) to anon, authenticated;

create or replace function public.admin_get_shop_order_unchecked(p_order_id uuid)
returns setof public.shop_orders
language sql
stable
security definer
set search_path = public
as $$
  select * from public.shop_orders where id = p_order_id limit 1;
$$;

create or replace function public.create_shop_order(
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
returns setof public.shop_orders
language plpgsql
security definer
set search_path = public
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

  insert into public.shop_orders (
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
    public.generate_shop_order_code(),
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

  return query select * from public.admin_get_shop_order_unchecked(v_order_id);
end;
$$;

-- Public receipt / payment-status lookup for /shop/order/[code].
-- The order code is a weak secret, so contact details are masked and admin notes withheld.
create or replace function public.get_shop_order_public(p_order_code text)
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
set search_path = public
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
  from public.shop_orders o
  where upper(trim(o.order_code)) = upper(trim(p_order_code))
  limit 1;
$$;

create or replace function public.admin_list_shop_orders(p_admin_password text)
returns setof public.shop_orders
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_wheel_admin(p_admin_password);

  return query
  select * from public.shop_orders order by created_at desc;
end;
$$;

create or replace function public.admin_get_shop_order(p_admin_password text, p_order_id uuid)
returns setof public.shop_orders
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_wheel_admin(p_admin_password);

  return query select * from public.admin_get_shop_order_unchecked(p_order_id);
end;
$$;

-- Admin override only. Maya's webhook is the normal writer of status/payment_status;
-- maya_reference stays editable so a phone-confirmed payment can still be reconciled by hand.
create or replace function public.admin_update_shop_order(
  p_admin_password text,
  p_order_id uuid,
  p_status text,
  p_payment_status text,
  p_maya_reference text default null,
  p_admin_notes text default null
)
returns setof public.shop_orders
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_wheel_admin(p_admin_password);

  update public.shop_orders
  set
    status = p_status,
    payment_status = p_payment_status,
    maya_reference = nullif(trim(coalesce(p_maya_reference, '')), ''),
    admin_notes = nullif(trim(coalesce(p_admin_notes, '')), ''),
    paid_at = case when p_payment_status = 'paid' then coalesce(paid_at, now()) else paid_at end
  where shop_orders.id = p_order_id;

  return query select * from public.admin_get_shop_order_unchecked(p_order_id);
end;
$$;

grant execute on function public.create_shop_order(text, text, text, text, text, text, text, text, text, text, text, text, text, numeric, integer, numeric, jsonb, numeric, text, text) to anon, authenticated;
grant execute on function public.get_shop_order_public(text) to anon, authenticated;
grant execute on function public.admin_list_shop_orders(text) to anon, authenticated;
grant execute on function public.admin_get_shop_order(text, uuid) to anon, authenticated;
grant execute on function public.admin_update_shop_order(text, uuid, text, text, text, text) to anon, authenticated;
