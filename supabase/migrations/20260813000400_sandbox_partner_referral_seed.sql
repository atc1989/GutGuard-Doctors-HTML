-- Idempotent QA fixtures for the sandbox partner referral dashboard.
-- Public partner registrations are shared with sandbox by design; all orders/clicks
-- remain isolated in the sandbox schema. Safe to re-run without duplicating rows.
do $$
declare
  v_owner_id uuid;
  v_referred_one uuid := '7b61e486-b8fe-48cc-bd87-5992ca296357';
  v_referred_two uuid := '1d010f29-498e-491e-a36a-98e34597f4b4';
begin
  select id into v_owner_id
  from public.doctor_registrations
  where routing_slug = 'najeeb-mapantas'
  limit 1;

  if v_owner_id is null then
    raise notice 'SANDBOX QA seed skipped: partner najeeb-mapantas was not found';
    return;
  end if;

  insert into public.doctor_registrations (
    id, full_name, email, mobile, tiktok_username, specialty,
    practice_location, routing_slug, redirect_url, referred_by_partner_id, created_at
  ) values
    (v_referred_one, 'SANDBOX QA Dr. Maria Santos', 'sandbox.maria@example.invalid',
     '09000000001', 'sandbox_qa_maria', 'Internal Medicine', 'Makati City',
     'sandbox-qa-maria-santos', 'https://www.tiktok.com/@sandbox_qa_maria', v_owner_id, now() - interval '12 days'),
    (v_referred_two, 'SANDBOX QA Dr. Carlo Reyes', 'sandbox.carlo@example.invalid',
     '09000000002', 'sandbox_qa_carlo', 'Pediatrics', 'Cebu City',
     'sandbox-qa-carlo-reyes', 'https://www.tiktok.com/@sandbox_qa_carlo', v_owner_id, now() - interval '7 days')
  on conflict (id) do nothing;

  insert into sandbox.shop_orders (
    id, order_code, status, payment_status, payment_method, customer_name,
    first_name, last_name, email, mobile, address, city, province, barangay, zip,
    shipping_fee, shipping_weight_grams, subtotal, total_amount, items,
    referral_slug, referral_doctor_id, created_at, updated_at
  ) values
    ('7706c6f9-afad-445b-bb6e-c655f21da14d', 'SBX-QA-DIRECT-001', 'fulfilled', 'paid', 'maya',
     'SANDBOX Buyer Direct', 'Sandbox', 'Direct', 'sandbox.direct@example.invalid', '09000000101',
     'QA Address', 'Davao City', 'Davao del Sur', 'Poblacion', '8000', 120, 500, 2080, 2200,
     '[{"name":"GutGuard QA Protocol","quantity":1,"price":2080}]'::jsonb,
     'najeeb-mapantas', v_owner_id, now() - interval '2 days', now() - interval '2 days'),
    ('7706c6f9-afad-445b-bb6e-c655f21da14e', 'SBX-QA-MARIA-001', 'paid', 'paid', 'maya',
     'SANDBOX Buyer Maria', 'Sandbox', 'Maria', 'sandbox.maria.buyer@example.invalid', '09000000102',
     'QA Address', 'Makati City', 'Metro Manila', 'Bel-Air', '1209', 100, 500, 1700, 1800,
     '[{"name":"GutGuard QA Trial","quantity":1,"price":1700}]'::jsonb,
     'sandbox-qa-maria-santos', v_referred_one, now() - interval '1 day', now() - interval '1 day'),
    ('7706c6f9-afad-445b-bb6e-c655f21da14f', 'SBX-QA-CARLO-001', 'pending_payment', 'pending', 'maya',
     'SANDBOX Buyer Carlo', 'Sandbox', 'Carlo', 'sandbox.carlo.buyer@example.invalid', '09000000103',
     'QA Address', 'Cebu City', 'Cebu', 'Lahug', '6000', 100, 500, 1100, 1200,
     '[{"name":"GutGuard QA Starter","quantity":1,"price":1100}]'::jsonb,
     'sandbox-qa-carlo-reyes', v_referred_two, now() - interval '3 hours', now() - interval '3 hours')
  on conflict (id) do nothing;

  insert into sandbox.referral_clicks (id, routing_slug, doctor_id, created_at) values
    ('7706c6f9-afad-445b-bb6e-c655f21da150', 'najeeb-mapantas', v_owner_id, now() - interval '5 days'),
    ('7706c6f9-afad-445b-bb6e-c655f21da151', 'najeeb-mapantas', v_owner_id, now() - interval '1 day'),
    ('7706c6f9-afad-445b-bb6e-c655f21da152', 'najeeb-mapantas', v_owner_id, now() - interval '1 hour')
  on conflict (id) do nothing;
end;
$$;
