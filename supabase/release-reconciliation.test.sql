-- Checks for 20261007000000 + 20261008000000 against the production schema snapshot.
--
--   bash supabase/release-reconciliation.test.sh
--
-- Do NOT run this against a Supabase project: it inserts fixture partners and orders. The
-- script loads supabase/baseline/ (the live `doctors` / `sandbox` structure, no data) into a
-- throwaway Postgres, applies the two migrations, then runs this file.

\set ON_ERROR_STOP 1
set client_min_messages = warning;

insert into doctors.wheel_admin_settings (id, admin_password) values (true, 'test-admin-pw');

-- Two main stores: an "older" stray one and the GutGuard root. Unreferred sign-ups must land
-- under the root, not under whichever main store is oldest.
insert into doctors.doctor_registrations (id, full_name, email, mobile, specialty, practice_location, routing_slug, store_type, referral_qr_enabled, created_at)
values
  ('00000000-0000-0000-0000-0000000000a1', 'Stray Main', 'stray@test.invalid', '+639170000001', 'x', 'x', 'stray-main', 'main', true, now() - interval '2 days'),
  ('00000000-0000-0000-0000-0000000000a2', 'GutGuard Main Store', 'main@test.invalid', '+639170000002', 'x', 'x', 'gutguard-main', 'main', true, now() - interval '1 day');

-- B: lifestyle under the root. Registrations below go through register_doctor.
insert into doctors.doctor_registrations (id, full_name, email, mobile, specialty, practice_location, routing_slug, store_type, referral_qr_enabled, main_store_id)
values ('00000000-0000-0000-0000-0000000000b1', 'Dr Upline', 'upline@test.invalid', '0917 111 2222', 'x', 'x', 'dr-upline', 'lifestyle', true, '00000000-0000-0000-0000-0000000000a2');

do $$
declare
  v_direct uuid;
  v_child uuid;
  v_row doctors.doctor_registrations;
begin
  -- 9-arg call (current app), no referrer -> root main store, where-found kept.
  v_direct := doctors.register_doctor('Dr Direct', 'direct@test.invalid', '09181234567', '', 'GP', 'Manila', null, 'Dr.', 'Facebook');
  select * into v_row from doctors.doctor_registrations where id = v_direct;
  assert v_row.main_store_id = '00000000-0000-0000-0000-0000000000a2', 'unreferred sign-up must go under gutguard-main';
  assert v_row.store_type = 'affiliate' and not v_row.referral_qr_enabled, 'new sign-ups start as affiliate, QR off';
  assert v_row.where_did_you_find_us = 'Facebook', 'where_did_you_find_us must be stored';
  assert v_row.referred_by_partner_id is null;

  -- 8-arg named call (old frontend fallback) via the sandbox wrapper, referred by B.
  v_child := sandbox.register_doctor('Dr Child', 'child@test.invalid', '09191234567', '', 'GP', 'Cebu', 'dr-upline', '');
  select * into v_row from doctors.doctor_registrations where id = v_child;
  assert v_row.referred_by_partner_id = '00000000-0000-0000-0000-0000000000b1', 'referrer must be recorded';
  assert v_row.main_store_id = '00000000-0000-0000-0000-0000000000a2', 'inherits the referrer''s main store';

  -- Referred directly by a main store -> that main store.
  v_direct := doctors.register_doctor('Dr Stray Child', '', '09201234567', '', 'GP', 'Davao', 'stray-main', '', '');
  select * into v_row from doctors.doctor_registrations where id = v_direct;
  assert v_row.main_store_id = '00000000-0000-0000-0000-0000000000a1', 'referred by a main store -> that main store';

  -- Same mobile as the referrer (different formatting) is a self-referral.
  begin
    perform doctors.register_doctor('Dr Upline Alt', 'alt@test.invalid', '+63 917-111-2222', '', 'GP', 'Manila', 'dr-upline', '', '');
    raise exception 'self-referral by mobile was accepted';
  exception when check_violation then
    null;
  end;

  assert (select count(*) from pg_proc where proname = 'register_doctor' and pronamespace = 'doctors'::regnamespace) = 1,
    'exactly one doctors.register_doctor overload';
end $$;
select 'ok: register_doctor';

