CREATE OR REPLACE FUNCTION doctors.get_referral_partner(p_slug text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
  select routing_slug
  from doctors.doctor_registrations
  where routing_slug = lower(trim(p_slug))
  limit 1;
$function$;