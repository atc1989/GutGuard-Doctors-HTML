CREATE OR REPLACE FUNCTION doctors.admin_update_doctor_registration(p_admin_password text, p_doctor_id uuid, p_full_name text, p_email text, p_mobile text, p_tiktok_username text, p_specialty text, p_practice_location text, p_redirect_url text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, full_name text, email text, mobile text, tiktok_username text, routing_slug text, redirect_url text, specialty text, practice_location text, created_at timestamp with time zone, prize_label text, prize_claimed_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
begin
  perform doctors.assert_wheel_admin(p_admin_password);

  update doctors.doctor_registrations
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
  from doctors.admin_list_doctor_registrations(p_admin_password) registrations
  where registrations.id = p_doctor_id;
end;
$function$;