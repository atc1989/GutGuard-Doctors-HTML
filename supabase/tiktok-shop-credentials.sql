-- TikTok Shop rotating token storage
-- Run this in the Supabase SQL editor for the GutGuard Doctors project.

create table if not exists public.tiktok_credentials (
  id text primary key default 'default' check (id = 'default'),
  access_token text,
  refresh_token text not null,
  expires_at bigint not null default 0,
  refresh_token_expires_at bigint,
  updated_at timestamptz not null default now()
);

alter table public.tiktok_credentials enable row level security;

create or replace function public.touch_tiktok_credentials_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_tiktok_credentials_updated_at on public.tiktok_credentials;

create trigger touch_tiktok_credentials_updated_at
before update on public.tiktok_credentials
for each row
execute function public.touch_tiktok_credentials_updated_at();

-- After creating the table, seed it once with the latest refresh token from TikTok:
-- insert into public.tiktok_credentials (id, refresh_token, access_token, expires_at)
-- values ('default', 'PASTE_REFRESH_TOKEN_HERE', null, 0)
-- on conflict (id) do update
-- set refresh_token = excluded.refresh_token,
--     access_token = null,
--     expires_at = 0;
