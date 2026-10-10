-- admin_update_doctor_registration declares 13 output columns but returned
-- `select * from admin_list_doctor_registrations(...)`, which has drifted to 24 columns in
-- production. plpgsql rejects that at runtime ("structure of query does not match function
-- result type"), so every admin doctor edit failed. Select the declared columns explicitly
-- so the list function can keep growing without breaking this one. Body otherwise copied
-- from the deployed definition (2026-10-10). Same signature, so no drop and no grant changes.
create or replace function doctors.admin_update_doctor_registration(
  p_admin_password text,
  p_doctor_id uuid,
  p_full_name text,
  p_email text,
  p_mobile text,
  p_tiktok_username text,
  p_specialty text,
  p_practice_location text,
  p_redirect_url text default null::text,
  p_name_prefix text default ''::text
)
returns table(
  id uuid, full_name text, name_prefix text, email text, mobile text, tiktok_username text,
  routing_slug text, redirect_url text, specialty text, practice_location text,
  created_at timestamptz, prize_label text, prize_claimed_at timestamptz
)
language plpgsql
security definer
set search_path = doctors, public
as $$
begin
  perform doctors.assert_wheel_admin(p_admin_password);

  update doctors.doctor_registrations
  set
    name_prefix = trim(coalesce(p_name_prefix, '')),
    full_name = trim(p_full_name),
    email = nullif(lower(trim(coalesce(p_email, ''))), ''),
    mobile = trim(p_mobile),
    tiktok_username = regexp_replace(lower(trim(coalesce(p_tiktok_username, ''))), '^@+', ''),
    redirect_url = nullif(trim(coalesce(p_redirect_url, '')), ''),
    specialty = trim(p_specialty),
    practice_location = trim(p_practice_location)
  where doctor_registrations.id = p_doctor_id;

  return query
  select
    r.id, r.full_name, r.name_prefix, r.email, r.mobile, r.tiktok_username,
    r.routing_slug, r.redirect_url, r.specialty, r.practice_location,
    r.created_at, r.prize_label, r.prize_claimed_at
  from doctors.admin_list_doctor_registrations(p_admin_password) r
  where r.id = p_doctor_id;
end;
$$;
