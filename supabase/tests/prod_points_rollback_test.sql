-- Points / Main Store end-to-end check that is SAFE TO RUN ON PRODUCTION: it always ends by
-- raising an exception, so Postgres rolls back every row it touched. Nothing is saved.
--
-- What it exercises (the real live functions and triggers, not copies):
--   order through Najeeb's link -> paid -> Najeeb gets direct points, the Main Store
--   (gutguardhq@gutguard.ph) gets pass-up points, the order shows in the Main Store dashboard
--   and reports -> webhook retry (paid again) changes nothing -> refund takes the points back
--   -> paid again re-awards them.
-- What it does NOT exercise: Maya itself (checkout, webhook signature, lib/maya-orders.ts).
--
-- Prerequisite: cleanup/20261009_place_najeeb_under_new_atc.sql has been run.
-- Run the whole file in the SQL editor. The result is the error message:
--   "ROLLED BACK (nothing was saved). N of N checks passed." + the failed checks, if any.

do $test$
declare
  v_main_email constant text := 'gutguardhq@gutguard.ph';
  v_najeeb_email constant text := 'najeebmapantas21@gmail.com';
  v_code constant text := 'GG-ROLLBACK-TEST';
  v_amount constant numeric := 4999;  -- Start pack: floor(4999 / 1000) = 4 points
  v_pts constant integer := 4;
  v_main uuid;
  v_najeeb uuid;
  v_najeeb_ref uuid;
  s0 jsonb; s1 jsonb; s2 jsonb; s3 jsonb; s4 jsonb; s5 jsonb;
  checks jsonb := '[]'::jsonb;
  v_failed jsonb;