-- ─── Points ────────────────────────────────────────────────────────────────────
-- Order through Dr Child (affiliate, upline = Dr Upline).
insert into doctors.shop_orders (id, order_code, customer_name, email, mobile, address, city, province, zip, total_amount, referral_doctor_id)
select '00000000-0000-0000-0000-00000000c001', 'GG-TEST-1', 'Buyer', 'buyer@test.invalid', '0900', 'a', 'c', 'p', '1000', 13999, id
from doctors.doctor_registrations where email = 'child@test.invalid';

do $$
declare
  v_child uuid := (select id from doctors.doctor_registrations where email = 'child@test.invalid');
begin
  update doctors.shop_orders set payment_status = 'paid', status = 'paid' where order_code = 'GG-TEST-1';
  assert (select points from doctors.partner_points where partner_id = v_child and depth = 0) = 13, 'direct points = floor(13999/1000)';
  assert (select points from doctors.partner_points where partner_id = '00000000-0000-0000-0000-0000000000b1' and depth = 1) = 13, 'upline pass-up points';
  assert (select store_type from doctors.doctor_registrations where id = v_child) = 'lifestyle', 'first paid sale promotes affiliate';
  assert (select count(*) from doctors.store_promotions where partner_id = v_child) = 1;

  -- Webhook retry / reconcile: no double award.
  update doctors.shop_orders set payment_status = 'paid' where order_code = 'GG-TEST-1';
  assert (select count(*) from doctors.partner_points where order_id = '00000000-0000-0000-0000-00000000c001') = 2;

  -- Refund takes the points back from both.
  update doctors.shop_orders set payment_status = 'refunded' where order_code = 'GG-TEST-1';
  assert (select count(*) from doctors.partner_points where order_id = '00000000-0000-0000-0000-00000000c001') = 0, 'refund must revoke points';

  -- Paid again: re-awarded, promotion not duplicated.
  update doctors.shop_orders set payment_status = 'paid' where order_code = 'GG-TEST-1';
  assert (select count(*) from doctors.partner_points where order_id = '00000000-0000-0000-0000-00000000c001') = 2, 're-paid order re-awards';
  assert (select count(*) from doctors.store_promotions where partner_id = v_child) = 1, 'no second promotion';
end $$;
select 'ok: doctors points award / refund / re-award';

-- A points failure must not roll back the payment.
alter table doctors.partner_points add constraint test_block_points check (points < 0) not valid;
insert into doctors.shop_orders (order_code, customer_name, email, mobile, address, city, province, zip, total_amount, referral_doctor_id)
values ('GG-TEST-2', 'Buyer', 'buyer@test.invalid', '0900', 'a', 'c', 'p', '1000', 1299, '00000000-0000-0000-0000-0000000000b1');
update doctors.shop_orders set payment_status = 'paid' where order_code = 'GG-TEST-2';
do $$ begin
  assert (select payment_status from doctors.shop_orders where order_code = 'GG-TEST-2') = 'paid', 'payment must survive a points failure';
  assert not exists (select 1 from doctors.partner_points p join doctors.shop_orders o on o.id = p.order_id where o.order_code = 'GG-TEST-2');
end $$;
alter table doctors.partner_points drop constraint test_block_points;
select 'ok: points failure does not block payment';

-- Sandbox QA payment: sandbox points, but the shared (production) partner is not promoted.
insert into sandbox.shop_orders (order_code, customer_name, email, mobile, address, city, province, zip, total_amount, referral_doctor_id)
select 'SBX-TEST-1', 'QA', 'qa@test.invalid', '0900', 'a', 'c', 'p', '1000', 4999, id
from doctors.doctor_registrations where email = 'direct@test.invalid';
update sandbox.shop_orders set payment_status = 'paid' where order_code = 'SBX-TEST-1';
do $$ begin
  assert (select store_type from doctors.doctor_registrations where email = 'direct@test.invalid') = 'affiliate', 'sandbox order must not promote a prod partner';
  assert (select points from sandbox.partner_points p join sandbox.shop_orders o on o.id = p.order_id where o.order_code = 'SBX-TEST-1') = 4;
  assert not exists (select 1 from sandbox.store_promotions);
