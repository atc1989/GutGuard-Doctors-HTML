-- Partner referral tree (one level). Idempotent snapshot of the live LifeStyle RPCs
-- in `doctors` / `sandbox`. Production already has these; re-applying is CREATE OR REPLACE.

alter table doctors.doctor_registrations
  add column if not exists referred_by_partner_id uuid;

create index if not exists doctor_registrations_referred_by_partner_id_idx
  on doctors.doctor_registrations (referred_by_partner_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'doctor_registrations_referred_by_partner_id_fkey'
      and conrelid = 'doctors.doctor_registrations'::regclass
  ) then
    alter table doctors.doctor_registrations
      add constraint doctor_registrations_referred_by_partner_id_fkey
      foreign key (referred_by_partner_id) references doctors.doctor_registrations(id);
  end if;
end $$;

create or replace function doctors.prevent_partner_referrer_change()
returns trigger
language plpgsql
set search_path = doctors, public
as $$
begin
  if new.referred_by_partner_id is distinct from old.referred_by_partner_id then
    raise exception 'Partner referral attribution cannot be changed.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists doctor_registrations_referrer_immutable on doctors.doctor_registrations;
create trigger doctor_registrations_referrer_immutable
before update on doctors.doctor_registrations
for each row execute function doctors.prevent_partner_referrer_change();

create or replace function doctors.get_partner_invitation(p_slug text)
returns table (routing_slug text, full_name text)
language sql
stable
security definer
set search_path = doctors, public
as $$
  select d.routing_slug, d.full_name
  from doctors.doctor_registrations d
  where d.routing_slug = lower(trim(coalesce(p_slug, '')))
  limit 1;
$$;

grant execute on function doctors.get_partner_invitation(text) to anon, authenticated;

drop function if exists doctors.register_doctor(text, text, text, text, text, text);
drop function if exists doctors.register_doctor(text, text, text, text, text, text, text);

create or replace function doctors.register_doctor(
  p_full_name text,
  p_email text,
  p_mobile text,
  p_tiktok_username text,
  p_specialty text,
  p_practice_location text,
  p_referrer_slug text default null
)
returns uuid
language plpgsql
security definer
set search_path = doctors, public
as $$
declare
  v_doctor_id uuid;
  v_referrer_id uuid;
  v_tiktok_username text;
begin
  v_tiktok_username := regexp_replace(lower(trim(coalesce(p_tiktok_username, ''))), '^@+', '');
  if nullif(lower(trim(coalesce(p_referrer_slug, ''))), '') is not null then
    select d.id into v_referrer_id
    from doctors.doctor_registrations d
    where d.routing_slug = lower(trim(p_referrer_slug))
    limit 1;
  end if;

  insert into doctors.doctor_registrations (
    full_name, email, mobile, tiktok_username, specialty, practice_location,
    routing_slug, redirect_url, referred_by_partner_id
  ) values (
    trim(p_full_name),
    coalesce(nullif(lower(trim(coalesce(p_email, ''))), ''), ''),
    trim(p_mobile),
    v_tiktok_username,
    trim(p_specialty),
    trim(p_practice_location),
    doctors.make_unique_doctor_slug(p_full_name),
    case when v_tiktok_username = '' then null else 'https://www.tiktok.com/@' || v_tiktok_username end,
    v_referrer_id
  ) returning id into v_doctor_id;

  if v_referrer_id = v_doctor_id then
    raise exception 'A partner cannot refer themselves.' using errcode = '23514';
  end if;
  return v_doctor_id;
end;
$$;

drop function if exists doctors.partner_dashboard();
drop function if exists doctors.partner_dashboard(text, text, integer, integer, timestamptz, timestamptz, text);

