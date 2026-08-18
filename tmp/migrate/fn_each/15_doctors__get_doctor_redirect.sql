CREATE OR REPLACE FUNCTION doctors.get_doctor_redirect(p_routing_slug text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
  select redirect_url
  from doctors.doctor_registrations
  where routing_slug = lower(trim(p_routing_slug))
  limit 1;
$function$;