end $$;
update sandbox.shop_orders set payment_status = 'failed' where order_code = 'SBX-TEST-1';
do $$ begin
  assert not exists (select 1 from sandbox.partner_points), 'sandbox refund/fail revokes points';
end $$;
select 'ok: sandbox points isolated';

-- ─── Dashboards ────────────────────────────────────────────────────────────────
do $$
declare
  v jsonb;
begin
  perform set_config('request.jwt.claims', '{"email":"upline@test.invalid"}', true);
  v := doctors.partner_dashboard();
  assert v->'partner'->>'store_type' = 'lifestyle', 'partner_dashboard returns store_type';
  assert (v->'points'->>'passup_points')::int = 13, 'passup points from doctors.partner_points';
  assert jsonb_array_length(v->'point_sources') = 1, 'point_sources present';
  assert (v->'totals'->>'referred_orders')::int = 1, 'reads doctors.shop_orders';

  perform set_config('request.jwt.claims', '{"email":"main@test.invalid"}', true);
  v := doctors.get_main_store_dashboard();
  assert (v->>'total_orders')::int = 2, 'main store dashboard counts paid tree orders from doctors.shop_orders';
  v := doctors.get_main_store_reports();
  assert v ? 'orders' and v ? 'stores', 'main store reports load';
end $$;
select 'ok: dashboards read doctors.shop_orders';

-- ─── Grants ────────────────────────────────────────────────────────────────────
do $$ begin
  assert not has_function_privilege('anon', 'public.assert_wheel_admin(text)', 'execute'), 'anon must not reach public.assert_wheel_admin';
  assert not has_function_privilege('anon', 'doctors.assert_wheel_admin(text)', 'execute'), 'anon must not reach doctors.assert_wheel_admin';
  assert has_function_privilege('service_role', 'doctors.assert_wheel_admin(text)', 'execute');
  assert not has_function_privilege('anon', 'doctors.admin_list_doctor_registrations(text)', 'execute');
  assert not has_function_privilege('anon', 'doctors.admin_upgrade_to_main_store(text,uuid,text)', 'execute');
  assert not has_function_privilege('anon', 'doctors.partner_dashboard(text,text,integer,integer,timestamptz,timestamptz,text)', 'execute');
  assert has_function_privilege('authenticated', 'doctors.partner_dashboard(text,text,integer,integer,timestamptz,timestamptz,text)', 'execute');
  assert has_function_privilege('anon', 'doctors.register_doctor(text,text,text,text,text,text,text,text,text)', 'execute');
  assert (select count(*) from pg_proc where proname = 'get_main_store_reports' and pronamespace = 'sandbox'::regnamespace) = 1;
end $$;
select 'ok: grants';

-- ─── Admin list + upgrade to Main Store (breakaway) ───────────────────────────
do $$
declare
  v_child uuid := (select id from doctors.doctor_registrations where email = 'child@test.invalid');
  v_grandchild uuid;
  v jsonb;
begin
  assert (select store_type from doctors.admin_list_doctor_registrations('test-admin-pw') where id = v_child) = 'lifestyle',
    'admin list exposes store_type';

  v_grandchild := doctors.register_doctor('Dr Grandchild', 'gc@test.invalid', '09301234567', '', 'GP', 'Iloilo', (select routing_slug from doctors.doctor_registrations where id = v_child), '', '');

  -- Dr Child has a referrer (Dr Upline): this used to fail on the immutability trigger.
  v := doctors.admin_upgrade_to_main_store('test-admin-pw', v_child, 'test');
  assert (select store_type from doctors.doctor_registrations where id = v_child) = 'main';
  assert (select referred_by_partner_id from doctors.doctor_registrations where id = v_child) is null, 'breakaway severs upline';
  assert (select main_store_id from doctors.doctor_registrations where id = v_grandchild) = v_child, 'subtree moves under the new main store';

  -- The immutability guard still applies to everything else.
  begin
    update doctors.doctor_registrations set referred_by_partner_id = null where id = v_grandchild;
    raise exception 'referrer change was allowed outside the upgrade';
  exception when check_violation then
    null;
  end;
end $$;
select 'ok: admin list + upgrade to main store';

select 'ALL RELEASE RECONCILIATION CHECKS PASSED';