create or replace function doctors.partner_dashboard(
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
set search_path = doctors, public
as $$
declare
  v_email text;
  v_doctor doctors.doctor_registrations;
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
  select * into v_doctor from doctors.doctor_registrations where email = v_email limit 1;
  if v_doctor.id is null then
    raise exception 'This email is not registered as a GutGuard partner.' using errcode = '42501';
  end if;

  select count(*) into v_order_count
  from doctors.shop_orders o
  join doctors.doctor_registrations source on source.id = o.referral_doctor_id
  where (source.id = v_doctor.id or source.referred_by_partner_id = v_doctor.id)
    and (v_scope = 'all' or (v_scope = 'direct' and source.id = v_doctor.id)
      or (v_scope = 'referred' and source.referred_by_partner_id = v_doctor.id))
    and (nullif(lower(trim(coalesce(p_status, ''))), '') is null
      or lower(o.payment_status) = lower(trim(p_status))
      or lower(o.status) = lower(trim(p_status)))
    and (p_date_from is null or o.created_at >= p_date_from)
    and (p_date_to is null or o.created_at < p_date_to + interval '1 day');

  select coalesce(jsonb_agg(entry order by
    case when lower(coalesce(p_sort, 'newest')) = 'oldest' then sort_at end asc,
    case when lower(coalesce(p_sort, 'newest')) = 'newest' then sort_at end desc
  ), '[]'::jsonb) into v_orders
  from (
    select o.created_at as sort_at, jsonb_build_object(
      'order_code', o.order_code, 'created_at', o.created_at, 'status', o.status,
      'payment_status', o.payment_status,
      'total_amount', coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0)),
      'buyer_first_name', coalesce(o.first_name, split_part(o.customer_name, ' ', 1)),
      'city', o.city, 'province', o.province,
      'source_type', case when source.id = v_doctor.id then 'direct' else 'referred' end,
      'source_partner_name', source.full_name,
      'source_partner_slug', source.routing_slug
    ) as entry
    from doctors.shop_orders o
    join doctors.doctor_registrations source on source.id = o.referral_doctor_id
    where (source.id = v_doctor.id or source.referred_by_partner_id = v_doctor.id)
      and (v_scope = 'all' or (v_scope = 'direct' and source.id = v_doctor.id)
        or (v_scope = 'referred' and source.referred_by_partner_id = v_doctor.id))
      and (nullif(lower(trim(coalesce(p_status, ''))), '') is null
        or lower(o.payment_status) = lower(trim(p_status))
        or lower(o.status) = lower(trim(p_status)))
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
      'total', (select count(*) from doctors.referral_clicks c where c.doctor_id = v_doctor.id),
      'last_30_days', (
        select count(*) from doctors.referral_clicks c
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
          select count(*) from doctors.doctor_registrations d where d.referred_by_partner_id = v_doctor.id
        )
      )
      from doctors.shop_orders o
      join doctors.doctor_registrations source on source.id = o.referral_doctor_id
      where source.id = v_doctor.id or source.referred_by_partner_id = v_doctor.id
    ),
    'orders', v_orders,
    'orders_page', jsonb_build_object(
      'total', v_order_count, 'limit', v_limit, 'offset', v_offset,
      'has_more', v_offset + jsonb_array_length(v_orders) < v_order_count
    ),
    'referred_partners', (
      select coalesce(jsonb_agg(entry order by joined_at desc), '[]'::jsonb)
      from (
        select child.created_at as joined_at, jsonb_build_object(
          'full_name', child.full_name, 'routing_slug', child.routing_slug,
          'specialty', child.specialty, 'practice_location', child.practice_location,
          'joined_at', child.created_at, 'orders', count(o.id),
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
end;
$$;

revoke all on function doctors.partner_dashboard(text, text, integer, integer, timestamptz, timestamptz, text) from public, anon;
grant execute on function doctors.partner_dashboard(text, text, integer, integer, timestamptz, timestamptz, text) to authenticated;

drop function if exists sandbox.partner_dashboard();
drop function if exists sandbox.partner_dashboard(text, text, integer, integer, timestamptz, timestamptz, text);

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
set search_path = sandbox, doctors, public
as $$
declare
  v_email text;
  v_doctor doctors.doctor_registrations;
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
  select * into v_doctor from doctors.doctor_registrations where email = v_email limit 1;
  if v_doctor.id is null then
    raise exception 'This email is not registered as a GutGuard partner.' using errcode = '42501';
  end if;

  select count(*) into v_order_count
  from sandbox.shop_orders o
  join doctors.doctor_registrations source on source.id = o.referral_doctor_id
  where (source.id = v_doctor.id or source.referred_by_partner_id = v_doctor.id)
    and (v_scope = 'all' or (v_scope = 'direct' and source.id = v_doctor.id)
      or (v_scope = 'referred' and source.referred_by_partner_id = v_doctor.id))
    and (nullif(lower(trim(coalesce(p_status, ''))), '') is null
      or lower(o.payment_status) = lower(trim(p_status))
      or lower(o.status) = lower(trim(p_status)))
    and (p_date_from is null or o.created_at >= p_date_from)
    and (p_date_to is null or o.created_at < p_date_to + interval '1 day');

  select coalesce(jsonb_agg(entry order by
    case when lower(coalesce(p_sort, 'newest')) = 'oldest' then sort_at end asc,
    case when lower(coalesce(p_sort, 'newest')) = 'newest' then sort_at end desc
  ), '[]'::jsonb) into v_orders
  from (
    select o.created_at as sort_at, jsonb_build_object(
      'order_code', o.order_code, 'created_at', o.created_at, 'status', o.status,
      'payment_status', o.payment_status,
      'total_amount', coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0)),
      'buyer_first_name', coalesce(o.first_name, split_part(o.customer_name, ' ', 1)),
      'city', o.city, 'province', o.province,
      'source_type', case when source.id = v_doctor.id then 'direct' else 'referred' end,
      'source_partner_name', source.full_name,
      'source_partner_slug', source.routing_slug
    ) as entry
    from sandbox.shop_orders o
    join doctors.doctor_registrations source on source.id = o.referral_doctor_id
    where (source.id = v_doctor.id or source.referred_by_partner_id = v_doctor.id)
      and (v_scope = 'all' or (v_scope = 'direct' and source.id = v_doctor.id)
        or (v_scope = 'referred' and source.referred_by_partner_id = v_doctor.id))
      and (nullif(lower(trim(coalesce(p_status, ''))), '') is null
        or lower(o.payment_status) = lower(trim(p_status))
        or lower(o.status) = lower(trim(p_status)))
      and (p_date_from is null or o.created_at >= p_date_from)
      and (p_date_to is null or o.created_at < p_date_to + interval '1 day')
    order by
      case when lower(coalesce(p_sort, 'newest')) = 'oldest' then o.created_at end asc,
      case when lower(coalesce(p_sort, 'newest')) = 'newest' then o.created_at end desc
    limit v_limit offset v_offset
  ) page;

  return jsonb_build_object(
    'partner', jsonb_build_object(
      'full_name', v_doctor.full_name, 'routing_slug', v_doctor.routing_slug, 'joined_at', v_doctor.created_at
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
          select count(*) from doctors.doctor_registrations d where d.referred_by_partner_id = v_doctor.id
        )
      )
      from sandbox.shop_orders o
      join doctors.doctor_registrations source on source.id = o.referral_doctor_id
      where source.id = v_doctor.id or source.referred_by_partner_id = v_doctor.id
    ),
    'orders', v_orders,
    'orders_page', jsonb_build_object(
      'total', v_order_count, 'limit', v_limit, 'offset', v_offset,
      'has_more', v_offset + jsonb_array_length(v_orders) < v_order_count
    ),
    'referred_partners', (
      select coalesce(jsonb_agg(entry order by joined_at desc), '[]'::jsonb)
      from (
        select child.created_at as joined_at, jsonb_build_object(
          'full_name', child.full_name, 'routing_slug', child.routing_slug,
          'specialty', child.specialty, 'practice_location', child.practice_location,
          'joined_at', child.created_at, 'orders', count(o.id),
          'paid_order_value', coalesce(sum(
            coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0))
          ) filter (where o.payment_status = 'paid'), 0)
        ) as entry
        from doctors.doctor_registrations child
        left join sandbox.shop_orders o on o.referral_doctor_id = child.id
        where child.referred_by_partner_id = v_doctor.id
        group by child.id
        order by child.created_at desc
      ) partners
    )
  );
end;
$$;

revoke all on function sandbox.partner_dashboard(text, text, integer, integer, timestamptz, timestamptz, text) from public, anon;
grant execute on function sandbox.partner_dashboard(text, text, integer, integer, timestamptz, timestamptz, text) to authenticated;
