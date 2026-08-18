CREATE OR REPLACE FUNCTION doctors.admin_list_newsletter_sends(p_admin_password text)
 RETURNS TABLE(id uuid, doctor_id uuid, newsletter_id uuid, newsletter_title text, email text, subject text, status text, resend_id text, error_message text, sent_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
begin
  perform doctors.assert_wheel_admin(p_admin_password);

  return query
  select
    ns.id,
    ns.doctor_id,
    ns.newsletter_id,
    nc.title as newsletter_title,
    ns.email,
    ns.subject,
    ns.status,
    ns.resend_id,
    ns.error_message,
    ns.sent_at
  from doctors.newsletter_sends ns
  left join doctors.newsletter_campaigns nc on nc.id = ns.newsletter_id
  order by ns.sent_at desc;
end;
$function$;