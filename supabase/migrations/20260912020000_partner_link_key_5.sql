-- Partner link keys shortened to 5 characters.
--
-- Same scheme as before, fewer characters: the tail of the partner id. At 5 characters a
-- collision is a real possibility rather than a theoretical one, so register_doctor now
-- picks an id whose key is free instead of leaving the unique index to reject the insert.
-- 8-character keys still resolve, for links handed out before this.

-- The LAST characters, not the first: seeded rows share a prefix (4fbb1000-...-0000000N)
-- and differ only in the tail, while the tail of a v4 uuid is fully random.
--
-- 5 characters is only a million keys, so collisions are a real event rather than a
-- theoretical one - at 500 partners there is a ~11% chance two tails match. These indexes
-- make a collision impossible rather than merely unlikely, because a collision would
-- silently misattribute someone's orders; register_doctor picks an id whose key is free,
-- so a partner never sees the failure. The 8-character index stays for links already handed
-- out before the key was shortened.
create unique index if not exists doctor_registrations_link_key_5
  on doctors.doctor_registrations (right(id::text, 5));

create unique index if not exists doctor_registrations_link_key
  on doctors.doctor_registrations (right(id::text, 8));

-- One lookup for every public partner link: /r/<key>, /dr/<key> and ?ref=<key> all accept
-- the last 5 characters of the partner id (what the links print), the last 8 from before the
-- key was shortened, the full id, or the older routing slug. The slug is the partner's name,
-- so it is no longer put on new QR codes, but it keeps resolving because printed codes are
-- already out there.
-- Never grant this to anon/authenticated: it returns the whole row, contact details included.
-- ponytail: sequential scan over a table of partners. Add an index if that ever matters.

create or replace function doctors.partner_by_key(p_key text)
returns setof doctors.doctor_registrations
language sql
stable
security definer
set search_path = doctors, public
as $$
  select d.*
  from doctors.doctor_registrations d
  where nullif(lower(trim(coalesce(p_key, ''))), '') is not null
    and (
      d.routing_slug = lower(trim(p_key))
      or d.id::text = lower(trim(p_key))
      or right(d.id::text, 5) = lower(trim(p_key))
      or right(d.id::text, 8) = lower(trim(p_key))
    )
  limit 1;
$$;

revoke all on function doctors.partner_by_key(text) from public, anon, authenticated;

create or replace function doctors.register_doctor(
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

  -- Pick an id whose 5-character link key is not taken, the same way shop order codes are
  -- allocated. ponytail: two registrations racing here can still collide and raise; at these
  -- volumes that is rarer than the collision it is guarding against, and a retry clears it.
  loop
    v_doctor_id := gen_random_uuid();
    exit when not exists (
      select 1 from doctors.doctor_registrations d
      where right(d.id::text, 5) = right(v_doctor_id::text, 5)
    );
  end loop;

  insert into doctors.doctor_registrations (
    id, name_prefix, full_name, email, mobile, tiktok_username, specialty, practice_location,
    routing_slug, redirect_url, referred_by_partner_id
  ) values (
    v_doctor_id,
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
