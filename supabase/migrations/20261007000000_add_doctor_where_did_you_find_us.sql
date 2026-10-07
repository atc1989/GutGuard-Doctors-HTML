alter table doctors.doctor_registrations
  add column if not exists where_did_you_find_us text not null default '';

-- Overload / update doctors.register_doctor with p_where_did_you_find_us
create or replace function doctors.register_doctor(
  p_full_name text,
  p_email text,
  p_mobile text,
  p_tiktok_username text,
  p_specialty text,
  p_practice_location text,
  p_referrer_slug text default null,
  p_name_prefix text default '',
  p_where_did_you_find_us text default ''
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

  -- Pick an id whose 5-character link key is not taken
  loop
    v_doctor_id := gen_random_uuid();
    exit when not exists (
      select 1 from doctors.doctor_registrations d
      where right(d.id::text, 5) = right(v_doctor_id::text, 5)
    );
  end loop;

  insert into doctors.doctor_registrations (
    id, name_prefix, full_name, email, mobile, tiktok_username, specialty, practice_location,
    where_did_you_find_us, routing_slug, redirect_url, referred_by_partner_id
  ) values (
    v_doctor_id,
    trim(coalesce(p_name_prefix, '')),
    trim(p_full_name),
    coalesce(nullif(lower(trim(coalesce(p_email, ''))), ''), ''),
    trim(p_mobile),
    v_tiktok_username,
    trim(p_specialty),
    trim(p_practice_location),
    trim(coalesce(p_where_did_you_find_us, '')),
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

grant execute on function doctors.register_doctor(text, text, text, text, text, text, text, text, text) to anon, authenticated, service_role;

-- Update admin_list_doctor_registrations to return where_did_you_find_us and referrer details
drop function if exists doctors.admin_list_doctor_registrations(text);

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
  where_did_you_find_us text,
  referred_by_partner_id uuid,
  referrer_name text,
  referrer_prefix text,
  referrer_slug text,
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
    d.id,
    d.full_name::text,
    d.name_prefix::text,
    d.email::text,
    d.mobile::text,
    d.tiktok_username::text,
    d.routing_slug::text,
    coalesce(d.redirect_url, '')::text,
    d.specialty::text,
    d.practice_location::text,
    coalesce(d.where_did_you_find_us, '')::text,
    d.referred_by_partner_id,
    ref.full_name::text as referrer_name,
    ref.name_prefix::text as referrer_prefix,
    ref.routing_slug::text as referrer_slug,
    d.created_at,
    null::text as prize_label,
    null::timestamptz as prize_claimed_at
  from doctors.doctor_registrations d
  left join doctors.doctor_registrations ref on ref.id = d.referred_by_partner_id
  order by d.created_at desc;
end;
$$;

grant execute on function doctors.admin_list_doctor_registrations(text) to service_role;
