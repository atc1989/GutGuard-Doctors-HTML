-- Partner Codes gets two optional fields when staff generate a code:
--   code_note   - admin-only description ("Dr. Cruz, Makati clinic"), shown in the pending list.
--   code_source - where the QR will be used ("Manila Med Expo"). The join form reached through
--                 this partner's /j/<code> QR pre-fills "Where did you find us?" with it.
--
-- Partners live only in doctors.doctor_registrations, so this runs on `doctors` (no sandbox.*
-- copies to mirror). Functions are the repo copies from 20261024000000_partner_codes.sql and
-- 20261025000000_partner_invitation_can_refer.sql plus the new columns; diff them against the
-- deployed definitions before applying.

alter table doctors.doctor_registrations
  add column if not exists code_note text not null default '',
  add column if not exists code_source text not null default '';

-- New optional params. Dropping the one-arg version: keeping both would make a call with only
-- p_admin_password ambiguous.
drop function if exists doctors.admin_create_pending_partner(text);

create function doctors.admin_create_pending_partner(
  p_admin_password text, p_note text default '', p_source text default ''
)
returns table (id uuid, partner_code integer, routing_slug text)
language plpgsql
security definer
set search_path = doctors, public
as $$
#variable_conflict use_column
declare
  v_id uuid;
  v_code integer;
  v_main_store_id uuid;
begin
  perform doctors.assert_wheel_admin(p_admin_password);

  -- Same root store register_doctor falls back to when there is no referrer.
  select d.id into v_main_store_id from doctors.doctor_registrations d
  where d.store_type = 'main'
  order by (d.routing_slug = 'gutguard-main') desc, d.created_at
  limit 1;

  -- Old link keys are id tails with unique indexes on them; keep them free, as register_doctor does.
  loop
    v_id := gen_random_uuid();
    exit when not exists (
      select 1 from doctors.doctor_registrations d
      where right(d.id::text, 5) = right(v_id::text, 5) or right(d.id::text, 8) = right(v_id::text, 8)
    );
  end loop;

  v_code := nextval('doctors.partner_code_seq');

  insert into doctors.doctor_registrations (
    id, partner_code, full_name, email, mobile, specialty, practice_location,
    routing_slug, store_type, referral_qr_enabled, main_store_id, code_note, code_source
  ) values (
    v_id, v_code, '', '', '', '', '',
    'partner-' || v_code, 'affiliate', true, v_main_store_id,
    left(trim(coalesce(p_note, '')), 200), left(trim(coalesce(p_source, '')), 120)
  );

  return query select v_id, v_code, 'partner-' || v_code;
end;
$$;

revoke all on function doctors.admin_create_pending_partner(text, text, text) from public, anon, authenticated;
grant execute on function doctors.admin_create_pending_partner(text, text, text) to service_role;

-- + code_note, code_source. Return type changes need a drop.
drop function if exists doctors.admin_list_doctor_registrations(text);

create function doctors.admin_list_doctor_registrations(p_admin_password text)
returns table(
  id uuid, full_name text, name_prefix text, email text, mobile text, tiktok_username text,
  routing_slug text, redirect_url text, specialty text, practice_location text,
  where_did_you_find_us text, referred_by_partner_id uuid, referrer_name text, referrer_prefix text,
  referrer_slug text, store_type text, referral_qr_enabled boolean, main_store_id uuid,
  promoted_at timestamp with time zone, promoted_by text, created_at timestamp with time zone,
  prize_label text, prize_claimed_at timestamp with time zone, shop_show_protocol boolean,
  partner_code integer, code_note text, code_source text
)
language plpgsql
security definer
set search_path to 'doctors', 'public'
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
    d.shop_show_protocol,
    d.partner_code,
    d.code_note,
    d.code_source
  from doctors.doctor_registrations d
  left join doctors.doctor_registrations ref on ref.id = d.referred_by_partner_id
  order by d.created_at desc;
end;
$$;

revoke all on function doctors.admin_list_doctor_registrations(text) from public, anon, authenticated;
grant execute on function doctors.admin_list_doctor_registrations(text) to service_role;

-- + code_source, for the join form's "Where did you find us?". Return type changes need a drop.
drop function if exists doctors.get_partner_invitation(text);

create function doctors.get_partner_invitation(p_slug text)
returns table (
  routing_slug text, full_name text, link_key text, partner_code integer, can_refer boolean, code_source text
)
language sql
stable
security definer
set search_path = doctors, public
as $$
  select d.routing_slug, d.full_name, right(d.id::text, 5), d.partner_code,
    d.store_type <> 'affiliate' or d.referral_qr_enabled, d.code_source
  from doctors.partner_by_key(p_slug) d;
$$;

grant execute on function doctors.get_partner_invitation(text) to anon, authenticated;
