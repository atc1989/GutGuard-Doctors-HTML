-- Immutable, one-level partner registration attribution.
alter table public.doctor_registrations
  add column if not exists referred_by_partner_id uuid
  references public.doctor_registrations(id) on delete restrict;

create index if not exists doctor_registrations_referred_by_partner_id_idx
  on public.doctor_registrations (referred_by_partner_id, created_at desc);

create or replace function public.prevent_partner_referrer_change()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.referred_by_partner_id is distinct from old.referred_by_partner_id then
    raise exception 'Partner referral attribution cannot be changed.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists doctor_registrations_referrer_immutable on public.doctor_registrations;
create trigger doctor_registrations_referrer_immutable
before update of referred_by_partner_id on public.doctor_registrations
for each row execute function public.prevent_partner_referrer_change();

-- Deliberately returns no email, phone, or other private partner fields.
create or replace function public.get_partner_invitation(p_slug text)
returns table (routing_slug text, full_name text)
language sql stable security definer set search_path = public as $$
  select d.routing_slug, d.full_name
  from public.doctor_registrations d
  where d.routing_slug = lower(trim(coalesce(p_slug, '')))
  limit 1;
$$;
revoke all on function public.get_partner_invitation(text) from public;
grant execute on function public.get_partner_invitation(text) to anon, authenticated;

drop function if exists public.register_doctor(text, text, text, text, text, text);
drop function if exists public.register_doctor(text, text, text, text, text, text, text);

create function public.register_doctor(
  p_full_name text, p_email text, p_mobile text, p_tiktok_username text,
  p_specialty text, p_practice_location text, p_referrer_slug text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_doctor_id uuid;
  v_referrer_id uuid;
  v_tiktok_username text;
begin
  v_tiktok_username := regexp_replace(lower(trim(coalesce(p_tiktok_username, ''))), '^@+', '');
  if nullif(lower(trim(coalesce(p_referrer_slug, ''))), '') is not null then
    select d.id into v_referrer_id from public.doctor_registrations d
    where d.routing_slug = lower(trim(p_referrer_slug)) limit 1;
  end if;

  insert into public.doctor_registrations (
    full_name, email, mobile, tiktok_username, specialty, practice_location,
    routing_slug, redirect_url, referred_by_partner_id
  ) values (
    trim(p_full_name), coalesce(nullif(lower(trim(coalesce(p_email, ''))), ''), ''),
    trim(p_mobile), v_tiktok_username, trim(p_specialty), trim(p_practice_location),
    public.make_unique_doctor_slug(p_full_name),
    case when v_tiktok_username = '' then null else 'https://www.tiktok.com/@' || v_tiktok_username end,
    v_referrer_id
  ) returning id into v_doctor_id;

  if v_referrer_id = v_doctor_id then
    raise exception 'A partner cannot refer themselves.' using errcode = '23514';
  end if;
  return v_doctor_id;
end;
$$;
revoke all on function public.register_doctor(text, text, text, text, text, text, text) from public;
grant execute on function public.register_doctor(text, text, text, text, text, text, text) to anon, authenticated;
