-- Partner Codes gets a third optional field when staff generate a code:
--   code_label - a short PUBLIC label ("GSC", "BRMC"). The join form reached through this
--                partner's /j/<code> QR shows it beside the ref number: "Ref number #10341 · GSC".
-- code_note stays admin-only; get_partner_invitation is callable by anon and slugs are
-- partner-<code>, so anything it returns can be read for every code.
--
-- Partners live only in doctors.doctor_registrations, so this runs on `doctors` (no sandbox.*
-- copies to mirror). Functions are the repo copies from 20261028000000_partner_code_note_source.sql
-- plus the new column; diff them against the deployed definitions before applying.
-- admin_list_doctor_registrations is left alone: 20261029100000_stop_using_tiktok.sql (not yet
-- applied) recreates it, and changing it here would conflict with that file.

alter table doctors.doctor_registrations
  add column if not exists code_label text not null default '';

-- New optional param. Dropping the three-arg version: keeping both would make a call without
-- p_label ambiguous. Existing callers (password, note, source) still match through the default.
drop function if exists doctors.admin_create_pending_partner(text, text, text);

create function doctors.admin_create_pending_partner(
  p_admin_password text, p_note text default '', p_source text default '', p_label text default ''
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
    routing_slug, store_type, referral_qr_enabled, main_store_id, code_note, code_source, code_label
  ) values (
    v_id, v_code, '', '', '', '', '',
    'partner-' || v_code, 'affiliate', true, v_main_store_id,
    left(trim(coalesce(p_note, '')), 200), left(trim(coalesce(p_source, '')), 120),
    left(trim(coalesce(p_label, '')), 40)
  );

  return query select v_id, v_code, 'partner-' || v_code;
end;
$$;

revoke all on function doctors.admin_create_pending_partner(text, text, text, text) from public, anon, authenticated;
grant execute on function doctors.admin_create_pending_partner(text, text, text, text) to service_role;

-- + code_label, for the join form's ref number. Return type changes need a drop.
drop function if exists doctors.get_partner_invitation(text);

create function doctors.get_partner_invitation(p_slug text)
returns table (
  routing_slug text, full_name text, link_key text, partner_code integer, can_refer boolean, code_source text,
  code_label text
)
language sql
stable
security definer
set search_path = doctors, public
as $$
  select d.routing_slug, d.full_name, right(d.id::text, 5), d.partner_code,
    d.store_type <> 'affiliate' or d.referral_qr_enabled, d.code_source, d.code_label
  from doctors.partner_by_key(p_slug) d;
$$;

grant execute on function doctors.get_partner_invitation(text) to anon, authenticated;
