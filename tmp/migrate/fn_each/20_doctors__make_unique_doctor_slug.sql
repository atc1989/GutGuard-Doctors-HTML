CREATE OR REPLACE FUNCTION doctors.make_unique_doctor_slug(p_full_name text, p_doctor_id uuid DEFAULT NULL::uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
declare
  base_slug text;
  candidate text;
  suffix integer := 2;
begin
  base_slug := doctors.slugify_doctor_route(p_full_name);

  if base_slug is null or base_slug = '' then
    base_slug := 'doctor';
  end if;

  candidate := base_slug;

  while exists (
    select 1
    from doctors.doctor_registrations
    where routing_slug = candidate
      and (p_doctor_id is null or id <> p_doctor_id)
  ) loop
    candidate := base_slug || '-' || suffix::text;
    suffix := suffix + 1;
  end loop;

  return candidate;
end;
$function$;