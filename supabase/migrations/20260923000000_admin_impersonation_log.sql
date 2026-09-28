-- Audit trail for "log in as this doctor" in the admin doctors list.
--
-- The admin area authenticates with one shared password (assert_wheel_admin), so there
-- is no admin identity to record - every row here means "an admin", not a person. That
-- is the known ceiling of this log; it gives you a timeline and a target, not attribution.
-- Attribution needs per-admin credentials, which is a different change.
--
-- Written only by the admin-impersonate Edge Function using the service role, which
-- bypasses RLS. No policy is added on purpose: RLS is on with zero policies, so anon and
-- authenticated can neither read nor write this table.
create table if not exists doctors.admin_impersonation_log (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid references doctors.doctor_registrations (id) on delete set null,
  doctor_email text not null,
  -- Best-effort: whatever the edge runtime saw, for spotting a leaked admin password.
  source_ip text not null default '',
  user_agent text not null default '',
  created_at timestamptz not null default now()
);

alter table doctors.admin_impersonation_log enable row level security;

create index if not exists admin_impersonation_log_recent_idx
  on doctors.admin_impersonation_log (created_at desc);

create index if not exists admin_impersonation_log_doctor_idx
  on doctors.admin_impersonation_log (doctor_id, created_at desc);
