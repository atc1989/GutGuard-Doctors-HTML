-- The partner portal is served from partners.gutguard.ph and reads the public
-- partner_dashboard RPC even while the shop checkout is on sandbox.gutguard.ph.
-- Mirror only unmistakably labeled QA orders so that end-to-end partner testing
-- works without mixing in ordinary sandbox checkout records.
do $$
declare
  v_owner_email text;
  v_dashboard jsonb;
begin
  insert into public.shop_orders (
    id, order_code, status, payment_status, payment_method, maya_reference,
    customer_name, first_name, last_name, email, mobile, address, city, province,
    barangay, zip, province_code, city_municipality_code, barangay_code,
    shipping_region, shipping_fee, shipping_weight_grams, total_amount, subtotal,
    items, admin_notes, referral_slug, referral_doctor_id, created_at, updated_at
  )
  select
    s.id, s.order_code, s.status, s.payment_status, s.payment_method, s.maya_reference,
    s.customer_name, s.first_name, s.last_name, s.email, s.mobile, s.address, s.city, s.province,
    s.barangay, s.zip, s.province_code, s.city_municipality_code, s.barangay_code,
    s.shipping_region, s.shipping_fee, s.shipping_weight_grams, s.total_amount, s.subtotal,
    s.items, 'SANDBOX QA fixture — safe to remove'::text, s.referral_slug,
    s.referral_doctor_id, s.created_at, s.updated_at
  from sandbox.shop_orders s
  where s.order_code like 'SBX-QA-%'
  on conflict do nothing;

  select email into v_owner_email
  from public.doctor_registrations
  where routing_slug = 'najeeb-mapantas'
  limit 1;

  if v_owner_email is null then
    raise exception 'QA owner najeeb-mapantas was not found';
  end if;

  perform set_config('request.jwt.claims', jsonb_build_object('email', v_owner_email)::text, true);
  select public.partner_dashboard('all', null, 25, 0, null, null, 'newest') into v_dashboard;

  assert (v_dashboard #>> '{totals,orders}')::integer >= 45,
    'Public partner dashboard did not receive the QA order mirror';
  assert (v_dashboard #>> '{totals,direct_orders}')::integer >= 11,
    'Public partner dashboard QA mirror is missing direct orders';
  assert (v_dashboard #>> '{totals,referred_orders}')::integer >= 32,
    'Public partner dashboard QA mirror is missing referred orders';
  assert (v_dashboard #>> '{orders_page,has_more}')::boolean,
    'Public partner dashboard QA mirror must exercise pagination';
end;
$$;
