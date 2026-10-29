-- Admin staff accounts on doctors (production). Additive and re-runnable.
-- Production: atc1989 only, after the sandbox file has been tested.
--
-- The super admin (username "admin" + ADMIN_PASSWORD) creates these in Admin -> Staff: a username,
-- a password (scrypt hash, written by the app) and the admin sections the account may open.
-- Only the server's service-role key reads it; RLS is on with no policies and anon/authenticated
-- have no grants. password_changed_at signs out sessions started before a password reset.

create table if not exists doctors.admin_staff (
  id uuid primary key default gen_random_uuid(),
  username text not null unique check (username ~ '^[a-z0-9_-]{3,32}$' and username <> 'admin'),
  password_hash text not null,
  modules text[] not null default '{}',
  active boolean not null default true,
  password_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table doctors.admin_staff enable row level security;
revoke all on table doctors.admin_staff from public, anon, authenticated;
grant select, insert, update, delete on table doctors.admin_staff to service_role;
