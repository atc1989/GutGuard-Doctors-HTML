CREATE OR REPLACE FUNCTION doctors.register_doctor(p_full_name text, p_email text, p_mobile text, p_tiktok_username text, p_specialty text, p_practice_location text, p_referrer_slug text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
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
    full_name, email, mobile, tiktok_username, specialty, practice_location,
    routing_slug, redirect_url, referred_by_partner_id
  ) values (
    trim(p_full_name), coalesce(nullif(lower(trim(coalesce(p_email, ''))), ''), ''),
    trim(p_mobile), v_tiktok_username, trim(p_specialty), trim(p_practice_location),
    doctors.make_unique_doctor_slug(p_full_name),
    case when v_tiktok_username = '' then null else 'https://www.tiktok.com/@' || v_tiktok_username end,
    v_referrer_id
  ) returning id into v_doctor_id;

  if v_referrer_id = v_doctor_id then
    raise exception 'A partner cannot refer themselves.' using errcode = '23514';
  end if;
  return v_doctor_id;
end;
$function$;