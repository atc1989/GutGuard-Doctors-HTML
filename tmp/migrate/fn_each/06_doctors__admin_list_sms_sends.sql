CREATE OR REPLACE FUNCTION doctors.admin_list_sms_sends(p_admin_password text)
 RETURNS TABLE(id uuid, doctor_id uuid, sms_campaign_id uuid, sms_campaign_title text, mobile text, message text, status text, provider_message_id text, error_message text, sent_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
begin
  perform doctors.assert_wheel_admin(p_admin_password);

  return query
  select
    sms_sends.id,
    sms_sends.doctor_id,
    sms_sends.sms_campaign_id,
    sms_campaigns.title,
    sms_sends.mobile,
    sms_sends.message,
    sms_sends.status,
    sms_sends.provider_message_id,
    sms_sends.error_message,
    sms_sends.sent_at
  from doctors.sms_sends
  left join doctors.sms_campaigns on sms_campaigns.id = sms_sends.sms_campaign_id
  order by sms_sends.sent_at desc;
end;
$function$;