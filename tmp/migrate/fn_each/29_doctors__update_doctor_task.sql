CREATE OR REPLACE FUNCTION doctors.update_doctor_task(p_doctor_id uuid, p_task text, p_value boolean DEFAULT true)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
begin
  if p_task not in ('email', 'facebook', 'tiktok', 'reel') then
    raise exception 'Invalid task: %', p_task;
  end if;

  update doctors.doctor_registrations
  set
    task_email_received = case when p_task = 'email' then p_value else task_email_received end,
    task_facebook_followed = case when p_task = 'facebook' then p_value else task_facebook_followed end,
    task_tiktok_followed = case when p_task = 'tiktok' then p_value else task_tiktok_followed end,
    task_reel_created = case when p_task = 'reel' then p_value else task_reel_created end
  where id = p_doctor_id;

  if not found then
    raise exception 'Doctor registration not found';
  end if;
end;
$function$;