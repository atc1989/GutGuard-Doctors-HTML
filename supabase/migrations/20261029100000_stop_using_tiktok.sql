-- TikTok removal, step 1 of 2: nothing reads or writes TikTok data any more, but the columns
-- stay. Production (main) still sends p_tiktok_username / p_redirect_url until it is released,
-- so those params are kept, defaulted and ignored. Step 2
-- (20261029200000_drop_tiktok_columns.sql) drops the columns, the TikTok Shop table and these
-- params once main and the edge functions no longer use them.
--
-- Sandbox and production share these doctors.* functions, so this changes both at once.
--
-- register_doctor: deployed copies differ (the 2026-10-08 baseline has 8 params, migration
-- 20261007000000 has 9). This drops both and recreates the 9-param one from 20261007000000,
-- plus the 8-char link-key check admin_create_pending_partner says register_doctor does.
-- Before applying, compare with: select pg_get_functiondef('doctors.register_doctor'::regproc);

begin;

-- /dr/<slug> (Profile QR -> TikTok) is gone from the app; old builds fall back to the home page.
drop function if exists doctors.get_doctor_redirect(text);

-- Old booth task list (email / facebook / tiktok / reel). Nothing calls it, and anon could
-- flip any doctor's tasks with it.
drop function if exists doctors.update_doctor_task(uuid, text, boolean);

drop function if exists doctors.register_doctor(text, text, text, text, text, text, text, text);
drop function if exists doctors.register_doctor(text, text, text, text, text, text, text, text, text);

-- p_specialty and p_practice_location get defaults only because they follow the defaulted
-- p_tiktok_username; every caller sends them by name.
create function doctors.register_doctor(
  p_full_name text,
  p_email text,
  p_mobile text,
  p_tiktok_username text default null,
  p_specialty text default '',
  p_practice_location text default '',
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

revoke all on function doctors.register_doctor(text, text, text, text, text, text, text, text, text) from public;
grant execute on function doctors.register_doctor(text, text, text, text, text, text, text, text, text) to anon, authenticated, service_role;

-- 20261028000000 copy minus tiktok_username and redirect_url. Return type changes need a drop;
-- admin_update_doctor_registration below reads it, so it is dropped first.
drop function if exists doctors.admin_update_doctor_registration(text, uuid, text, text, text, text, text, text, text, text);
drop function if exists doctors.admin_list_doctor_registrations(text);

create function doctors.admin_list_doctor_registrations(p_admin_password text)
returns table(
  id uuid, full_name text, name_prefix text, email text, mobile text,
  routing_slug text, specialty text, practice_location text,
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
    d.routing_slug::text,
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

-- 20261024000000 copy: no longer writes tiktok_username / redirect_url. Both params kept
-- (defaulted, ignored) for production's admin until step 2.
create function doctors.admin_update_doctor_registration(
  p_admin_password text, p_doctor_id uuid, p_full_name text, p_email text, p_mobile text,
  p_tiktok_username text default null, p_specialty text default '', p_practice_location text default '',
  p_redirect_url text default null, p_name_prefix text default ''
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

revoke all on function doctors.admin_update_doctor_registration(text, uuid, text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function doctors.admin_update_doctor_registration(text, uuid, text, text, text, text, text, text, text, text) to service_role;

-- Stop here if any doctors/sandbox function still touches TikTok data (e.g. one edited straight
-- on production). Rolls the whole step back and names the functions.
do $$
declare
  v_left text;
begin
  select string_agg(n.nspname || '.' || p.proname, ', ') into v_left
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('doctors', 'sandbox')
    and p.proname <> 'touch_tiktok_credentials_updated_at'
    and p.prosrc ~* '\m(tiktok_username|redirect_url|tiktok_credentials|task_tiktok_followed|task_reel_created)\M';
  if v_left is not null then
    raise exception 'Still using TikTok data: %', v_left;
  end if;
end;
$$;

commit;
