alter table doctors.doctor_registrations
  add column if not exists name_prefix text not null default '';

drop function if exists doctors.admin_update_doctor_registration(text, uuid, text, text, text, text, text, text, text);
drop function if exists doctors.admin_list_doctor_registrations(text);
drop function if exists doctors.register_doctor(text, text, text, text, text, text, text);

create function doctors.register_doctor(
  p_full_name text,
  p_email text,
  p_mobile text,
  p_tiktok_username text,
  p_specialty text,
  p_practice_location text,
  p_referrer_slug text default null,
  p_name_prefix text default ''
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
    select d.id into v_referrer_id from doctors.doctor_registrations d
    where d.routing_slug = lower(trim(p_referrer_slug)) limit 1;
  end if;

  insert into doctors.doctor_registrations (
    name_prefix, full_name, email, mobile, tiktok_username, specialty, practice_location,
    routing_slug, redirect_url, referred_by_partner_id
  ) values (
    trim(coalesce(p_name_prefix, '')),
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

create function doctors.admin_list_doctor_registrations(p_admin_password text)
returns table (
  id uuid,
  full_name text,
  name_prefix text,
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
set search_path = doctors, public
as $$
begin
  perform doctors.assert_wheel_admin(p_admin_password);

  return query
  select
    doctor_registrations.id,
    doctor_registrations.full_name::text,
    doctor_registrations.name_prefix::text,
    doctor_registrations.email::text,
    doctor_registrations.mobile::text,
    doctor_registrations.tiktok_username::text,
    doctor_registrations.routing_slug::text,
    coalesce(doctor_registrations.redirect_url, '')::text,
    doctor_registrations.specialty::text,
    doctor_registrations.practice_location::text,
    doctor_registrations.created_at,
    null::text as prize_label,
    null::timestamptz as prize_claimed_at
  from doctors.doctor_registrations
  order by doctor_registrations.created_at desc;
end;
$$;

create function doctors.admin_update_doctor_registration(
  p_admin_password text,
  p_doctor_id uuid,
  p_full_name text,
  p_email text,
  p_mobile text,
  p_tiktok_username text,
  p_specialty text,
  p_practice_location text,
  p_redirect_url text default null,
  p_name_prefix text default ''
)
returns table (
  id uuid,
  full_name text,
  name_prefix text,
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
set search_path = doctors, public
as $$
begin
  perform doctors.assert_wheel_admin(p_admin_password);

  update doctors.doctor_registrations
  set
    name_prefix = trim(coalesce(p_name_prefix, '')),
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
  from doctors.admin_list_doctor_registrations(p_admin_password) registrations
  where registrations.id = p_doctor_id;
end;
$$;

grant execute on function doctors.register_doctor(text, text, text, text, text, text, text, text) to anon, authenticated, service_role;
grant execute on function doctors.admin_list_doctor_registrations(text) to anon, authenticated, service_role;
grant execute on function doctors.admin_update_doctor_registration(text, uuid, text, text, text, text, text, text, text, text) to anon, authenticated, service_role;
