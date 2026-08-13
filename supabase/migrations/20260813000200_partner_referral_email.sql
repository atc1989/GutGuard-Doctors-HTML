create table if not exists public.partner_referral_email_settings (
  id smallint primary key default 1 check (id = 1),
  enabled boolean not null default true,
  subject text not null default 'A new partner registered through your GutGuard link',
  reply_to text not null default '',
  body_text text not null default '',
  html_template text not null default '<div style="font-family:Arial,sans-serif;color:#0F0F18;line-height:1.6"><h1>A new GutGuard partner joined</h1><p>Hello {{partner_name}},</p><p>{{new_partner_name}} registered through your referral link.</p><p><strong>Specialty:</strong> {{new_partner_specialty}}<br><strong>Location:</strong> {{new_partner_location}}<br><strong>Registered:</strong> {{registered_at}}</p><p><a href="{{dashboard_url}}">Open your partner dashboard</a></p></div>',
  updated_at timestamptz not null default now()
);
insert into public.partner_referral_email_settings (id) values (1) on conflict (id) do nothing;
alter table public.partner_referral_email_settings enable row level security;

create table if not exists public.partner_referral_email_sends (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.doctor_registrations(id) on delete cascade,
  referrer_id uuid not null references public.doctor_registrations(id) on delete cascade,
  recipient_email text not null,
  subject text not null,
  status text not null check (status in ('sending', 'sent', 'failed', 'skipped')),
  resend_id text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists partner_referral_email_one_success_idx
  on public.partner_referral_email_sends (registration_id) where status = 'sent';
create unique index if not exists partner_referral_email_one_inflight_idx
  on public.partner_referral_email_sends (registration_id) where status = 'sending';
alter table public.partner_referral_email_sends enable row level security;
