-- TikTok removal, step 2 of 2. DESTRUCTIVE: deletes every partner's TikTok username, TikTok
-- redirect link and TikTok/reel task flags, and the TikTok Shop token table. Not reversible.
--
-- Run only after ALL of these are live:
--   1. 20261029100000_stop_using_tiktok.sql
--   2. main released with the TikTok removal (production app no longer sends the TikTok params)
--   3. edge functions redeployed without tiktok_username / redirect_url
--      (send-proposal, send-sequence-step, send-sms-blast, send-newsletter,
--      registration-email-settings) and tiktok-shop-admin undeployed
-- Otherwise registrations, admin edits and registration emails fail until they are.

begin;

-- TikTok Shop order sync: token table and its trigger function. The baseline has it in
-- doctors; an older script created it in public. The trigger goes with the table.
drop table if exists doctors.tiktok_credentials;
drop table if exists public.tiktok_credentials;
drop function if exists doctors.touch_tiktok_credentials_updated_at();
drop function if exists public.touch_tiktok_credentials_updated_at();

-- Unused wrapper whose only job was passing p_tiktok_username through.
drop function if exists sandbox.register_doctor(text, text, text, text, text, text, text, text);

-- Same bodies as step 1, without the TikTok params.
drop function if exists doctors.register_doctor(text, text, text, text, text, text, text, text, text);

create function doctors.register_doctor(
  p_full_name text,
  p_email text,
  p_mobile text,
  p_specialty text,
  p_practice_location text,
  p_referrer_slug text default null,
  p_name_prefix text default '',
  p_where_did_you_find_us text default ''
)
returns uuid
language plpgsql
security definer
set search_path = doctors, public
as $$
declare
  v_doctor_id uuid;
  v_referrer doctors.doctor_registrations%rowtype;
  v_main_store_id uuid;
  v_mobile_key text := right(regexp_replace(coalesce(p_mobile, ''), '\D', '', 'g'), 10);
begin
  if nullif(lower(trim(coalesce(p_referrer_slug, ''))), '') is not null then
    select * into v_referrer from doctors.doctor_registrations d
    where d.routing_slug = lower(trim(p_referrer_slug)) limit 1;
  end if;

  if v_referrer.id is not null then
    -- A second account on the referrer's own mobile would earn both direct and pass-up points.
    if v_mobile_key <> ''
       and right(regexp_replace(coalesce(v_referrer.mobile, ''), '\D', '', 'g'), 10) = v_mobile_key then
      raise exception 'A partner cannot refer themselves.' using errcode = '23514';
    end if;
    v_main_store_id := case when v_referrer.store_type = 'main' then v_referrer.id else v_referrer.main_store_id end;
  end if;

  -- No referrer: the GutGuard root store, not whichever main store happens to be oldest.
  if v_main_store_id is null then
    select d.id into v_main_store_id from doctors.doctor_registrations d
    where d.store_type = 'main'
    order by (d.routing_slug = 'gutguard-main') desc, d.created_at
    limit 1;
  end if;

  -- Old link keys are id tails with unique indexes on them; keep both lengths free.
  loop
    v_doctor_id := gen_random_uuid();
    exit when not exists (
      select 1 from doctors.doctor_registrations d
      where right(d.id::text, 5) = right(v_doctor_id::text, 5)
         or right(d.id::text, 8) = right(v_doctor_id::text, 8)
    );
  end loop;

  insert into doctors.doctor_registrations (
    id, name_prefix, full_name, email, mobile, specialty, practice_location,
    where_did_you_find_us, routing_slug, referred_by_partner_id,
    store_type, referral_qr_enabled, main_store_id
  ) values (
    v_doctor_id,
    trim(coalesce(p_name_prefix, '')),
    trim(p_full_name),
    coalesce(nullif(lower(trim(coalesce(p_email, ''))), ''), ''),
    trim(p_mobile),
    trim(coalesce(p_specialty, '')),
    trim(coalesce(p_practice_location, '')),
    trim(coalesce(p_where_did_you_find_us, '')),
    doctors.make_unique_doctor_slug(p_full_name),
    v_referrer.id,
    'affiliate',
    false,
    v_main_store_id
  ) returning id into v_doctor_id;

  return v_doctor_id;
end;
$$;

revoke all on function doctors.register_doctor(text, text, text, text, text, text, text, text) from public;
grant execute on function doctors.register_doctor(text, text, text, text, text, text, text, text) to anon, authenticated, service_role;

drop function if exists doctors.admin_update_doctor_registration(text, uuid, text, text, text, text, text, text, text, text);

create function doctors.admin_update_doctor_registration(
  p_admin_password text, p_doctor_id uuid, p_full_name text, p_email text, p_mobile text,
  p_specialty text, p_practice_location text, p_name_prefix text default ''
)
returns table (
  id uuid, full_name text, name_prefix text, email text, mobile text,
  routing_slug text, specialty text, practice_location text,
  created_at timestamp with time zone, prize_label text, prize_claimed_at timestamp with time zone
)
language plpgsql
security definer
set search_path to 'doctors', 'public'
as $$
begin
  perform doctors.assert_wheel_admin(p_admin_password);

  update doctors.doctor_registrations
  set
    name_prefix = trim(coalesce(p_name_prefix, '')),
    full_name = trim(p_full_name),
    email = lower(trim(coalesce(p_email, ''))),
    mobile = trim(p_mobile),
    specialty = trim(coalesce(p_specialty, '')),
    practice_location = trim(coalesce(p_practice_location, ''))
  where doctor_registrations.id = p_doctor_id;

  return query
  select
    r.id, r.full_name, r.name_prefix, r.email, r.mobile,
    r.routing_slug, r.specialty, r.practice_location,
    r.created_at, r.prize_label, r.prize_claimed_at
  from doctors.admin_list_doctor_registrations(p_admin_password) r
  where r.id = p_doctor_id;
end;
$$;

revoke all on function doctors.admin_update_doctor_registration(text, uuid, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function doctors.admin_update_doctor_registration(text, uuid, text, text, text, text, text, text) to service_role;

-- Nothing may still reference the columns once they are gone; plpgsql would only fail at
-- run time. Checks doctors, sandbox and anything else that names the doctors schema (old
-- public.* copies use their own table) and rolls back, naming the functions, if any do.
do $$
declare
  v_left text;
begin
  select string_agg(n.nspname || '.' || p.proname, ', ') into v_left
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where (n.nspname in ('doctors', 'sandbox') or p.prosrc ~* '\mdoctors\.')
    and p.prosrc ~* '\m(tiktok_username|redirect_url|tiktok_credentials|task_tiktok_followed|task_reel_created)\M';
  if v_left is not null then
    raise exception 'Still referencing TikTok columns: %', v_left;
  end if;
end;
$$;

-- The unique index on lower(tiktok_username) goes with the column.
alter table doctors.doctor_registrations
  drop column if exists tiktok_username,
  drop column if exists redirect_url,
  drop column if exists task_tiktok_followed,
  drop column if exists task_reel_created;

commit;
