-- SMS Blast support
-- Run this in the Supabase SQL editor for the GutGuard Doctors project.

create table if not exists public.sms_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message_template text not null,
  recipient_count integer not null default 0,
  provider text,
  created_at timestamptz not null default now()
);

create table if not exists public.sms_sends (
  id uuid primary key default gen_random_uuid(),
  sms_campaign_id uuid references public.sms_campaigns(id) on delete set null,
  doctor_id uuid references public.doctor_registrations(id) on delete cascade,
  mobile text not null default '',
  message text not null,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  provider_message_id text,
  error_message text,
  sent_at timestamptz not null default now()
);

create index if not exists sms_sends_doctor_id_sent_at_idx
  on public.sms_sends (doctor_id, sent_at desc);

create index if not exists sms_sends_sms_campaign_id_idx
  on public.sms_sends (sms_campaign_id);

alter table public.sms_campaigns enable row level security;
alter table public.sms_sends enable row level security;

create or replace function public.admin_list_sms_sends(p_admin_password text)
returns table (
  id uuid,
  doctor_id uuid,
  sms_campaign_id uuid,
  sms_campaign_title text,
  mobile text,
  message text,
  status text,
  provider_message_id text,
  error_message text,
  sent_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_wheel_admin(p_admin_password);

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
  from public.sms_sends
  left join public.sms_campaigns on sms_campaigns.id = sms_sends.sms_campaign_id
  order by sms_sends.sent_at desc;
end;
$$;
