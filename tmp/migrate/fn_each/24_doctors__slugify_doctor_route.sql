CREATE OR REPLACE FUNCTION doctors.slugify_doctor_route(input text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select trim(
    both '-' from regexp_replace(
      regexp_replace(lower(coalesce(input, 'doctor')), '[^a-z0-9]+', '-', 'g'),
      '-+',
      '-',
      'g'
    )
  );
$function$;