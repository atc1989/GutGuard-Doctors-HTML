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
  loop
    v_code := 'GG-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));
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

create or replace function public.admin_get_shop_order_unchecked(p_order_id uuid)
returns table (
  id uuid,
  order_code text,
  status text,
  payment_status text,
  payment_method text,
  maya_reference text,
  customer_name text,
  email text,
  mobile text,
  address text,
  city text,
  province text,
  barangay text,
  zip text,
  province_code text,
  city_municipality_code text,
  barangay_code text,
  shipping_region text,
  shipping_fee numeric,
  shipping_weight_grams integer,
  total_amount numeric,
  subtotal numeric,
  items jsonb,
  admin_notes text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    shop_orders.id,
    shop_orders.order_code,
    shop_orders.status,
    shop_orders.payment_status,
    shop_orders.payment_method,
    shop_orders.maya_reference,
    shop_orders.customer_name,
    shop_orders.email,
    shop_orders.mobile,
    shop_orders.address,
    shop_orders.city,
    shop_orders.province,
    shop_orders.barangay,
    shop_orders.zip,
    shop_orders.province_code,
    shop_orders.city_municipality_code,
    shop_orders.barangay_code,
    shop_orders.shipping_region,
    coalesce(shop_orders.shipping_fee, 0),
    coalesce(shop_orders.shipping_weight_grams, 0),
    coalesce(nullif(shop_orders.total_amount, 0), shop_orders.subtotal + coalesce(shop_orders.shipping_fee, 0)),
    shop_orders.subtotal,
    shop_orders.items,
    shop_orders.admin_notes,
    shop_orders.created_at,
    shop_orders.updated_at
  from public.shop_orders
  where id = p_order_id
  limit 1;
$$;

drop function if exists public.create_shop_order(text, text, text, text, text, text, text, jsonb, numeric, text);

create or replace function public.create_shop_order(
  p_customer_name text,
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
  p_payment_method text default 'maya'
)
returns table (
  id uuid,
  order_code text,
  status text,
  payment_status text,
  payment_method text,
  maya_reference text,
  customer_name text,
  email text,
  mobile text,
  address text,
  city text,
  province text,
  barangay text,
  zip text,
  province_code text,
  city_municipality_code text,
  barangay_code text,
  shipping_region text,
  shipping_fee numeric,
  shipping_weight_grams integer,
  total_amount numeric,
  subtotal numeric,
  items jsonb,
  admin_notes text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
begin
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'Order must include at least one item.';
  end if;

  insert into public.shop_orders (
    order_code,
    customer_name,
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
    payment_method
  )
  values (
    public.generate_shop_order_code(),
    trim(p_customer_name),
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
    lower(trim(coalesce(p_payment_method, 'maya')))
  )
  returning shop_orders.id into v_order_id;

  return query select * from public.admin_get_shop_order_unchecked(v_order_id);
end;
$$;

create or replace function public.admin_list_shop_orders(p_admin_password text)
returns table (
  id uuid,
  order_code text,
  status text,
  payment_status text,
  payment_method text,
  maya_reference text,
  customer_name text,
  email text,
  mobile text,
  address text,
  city text,
  province text,
  barangay text,
  zip text,
  province_code text,
  city_municipality_code text,
  barangay_code text,
  shipping_region text,
  shipping_fee numeric,
  shipping_weight_grams integer,
  total_amount numeric,
  subtotal numeric,
  items jsonb,
  admin_notes text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_wheel_admin(p_admin_password);

  return query
  select listed.*
  from public.shop_orders
  cross join lateral public.admin_get_shop_order_unchecked(shop_orders.id) listed
  order by listed.created_at desc;
end;
$$;

create or replace function public.admin_get_shop_order(p_admin_password text, p_order_id uuid)
returns table (
  id uuid,
  order_code text,
  status text,
  payment_status text,
  payment_method text,
  maya_reference text,
  customer_name text,
  email text,
  mobile text,
  address text,
  city text,
  province text,
  barangay text,
  zip text,
  province_code text,
  city_municipality_code text,
  barangay_code text,
  shipping_region text,
  shipping_fee numeric,
  shipping_weight_grams integer,
  total_amount numeric,
  subtotal numeric,
  items jsonb,
  admin_notes text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_wheel_admin(p_admin_password);

  return query select * from public.admin_get_shop_order_unchecked(p_order_id);
end;
$$;

create or replace function public.admin_update_shop_order(
  p_admin_password text,
  p_order_id uuid,
  p_status text,
  p_payment_status text,
  p_maya_reference text default null,
  p_admin_notes text default null
)
returns table (
  id uuid,
  order_code text,
  status text,
  payment_status text,
  payment_method text,
  maya_reference text,
  customer_name text,
  email text,
  mobile text,
  address text,
  city text,
  province text,
  barangay text,
  zip text,
  province_code text,
  city_municipality_code text,
  barangay_code text,
  shipping_region text,
  shipping_fee numeric,
  shipping_weight_grams integer,
  total_amount numeric,
  subtotal numeric,
  items jsonb,
  admin_notes text,
  created_at timestamptz,
  updated_at timestamptz
)
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
    admin_notes = nullif(trim(coalesce(p_admin_notes, '')), '')
  where shop_orders.id = p_order_id;

  return query select * from public.admin_get_shop_order_unchecked(p_order_id);
end;
$$;

grant execute on function public.create_shop_order(text, text, text, text, text, text, text, text, text, text, text, text, numeric, integer, numeric, jsonb, numeric, text) to anon, authenticated;
grant execute on function public.admin_list_shop_orders(text) to anon, authenticated;
grant execute on function public.admin_get_shop_order(text, uuid) to anon, authenticated;
grant execute on function public.admin_update_shop_order(text, uuid, text, text, text, text) to anon, authenticated;
