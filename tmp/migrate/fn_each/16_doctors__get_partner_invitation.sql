CREATE OR REPLACE FUNCTION doctors.get_partner_invitation(p_slug text)
 RETURNS TABLE(routing_slug text, full_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
  select d.routing_slug, d.full_name
  from doctors.doctor_registrations d
  where d.routing_slug = lower(trim(coalesce(p_slug, '')))
  limit 1;
$function$;