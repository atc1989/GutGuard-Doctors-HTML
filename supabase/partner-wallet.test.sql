-- Checks for 20261030000000_partner_wallet.sql. Run with: bash supabase/partner-wallet.test.sh
-- Do NOT run against Supabase: it creates stand-ins for doctor_registrations, auth.jwt() and
-- assert_wheel_admin.

-- ─── Stand-ins ────────────────────────────────────────────────────────────────
create role anon;
create role authenticated;
create role service_role;
create schema auth;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
$$;
create schema doctors;
create schema sandbox;
create table doctors.doctor_registrations (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null default '',
  mobile text
);
create function doctors.assert_wheel_admin(p text) returns void language plpgsql as $$
begin
  if p is distinct from 'admin' then raise exception 'bad password' using errcode = '42501'; end if;
end $$;
create table doctors.milestone_unlocks (partner_id uuid, cycle_number int, milestone_pts int, rebate_amount numeric, status varchar(50) default 'unlocked', created_at timestamptz default now());
create table sandbox.milestone_unlocks (like doctors.milestone_unlocks including defaults);

insert into doctors.doctor_registrations (id, full_name, email) values
  ('00000000-0000-0000-0000-00000000000a', 'Dr A', 'a@x.ph'),
  ('00000000-0000-0000-0000-00000000000b', 'Dr B', 'b@x.ph');
insert into doctors.milestone_unlocks (partner_id, cycle_number, milestone_pts, rebate_amount, status) values
  ('00000000-0000-0000-0000-00000000000a', 1, 300, 18000, 'unlocked'),
  ('00000000-0000-0000-0000-00000000000a', 0, 0, 99999, 'paid');  -- settled outside the wallet

-- ─── CHECKS ───────────────────────────────────────────────────────────────────
do $$
declare
  w jsonb;
  r jsonb;
  failed boolean;
begin
  perform set_config('request.jwt.claims', '{"email":"A@x.ph"}', false);

  w := doctors.partner_wallet();
  assert (w->>'available')::numeric = 18000, 'paid rebates are not withdrawable: ' || w;

  failed := false;
  begin perform doctors.request_partner_withdrawal(499.99, 'gcash', 'Dr A', '0917'); exception when others then failed := true; end;
  assert failed, 'below PHP 500 is refused';

  failed := false;
  begin perform doctors.request_partner_withdrawal(18000.01, 'gcash', 'Dr A', '0917'); exception when others then failed := true; end;
  assert failed, 'more than the balance is refused';

  failed := false;
  begin perform doctors.request_partner_withdrawal(1000, 'bank', 'Dr A', '0012'); exception when others then failed := true; end;
  assert failed, 'bank needs a bank name';

  r := doctors.request_partner_withdrawal(10000, 'bank', 'Dr A', '0012', 'BDO');
  assert (r->>'fee')::numeric = 60 and r->>'status' = 'pending' and r->>'bank_name' = 'BDO', 'request row: ' || r;
  assert (doctors.partner_wallet()->>'available')::numeric = 8000, 'pending holds the money';

  failed := false;
  begin perform doctors.request_partner_withdrawal(8000.01, 'maya', 'Dr A', '0917'); exception when others then failed := true; end;
  assert failed, 'pending counts against the balance';

  failed := false;
  begin perform doctors.admin_process_partner_withdrawal('admin', (r->>'id')::uuid, 'approved', ''); exception when others then failed := true; end;
  assert failed, 'approve needs a reference';

  perform doctors.admin_process_partner_withdrawal('admin', (r->>'id')::uuid, 'rejected', '', 'wrong account');
  assert (doctors.partner_wallet()->>'available')::numeric = 18000, 'reject gives the money back';

  failed := false;
  begin perform doctors.admin_process_partner_withdrawal('admin', (r->>'id')::uuid, 'approved', 'REF1'); exception when others then failed := true; end;
  assert failed, 'a processed request cannot be processed again';

  r := doctors.request_partner_withdrawal(500, 'gcash', 'Dr A', '0917', 'ignored');
  assert r->>'bank_name' = '', 'bank name is dropped for e-wallets';
  perform doctors.admin_process_partner_withdrawal('admin', (r->>'id')::uuid, 'approved', 'REF2');
  w := doctors.partner_wallet();
  assert (w->>'withdrawn')::numeric = 500 and (w->>'available')::numeric = 17500, 'approved: ' || w;

  failed := false;
  begin perform doctors.admin_list_partner_withdrawals('nope'); exception when others then failed := true; end;
  assert failed, 'admin list needs the password';
  assert jsonb_array_length(doctors.admin_list_partner_withdrawals('admin')) = 2, 'admin sees both requests';

  perform set_config('request.jwt.claims', '{"email":"b@x.ph"}', false);
  w := doctors.partner_wallet();
  assert (w->>'available')::numeric = 0 and jsonb_array_length(w->'withdrawals') = 0, 'B sees none of A''s: ' || w;

  assert not has_table_privilege('authenticated', 'doctors.partner_withdrawals', 'select'), 'table is RPC-only';
  assert not has_function_privilege('anon', 'doctors.request_partner_withdrawal(numeric,text,text,text,text)', 'execute'), 'anon cannot request';

  perform set_config('request.jwt.claims', '{"email":"a@x.ph"}', false);
  assert (sandbox.partner_wallet()->>'available')::numeric = 0, 'sandbox has its own rebates';

  raise notice 'partner wallet checks passed';
end $$;
