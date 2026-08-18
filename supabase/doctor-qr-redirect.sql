-- Dynamic Doctor QR Redirects
-- Run this in the Supabase SQL editor for the GutGuard Doctors project.

alter table public.doctor_registrations
  add column if not exists routing_slug text,
  add column if not exists redirect_url text,
  add column if not exists referred_by_partner_id uuid;

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

drop function if exists public.register_doctor(text, text, text, text, text, text);
drop function if exists public.register_doctor(text, text, text, text, text, text, text);

create or replace function public.register_doctor(
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
set search_path = public
as $$
declare
  v_doctor_id uuid;
  v_referrer_id uuid;
  v_tiktok_username text;
begin
  v_tiktok_username := regexp_replace(lower(trim(coalesce(p_tiktok_username, ''))), '^@+', '');

  if nullif(lower(trim(coalesce(p_referrer_slug, ''))), '') is not null then
    select d.id into v_referrer_id
    from public.doctor_registrations d
    where d.routing_slug = lower(trim(p_referrer_slug))
    limit 1;
  end if;

  insert into public.doctor_registrations (
    full_name,
    email,
    mobile,
    tiktok_username,
    specialty,
    practice_location,
    routing_slug,
    redirect_url,
    referred_by_partner_id
  )
  values (
    trim(p_full_name),
    coalesce(nullif(lower(trim(coalesce(p_email, ''))), ''), ''),
    trim(p_mobile),
    v_tiktok_username,
    trim(p_specialty),
    trim(p_practice_location),
    public.make_unique_doctor_slug(p_full_name),
    case
      when v_tiktok_username = '' then null
      else 'https://www.tiktok.com/@' || v_tiktok_username
    end,
    v_referrer_id
  )
  returning id into v_doctor_id;

  if v_referrer_id = v_doctor_id then
    raise exception 'A partner cannot refer themselves.' using errcode = '23514';
  end if;

  return v_doctor_id;
end;
$$;

create or replace function public.get_partner_invitation(p_slug text)
returns table (routing_slug text, full_name text)
language sql
stable
security definer
set search_path = public
as $$
  select d.routing_slug, d.full_name
  from public.doctor_registrations d
  where d.routing_slug = lower(trim(coalesce(p_slug, '')))
  limit 1;
$$;

grant execute on function public.get_partner_invitation(text) to anon, authenticated;

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

create table if not exists public.sms_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message_template text not null,
  recipient_count integer not null default 0,
  provider text,
  created_at timestamptz not null default now()
);

create table if not exists public.sms_sends (
  id uuid primary key default gen_random_uuid(),
  sms_campaign_id uuid references public.sms_campaigns(id) on delete set null,
  doctor_id uuid references public.doctor_registrations(id) on delete cascade,
  mobile text not null default '',
  message text not null,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  provider_message_id text,
  error_message text,
  sent_at timestamptz not null default now()
);

create index if not exists sms_sends_doctor_id_sent_at_idx
  on public.sms_sends (doctor_id, sent_at desc);

create index if not exists sms_sends_sms_campaign_id_idx
  on public.sms_sends (sms_campaign_id);

alter table public.sms_campaigns enable row level security;
alter table public.sms_sends enable row level security;

create or replace function public.admin_list_sms_sends(p_admin_password text)
returns table (
  id uuid,
  doctor_id uuid,
  sms_campaign_id uuid,
  sms_campaign_title text,
  mobile text,
  message text,
  status text,
  provider_message_id text,
  error_message text,
  sent_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_wheel_admin(p_admin_password);

  return query
  select
    sms_sends.id,
    sms_sends.doctor_id,
    sms_sends.sms_campaign_id,
    sms_campaigns.title,
    sms_sends.mobile,
    sms_sends.message,
    sms_sends.status,
    sms_sends.provider_message_id,
    sms_sends.error_message,
    sms_sends.sent_at
  from public.sms_sends
  left join public.sms_campaigns on sms_campaigns.id = sms_sends.sms_campaign_id
  order by sms_sends.sent_at desc;
end;
$$;

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
