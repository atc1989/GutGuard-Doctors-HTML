CREATE OR REPLACE FUNCTION doctors.touch_tiktok_credentials_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;