begin
  select id into v_main from doctors.doctor_registrations where lower(email) = v_main_email and store_type = 'main';
  select id, referred_by_partner_id into v_najeeb, v_najeeb_ref
  from doctors.doctor_registrations where lower(email) = v_najeeb_email;
  if v_main is null or v_najeeb is null then
    raise exception 'Test accounts not found (% / %).', v_main_email, v_najeeb_email;
  end if;
  if v_najeeb_ref is distinct from v_main then
    raise exception 'Najeeb is not under the Main Store yet: run cleanup/20261009_place_najeeb_under_new_atc.sql first.';
  end if;

  -- Snapshot through the same RPCs the portal calls, signed in as each account.
  execute $f$
    create function pg_temp.rt_snap(p_main_email text, p_najeeb_email text, p_code text) returns jsonb
    language plpgsql as $b$
    declare md jsonb; mr jsonb; mpd jsonb; npd jsonb;
    begin
      perform set_config('request.jwt.claims', json_build_object('email', p_main_email)::text, true);
      md := doctors.get_main_store_dashboard();
      mr := doctors.get_main_store_reports();
      mpd := doctors.partner_dashboard();
      perform set_config('request.jwt.claims', json_build_object('email', p_najeeb_email)::text, true);
      npd := doctors.partner_dashboard();
      perform set_config('request.jwt.claims', '', true);
      return jsonb_build_object(
        'najeeb_own_points', (npd->'points'->>'own_points')::int,
        'najeeb_paid_orders', (npd->'totals'->>'paid_orders')::int,
        'najeeb_points_log_has_order', exists (select 1 from jsonb_array_elements(npd->'point_sources') e where e->>'order_code' = p_code),
        'main_passup_points', (mpd->'points'->>'passup_points')::int,
        'main_dashboard_paid_orders', (md->>'total_orders')::int,
        'main_dashboard_revenue', (md->>'total_revenue')::numeric,
        'main_dashboard_passup', (md->>'passup_points')::int,
        'main_reports_has_order', exists (select 1 from jsonb_array_elements(mr->'orders') e where e->>'order_code' = p_code),
        'main_reports_store_name', (select e->>'store_name' from jsonb_array_elements(mr->'orders') e where e->>'order_code' = p_code limit 1)
      );
    end $b$
  $f$;

  s0 := pg_temp.rt_snap(v_main_email, v_najeeb_email, v_code);

  -- 1. Pending order through Najeeb's link
  insert into doctors.shop_orders (order_code, customer_name, email, mobile, address, city, province, zip,
                                   subtotal, total_amount, referral_slug, referral_doctor_id)
  select v_code, 'Rollback Test', 'rollback-test@example.invalid', '09000000000', 'Test', 'Test', 'Test', '0000',
         v_amount, v_amount, routing_slug, id
  from doctors.doctor_registrations where id = v_najeeb;
  s1 := pg_temp.rt_snap(v_main_email, v_najeeb_email, v_code);

  -- 2. Paid (what the Maya webhook does)
  update doctors.shop_orders set payment_status = 'paid', status = 'paid', paid_at = now() where order_code = v_code;
  s2 := pg_temp.rt_snap(v_main_email, v_najeeb_email, v_code);

  -- 3. Webhook retry
  update doctors.shop_orders set payment_status = 'paid' where order_code = v_code;
  s3 := pg_temp.rt_snap(v_main_email, v_najeeb_email, v_code);

  -- 4. Refund
  update doctors.shop_orders set payment_status = 'refunded', status = 'cancelled', paid_at = null where order_code = v_code;
  s4 := pg_temp.rt_snap(v_main_email, v_najeeb_email, v_code);

  -- 5. Paid again
  update doctors.shop_orders set payment_status = 'paid', status = 'paid', paid_at = now() where order_code = v_code;
  s5 := pg_temp.rt_snap(v_main_email, v_najeeb_email, v_code);

  checks := jsonb_build_array(
    jsonb_build_object('check', 'pending order gives no points', 'ok', s1->'najeeb_own_points' = s0->'najeeb_own_points' and s1->'main_passup_points' = s0->'main_passup_points'),
    jsonb_build_object('check', 'pending order already listed in Main Store reports', 'ok', (s1->>'main_reports_has_order')::boolean),
    jsonb_build_object('check', format('paid: Najeeb +%s direct points', v_pts), 'ok', (s2->>'najeeb_own_points')::int = (s0->>'najeeb_own_points')::int + v_pts, 'got', s2->'najeeb_own_points', 'before', s0->'najeeb_own_points'),
    jsonb_build_object('check', 'paid: order in Najeeb points log', 'ok', (s2->>'najeeb_points_log_has_order')::boolean),
    jsonb_build_object('check', 'paid: Najeeb paid orders +1', 'ok', (s2->>'najeeb_paid_orders')::int = (s0->>'najeeb_paid_orders')::int + 1),
    jsonb_build_object('check', format('paid: Main Store +%s pass-up points (partner dashboard)', v_pts), 'ok', (s2->>'main_passup_points')::int = (s0->>'main_passup_points')::int + v_pts, 'got', s2->'main_passup_points', 'before', s0->'main_passup_points'),
    jsonb_build_object('check', format('paid: Main Store dashboard pass-up +%s', v_pts), 'ok', (s2->>'main_dashboard_passup')::int = (s0->>'main_dashboard_passup')::int + v_pts),
    jsonb_build_object('check', 'paid: Main Store dashboard paid orders +1', 'ok', (s2->>'main_dashboard_paid_orders')::int = (s0->>'main_dashboard_paid_orders')::int + 1),
    jsonb_build_object('check', format('paid: Main Store dashboard revenue +%s', v_amount), 'ok', (s2->>'main_dashboard_revenue')::numeric = (s0->>'main_dashboard_revenue')::numeric + v_amount),
    jsonb_build_object('check', 'paid: Main Store reports show the order under Najeeb', 'ok', s2->>'main_reports_store_name' = 'Najeeb Mapantas', 'got', s2->'main_reports_store_name'),
    jsonb_build_object('check', 'webhook retry: no double points', 'ok', s3->'najeeb_own_points' = s2->'najeeb_own_points' and s3->'main_passup_points' = s2->'main_passup_points'),
    jsonb_build_object('check', 'refund: Najeeb points back to before', 'ok', s4->'najeeb_own_points' = s0->'najeeb_own_points', 'got', s4->'najeeb_own_points'),
    jsonb_build_object('check', 'refund: Main Store pass-up back to before', 'ok', s4->'main_passup_points' = s0->'main_passup_points', 'got', s4->'main_passup_points'),
    jsonb_build_object('check', 'refund: Main Store paid orders and revenue back to before', 'ok', s4->'main_dashboard_paid_orders' = s0->'main_dashboard_paid_orders' and s4->'main_dashboard_revenue' = s0->'main_dashboard_revenue'),
    jsonb_build_object('check', 'refund: order gone from Najeeb points log', 'ok', not (s4->>'najeeb_points_log_has_order')::boolean),
    jsonb_build_object('check', 'paid again: points re-awarded once', 'ok', s5->'najeeb_own_points' = s2->'najeeb_own_points' and s5->'main_passup_points' = s2->'main_passup_points')
  );

  select coalesce(jsonb_agg(c), '[]'::jsonb) into v_failed from jsonb_array_elements(checks) c where not coalesce((c->>'ok')::boolean, false);

  raise exception using
    message = format('ROLLED BACK (nothing was saved). %s of %s checks passed.%s',
                     jsonb_array_length(checks) - jsonb_array_length(v_failed), jsonb_array_length(checks),
                     case when jsonb_array_length(v_failed) > 0 then ' FAILED: ' || v_failed::text else '' end),
    detail = jsonb_pretty(jsonb_build_object('before', s0, 'after_paid', s2, 'after_refund', s4, 'checks', checks));
end $test$;
