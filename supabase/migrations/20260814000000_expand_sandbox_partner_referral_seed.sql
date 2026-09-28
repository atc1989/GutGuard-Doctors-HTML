-- Expanded, deterministic QA data for dashboard pagination, filters, sorting,
-- attribution, totals, and referred-partner summaries.
do $$
declare
  v_owner_id uuid;
  v_partner_ids uuid[] := array[
    '4fbb1000-0000-4000-8000-000000000001'::uuid,
    '4fbb1000-0000-4000-8000-000000000002'::uuid,
    '4fbb1000-0000-4000-8000-000000000003'::uuid,
    '4fbb1000-0000-4000-8000-000000000004'::uuid
  ];
  i integer;
  v_source_id uuid;
  v_source_slug text;
  v_status text;
  v_payment_status text;
  v_owner_email text;
  v_dashboard jsonb;
begin
  select id, email into v_owner_id, v_owner_email
  from public.doctor_registrations
  where routing_slug = 'najeeb-mapantas'
  limit 1;

  if v_owner_id is null then
    raise notice 'Expanded SANDBOX QA seed skipped: partner najeeb-mapantas was not found';
    return;
  end if;

  insert into public.doctor_registrations (
    id, full_name, email, mobile, tiktok_username, specialty,
    practice_location, routing_slug, redirect_url, referred_by_partner_id, created_at
  ) values
    (v_partner_ids[1], 'SANDBOX QA Dr. Angela Lim', 'sandbox.angela@example.invalid',
     '09000000011', 'sandbox_qa_angela', 'Family Medicine', 'Quezon City',
     'sandbox-qa-angela-lim', 'https://www.tiktok.com/@sandbox_qa_angela', v_owner_id, now() - interval '45 days'),
    (v_partner_ids[2], 'SANDBOX QA Dr. Miguel Dela Cruz', 'sandbox.miguel@example.invalid',
     '09000000012', 'sandbox_qa_miguel', 'Cardiology', 'Pasig City',
     'sandbox-qa-miguel-dela-cruz', 'https://www.tiktok.com/@sandbox_qa_miguel', v_owner_id, now() - interval '31 days'),
    (v_partner_ids[3], 'SANDBOX QA Dr. Lea Garcia', 'sandbox.lea@example.invalid',
     '09000000013', 'sandbox_qa_lea', 'Endocrinology', 'Iloilo City',
     'sandbox-qa-lea-garcia', 'https://www.tiktok.com/@sandbox_qa_lea', v_owner_id, now() - interval '18 days'),
    (v_partner_ids[4], 'SANDBOX QA Dr. Ramon Sy', 'sandbox.ramon@example.invalid',
     '09000000014', 'sandbox_qa_ramon', 'Gastroenterology', 'Baguio City',
     'sandbox-qa-ramon-sy', 'https://www.tiktok.com/@sandbox_qa_ramon', v_owner_id, now() - interval '4 days')
  on conflict do nothing;

  -- 42 orders plus the original three fixtures guarantee two pages at the
  -- dashboard's default page size. Every fourth order is direct; the rest rotate
  -- across four referred partners. Dates span today through 82 days ago.
  for i in 1..42 loop
    if i % 4 = 0 then
      v_source_id := v_owner_id;
      v_source_slug := 'najeeb-mapantas';
    else
      v_source_id := v_partner_ids[((i - 1) % 4) + 1];
      v_source_slug := (array[
        'sandbox-qa-angela-lim', 'sandbox-qa-miguel-dela-cruz',
        'sandbox-qa-lea-garcia', 'sandbox-qa-ramon-sy'
      ])[((i - 1) % 4) + 1];
    end if;

    case i % 7
      when 0 then v_status := 'cancelled'; v_payment_status := 'failed';
      when 1 then v_status := 'pending_payment'; v_payment_status := 'pending';
      when 2 then v_status := 'payment_review'; v_payment_status := 'review';
      when 3 then v_status := 'paid'; v_payment_status := 'paid';
      when 4 then v_status := 'confirmed'; v_payment_status := 'paid';
      when 5 then v_status := 'fulfilled'; v_payment_status := 'paid';
      else v_status := 'cancelled'; v_payment_status := 'refunded';
    end case;

    insert into sandbox.shop_orders (
      id, order_code, status, payment_status, payment_method, customer_name,
      first_name, last_name, email, mobile, address, city, province, barangay, zip,
      shipping_fee, shipping_weight_grams, subtotal, total_amount, items,
      referral_slug, referral_doctor_id, created_at, updated_at
    ) values (
      md5('gutguard-expanded-qa-order-' || i::text)::uuid,
      'SBX-QA-BULK-' || lpad(i::text, 3, '0'), v_status, v_payment_status, 'maya',
      'SANDBOX Buyer ' || lpad(i::text, 3, '0'), 'QA' || i::text, 'Buyer',
      'sandbox.buyer' || i::text || '@example.invalid', '0900000' || lpad(i::text, 4, '0'),
      'QA Address ' || i::text, (array['Makati City','Cebu City','Davao City','Iloilo City'])[((i - 1) % 4) + 1],
      (array['Metro Manila','Cebu','Davao del Sur','Iloilo'])[((i - 1) % 4) + 1],
      'SANDBOX Barangay', '1000', 100 + (i % 3) * 20, 500,
      900 + i * 50, 1000 + i * 50 + (i % 3) * 20,
      jsonb_build_array(jsonb_build_object('name', 'GutGuard SANDBOX QA Item', 'quantity', 1, 'price', 900 + i * 50)),
      v_source_slug, v_source_id, now() - make_interval(days => (i - 1) * 2),
      now() - make_interval(days => (i - 1) * 2)
    ) on conflict do nothing;
  end loop;

  -- 55 deterministic clicks cover total versus last-30-day calculations.
  for i in 1..55 loop
    insert into sandbox.referral_clicks (id, routing_slug, doctor_id, created_at)
    values (
      md5('gutguard-expanded-qa-click-' || i::text)::uuid,
      'najeeb-mapantas', v_owner_id, now() - make_interval(days => i - 1)
    ) on conflict do nothing;
  end loop;

  assert (select count(*) from sandbox.shop_orders where order_code like 'SBX-QA-BULK-%') = 42,
    'Expanded SANDBOX QA orders were not seeded completely';
  assert (select count(*) from public.doctor_registrations where referred_by_partner_id = v_owner_id and full_name like 'SANDBOX QA%') >= 6,
    'Expanded SANDBOX QA referred partners were not seeded completely';
  assert (select count(*) from sandbox.referral_clicks where id = md5('gutguard-expanded-qa-click-55')::uuid) = 1,
    'Expanded SANDBOX QA clicks were not seeded completely';

  perform set_config('request.jwt.claims', jsonb_build_object('email', v_owner_email)::text, true);
  select sandbox.partner_dashboard('all', null, 25, 0, null, null, 'newest') into v_dashboard;
  assert (v_dashboard #>> '{orders_page,has_more}')::boolean,
    'Expanded SANDBOX QA data must exercise dashboard pagination';
  assert (v_dashboard #>> '{totals,direct_orders}')::integer >= 11,
    'Expanded SANDBOX QA data must include direct orders';
  assert (v_dashboard #>> '{totals,referred_orders}')::integer >= 32,
    'Expanded SANDBOX QA data must include referred orders';
end;
$$;
