-- Per-partner switch: does the partner's shared shop link show the Full Protocol packages?
-- Off by default - shared links sell Try First only unless an admin turns this on.
alter table doctors.doctor_registrations
  add column if not exists shop_show_protocol boolean not null default false;

-- Public lookup for /r/<key>. Unknown keys return false, so a bad link never widens the shop.
create or replace function doctors.shop_link_shows_protocol(p_key text)
returns boolean
language sql
stable
security definer
set search_path = doctors, public
as $$
  select coalesce((select d.shop_show_protocol from doctors.partner_by_key(p_key) d), false);
$$;

revoke all on function doctors.shop_link_shows_protocol(text) from public;
grant execute on function doctors.shop_link_shows_protocol(text) to anon, authenticated;

create or replace function doctors.admin_set_doctor_shop_protocol(
  p_admin_password text,
  p_doctor_id uuid,
  p_show boolean
)
returns boolean
language plpgsql
security definer
set search_path = doctors, public
as $$
declare
  v_show boolean;
begin
  perform doctors.assert_wheel_admin(p_admin_password);

  update doctors.doctor_registrations
  set shop_show_protocol = coalesce(p_show, false)
  where id = p_doctor_id
  returning shop_show_protocol into v_show;

  if v_show is null then
    raise exception 'Doctor not found.' using errcode = 'P0002';
  end if;

  return v_show;
end;
$$;

-- Admin RPCs are service_role only (see 20260930000000_revoke_admin_rpcs_from_anon).
revoke all on function doctors.admin_set_doctor_shop_protocol(text, uuid, boolean) from public, anon, authenticated;
grant execute on function doctors.admin_set_doctor_shop_protocol(text, uuid, boolean) to service_role;

-- Copied from the DEPLOYED definition (2026-10-10), which has drifted from the repo
-- (store_type, referral_qr_enabled, main_store_id, promoted_*), plus shop_show_protocol.
-- Return type changes need a drop.
drop function if exists doctors.admin_list_doctor_registrations(text);

create function doctors.admin_list_doctor_registrations(p_admin_password text)
returns table(
  id uuid, full_name text, name_prefix text, email text, mobile text, tiktok_username text,
  routing_slug text, redirect_url text, specialty text, practice_location text,
  where_did_you_find_us text, referred_by_partner_id uuid, referrer_name text,
  referrer_prefix text, referrer_slug text, store_type text, referral_qr_enabled boolean,
  main_store_id uuid, promoted_at timestamptz, promoted_by text, created_at timestamptz,
  prize_label text, prize_claimed_at timestamptz, shop_show_protocol boolean
)
language plpgsql
security definer
set search_path = doctors, public
as $$
begin
  perform doctors.assert_wheel_admin(p_admin_password);

  return query
  select
    d.id,
    d.full_name::text,
    d.name_prefix::text,
    d.email::text,
    d.mobile::text,
    d.tiktok_username::text,
    d.routing_slug::text,
    coalesce(d.redirect_url, '')::text,
    d.specialty::text,
    d.practice_location::text,
    coalesce(d.where_did_you_find_us, '')::text,
    d.referred_by_partner_id,
    ref.full_name::text as referrer_name,
    ref.name_prefix::text as referrer_prefix,
    ref.routing_slug::text as referrer_slug,
    d.store_type::text,
    d.referral_qr_enabled,
    d.main_store_id,
    d.promoted_at,
    d.promoted_by::text,
    d.created_at,
    null::text as prize_label,
    null::timestamptz as prize_claimed_at,
    d.shop_show_protocol
  from doctors.doctor_registrations d
  left join doctors.doctor_registrations ref on ref.id = d.referred_by_partner_id
  order by d.created_at desc;
end;
$$;

revoke all on function doctors.admin_list_doctor_registrations(text) from public, anon, authenticated;
grant execute on function doctors.admin_list_doctor_registrations(text) to service_role;
