-- Dynamic Doctor QR Redirects
-- Run this in the Supabase SQL editor for the GutGuard Doctors project.

alter table public.doctor_registrations
  add column if not exists routing_slug text,
  add column if not exists redirect_url text;

create or replace function public.slugify_doctor_route(input text)
returns text
language sql
immutable
as $$
  select trim(
    both '-' from regexp_replace(
      regexp_replace(lower(coalesce(input, 'doctor')), '[^a-z0-9]+', '-', 'g'),
      '-+',
      '-',
      'g'
    )
  );
$$;

create or replace function public.make_unique_doctor_slug(
  p_full_name text,
  p_doctor_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  base_slug text;
  candidate text;
  suffix integer := 2;
begin
  base_slug := public.slugify_doctor_route(p_full_name);

  if base_slug is null or base_slug = '' then
    base_slug := 'doctor';
  end if;

  candidate := base_slug;

  while exists (
    select 1
    from public.doctor_registrations
    where routing_slug = candidate
      and (p_doctor_id is null or id <> p_doctor_id)
  ) loop
    candidate := base_slug || '-' || suffix::text;
    suffix := suffix + 1;
  end loop;

  return candidate;
end;
$$;

update public.doctor_registrations
set redirect_url = 'https://www.tiktok.com/@' || regexp_replace(lower(trim(coalesce(tiktok_username, ''))), '^@+', '')
where (redirect_url is null or trim(redirect_url) = '')
  and nullif(regexp_replace(lower(trim(coalesce(tiktok_username, ''))), '^@+', ''), '') is not null;

do $$
declare
  doctor record;
begin
  for doctor in
    select id, full_name
    from public.doctor_registrations
    where routing_slug is null or trim(routing_slug) = ''
    order by created_at asc nulls last, id asc
  loop
    update public.doctor_registrations
    set routing_slug = public.make_unique_doctor_slug(doctor.full_name, doctor.id)
    where id = doctor.id;
  end loop;
end;
$$;

alter table public.doctor_registrations
  alter column routing_slug set not null;

create unique index if not exists doctor_registrations_routing_slug_key
  on public.doctor_registrations (routing_slug);

create or replace function public.get_doctor_redirect(p_routing_slug text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select redirect_url
  from public.doctor_registrations
  where routing_slug = lower(trim(p_routing_slug))
  limit 1;
$$;

grant execute on function public.get_doctor_redirect(text) to anon, authenticated;

create or replace function public.register_doctor(
  p_full_name text,
  p_email text,
  p_mobile text,
  p_tiktok_username text,
  p_specialty text,
  p_practice_location text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doctor_id uuid;
  v_tiktok_username text;
begin
  v_tiktok_username := regexp_replace(lower(trim(coalesce(p_tiktok_username, ''))), '^@+', '');

  insert into public.doctor_registrations (
    full_name,
    email,
    mobile,
    tiktok_username,
    specialty,
    practice_location,
    routing_slug,
    redirect_url
  )
  values (
    trim(p_full_name),
    nullif(lower(trim(coalesce(p_email, ''))), ''),
    trim(p_mobile),
    v_tiktok_username,
    trim(p_specialty),
    trim(p_practice_location),
    public.make_unique_doctor_slug(p_full_name),
    case
      when v_tiktok_username = '' then null
      else 'https://www.tiktok.com/@' || v_tiktok_username
    end
  )
  returning id into v_doctor_id;

  return v_doctor_id;
end;
$$;

create or replace function public.admin_list_doctor_registrations(p_admin_password text)
returns table (
  id uuid,
  full_name text,
  email text,
  mobile text,
  tiktok_username text,
  routing_slug text,
  redirect_url text,
  specialty text,
  practice_location text,
  created_at timestamptz,
  prize_label text,
  prize_claimed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_wheel_admin(p_admin_password);

  return query
  select
    doctor_registrations.id,
    doctor_registrations.full_name,
    doctor_registrations.email,
    doctor_registrations.mobile,
    doctor_registrations.tiktok_username,
    doctor_registrations.routing_slug,
    coalesce(doctor_registrations.redirect_url, ''),
    doctor_registrations.specialty,
    doctor_registrations.practice_location,
    doctor_registrations.created_at,
    latest_claim.prize_label,
    latest_claim.claimed_at
  from public.doctor_registrations
  left join lateral (
    select wheel_claims.prize_label, wheel_claims.claimed_at
    from public.wheel_claims
    where wheel_claims.doctor_id = doctor_registrations.id
    order by wheel_claims.claimed_at desc
    limit 1
  ) latest_claim on true
  order by doctor_registrations.created_at desc;
end;
$$;

create or replace function public.admin_update_doctor_registration(
  p_admin_password text,
  p_doctor_id uuid,
  p_full_name text,
  p_email text,
  p_mobile text,
  p_tiktok_username text,
  p_specialty text,
  p_practice_location text,
  p_redirect_url text default null
)
returns table (
  id uuid,
  full_name text,
  email text,
  mobile text,
  tiktok_username text,
  routing_slug text,
  redirect_url text,
  specialty text,
  practice_location text,
  created_at timestamptz,
  prize_label text,
  prize_claimed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_wheel_admin(p_admin_password);

  update public.doctor_registrations
  set
    full_name = trim(p_full_name),
    email = nullif(lower(trim(coalesce(p_email, ''))), ''),
    mobile = trim(p_mobile),
    tiktok_username = regexp_replace(lower(trim(coalesce(p_tiktok_username, ''))), '^@+', ''),
    redirect_url = nullif(trim(coalesce(p_redirect_url, '')), ''),
    specialty = trim(p_specialty),
    practice_location = trim(p_practice_location)
  where doctor_registrations.id = p_doctor_id;

  return query
  select *
  from public.admin_list_doctor_registrations(p_admin_password) registrations
  where registrations.id = p_doctor_id;
end;
$$;
