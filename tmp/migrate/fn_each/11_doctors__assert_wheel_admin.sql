CREATE OR REPLACE FUNCTION doctors.assert_wheel_admin(p_admin_password text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
begin
  if not exists (
    select 1
    from doctors.wheel_admin_settings
    where id = true
      and admin_password = p_admin_password
  ) then
    raise exception 'Invalid admin password' using errcode = '28000';
  end if;
end;
$function$;