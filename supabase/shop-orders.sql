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
  zip text not null,
  subtotal numeric(12, 2) not null default 0,
  items jsonb not null default '[]'::jsonb,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shop_orders_created_at_idx on public.shop_orders (created_at desc);
create index if not exists shop_orders_status_idx on public.shop_orders (status, payment_status);

alter table public.shop_orders enable row level security;

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
  zip text,
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
    shop_orders.zip,
    shop_orders.subtotal,
    shop_orders.items,
    shop_orders.admin_notes,
    shop_orders.created_at,
    shop_orders.updated_at
  from public.shop_orders
  where id = p_order_id
  limit 1;
$$;

create or replace function public.create_shop_order(
  p_customer_name text,
  p_email text,
  p_mobile text,
  p_address text,
  p_city text,
  p_province text,
  p_zip text,
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
  zip text,
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
    zip,
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
    trim(p_zip),
    p_items,
    coalesce(p_subtotal, 0),
    lower(trim(coalesce(p_payment_method, 'maya')))
  )
  returning shop_orders.id into v_order_id;

  return query
  select
    saved.id,
    saved.order_code,
    saved.status,
    saved.payment_status,
    saved.payment_method,
    saved.maya_reference,
    saved.customer_name,
    saved.email,
    saved.mobile,
    saved.address,
    saved.city,
    saved.province,
    saved.zip,
    saved.subtotal,
    saved.items,
    saved.admin_notes,
    saved.created_at,
    saved.updated_at
  from public.admin_get_shop_order_unchecked(v_order_id) saved;
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
  zip text,
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
    shop_orders.zip,
    shop_orders.subtotal,
    shop_orders.items,
    shop_orders.admin_notes,
    shop_orders.created_at,
    shop_orders.updated_at
  from public.shop_orders
  order by shop_orders.created_at desc;
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
  zip text,
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
  select
    saved.id,
    saved.order_code,
    saved.status,
    saved.payment_status,
    saved.payment_method,
    saved.maya_reference,
    saved.customer_name,
    saved.email,
    saved.mobile,
    saved.address,
    saved.city,
    saved.province,
    saved.zip,
    saved.subtotal,
    saved.items,
    saved.admin_notes,
    saved.created_at,
    saved.updated_at
  from public.admin_get_shop_order_unchecked(p_order_id) saved;
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
  zip text,
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

  return query
  select
    saved.id,
    saved.order_code,
    saved.status,
    saved.payment_status,
    saved.payment_method,
    saved.maya_reference,
    saved.customer_name,
    saved.email,
    saved.mobile,
    saved.address,
    saved.city,
    saved.province,
    saved.zip,
    saved.subtotal,
    saved.items,
    saved.admin_notes,
    saved.created_at,
    saved.updated_at
  from public.admin_get_shop_order_unchecked(p_order_id) saved;
end;
$$;

grant execute on function public.create_shop_order(text, text, text, text, text, text, text, jsonb, numeric, text) to anon, authenticated;
grant execute on function public.admin_list_shop_orders(text) to anon, authenticated;
grant execute on function public.admin_get_shop_order(text, uuid) to anon, authenticated;
grant execute on function public.admin_update_shop_order(text, uuid, text, text, text, text) to anon, authenticated;
