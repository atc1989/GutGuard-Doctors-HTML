CREATE OR REPLACE FUNCTION doctors.track_referral_click(p_slug text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
declare
  v_slug text;
  v_doctor_id uuid;
begin
  select d.routing_slug, d.id into v_slug, v_doctor_id
  from doctors.doctor_registrations d
  where d.routing_slug = lower(trim(coalesce(p_slug, '')))
  limit 1;

  -- Unknown slug: no row, no click. Counting misses would let anyone inflate a partner's
  -- numbers by hitting /r/<anything>.
  if v_slug is null then
    return null;
  end if;

  insert into doctors.referral_clicks (routing_slug, doctor_id) values (v_slug, v_doctor_id);

  return v_slug;
end;
$function$;