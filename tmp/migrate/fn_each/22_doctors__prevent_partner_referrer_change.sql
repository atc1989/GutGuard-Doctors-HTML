CREATE OR REPLACE FUNCTION doctors.prevent_partner_referrer_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'doctors', 'public'
AS $function$
begin
  if new.referred_by_partner_id is distinct from old.referred_by_partner_id then
    raise exception 'Partner referral attribution cannot be changed.' using errcode = '23514';
  end if;
  return new;
end;
$function$;