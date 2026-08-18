CREATE OR REPLACE FUNCTION doctors.admin_list_doctor_registrations(p_admin_password text)
 RETURNS TABLE(id uuid, full_name text, email text, mobile text, tiktok_username text, routing_slug text, redirect_url text, specialty text, practice_location text, created_at timestamp with time zone, prize_label text, prize_claimed_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
begin
  perform doctors.assert_wheel_admin(p_admin_password);

  return query
  select
    doctor_registrations.id,
    doctor_registrations.full_name::text,
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
$function$;