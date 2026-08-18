CREATE OR REPLACE FUNCTION doctors.admin_get_shop_order(p_admin_password text, p_order_id uuid)
 RETURNS SETOF doctors.shop_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
begin
  perform doctors.assert_wheel_admin(p_admin_password);

  return query select * from doctors.admin_get_shop_order_unchecked(p_order_id);
end;
$function$


CREATE OR REPLACE FUNCTION doctors.admin_get_shop_order_unchecked(p_order_id uuid)
 RETURNS SETOF doctors.shop_orders
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
  select * from doctors.shop_orders where id = p_order_id limit 1;
$function$


CREATE OR REPLACE FUNCTION doctors.admin_list_doctor_registrations(p_admin_password text)
 RETURNS TABLE(id uuid, full_name text, email text, mobile text, tiktok_username text, routing_slug text, redirect_url text, specialty text, practice_location text, created_at timestamp with time zone, prize_label text, prize_claimed_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
begin
  perform doctors.assert_wheel_admin(p_admin_password);

  return query
  select
    doctor_registrations.id,
    doctor_registrations.full_name::text,
    doctor_registrations.email::text,
    doctor_registrations.mobile::text,
    doctor_registrations.tiktok_username::text,
    doctor_registrations.routing_slug::text,
    coalesce(doctor_registrations.redirect_url, '')::text,
    doctor_registrations.specialty::text,
    doctor_registrations.practice_location::text,
    doctor_registrations.created_at,
    null::text as prize_label,
    null::timestamptz as prize_claimed_at
  from doctors.doctor_registrations
  order by doctor_registrations.created_at desc;
end;
$function$


CREATE OR REPLACE FUNCTION doctors.admin_list_newsletter_sends(p_admin_password text)
 RETURNS TABLE(id uuid, doctor_id uuid, newsletter_id uuid, newsletter_title text, email text, subject text, status text, resend_id text, error_message text, sent_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
begin
  perform doctors.assert_wheel_admin(p_admin_password);

  return query
  select
    ns.id,
    ns.doctor_id,
    ns.newsletter_id,
    nc.title as newsletter_title,
    ns.email,
    ns.subject,
    ns.status,
    ns.resend_id,
    ns.error_message,
    ns.sent_at
  from doctors.newsletter_sends ns
  left join doctors.newsletter_campaigns nc on nc.id = ns.newsletter_id
  order by ns.sent_at desc;
end;
$function$


CREATE OR REPLACE FUNCTION doctors.admin_list_shop_orders(p_admin_password text)
 RETURNS SETOF doctors.shop_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
begin
  perform doctors.assert_wheel_admin(p_admin_password);

  return query
  select * from doctors.shop_orders order by created_at desc;
end;
$function$


CREATE OR REPLACE FUNCTION doctors.admin_list_sms_sends(p_admin_password text)
 RETURNS TABLE(id uuid, doctor_id uuid, sms_campaign_id uuid, sms_campaign_title text, mobile text, message text, status text, provider_message_id text, error_message text, sent_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
begin
  perform doctors.assert_wheel_admin(p_admin_password);

  return query
  select
    sms_sends.id,
    sms_sends.doctor_id,
    sms_sends.sms_campaign_id,
    sms_campaigns.title,
    sms_sends.mobile,
    sms_sends.message,
    sms_sends.status,
    sms_sends.provider_message_id,
    sms_sends.error_message,
    sms_sends.sent_at
  from doctors.sms_sends
  left join doctors.sms_campaigns on sms_campaigns.id = sms_sends.sms_campaign_id
  order by sms_sends.sent_at desc;
end;
$function$


CREATE OR REPLACE FUNCTION doctors.admin_list_wheel_prizes(p_admin_password text)
 RETURNS TABLE(id uuid, label text, note text, color text, text_color text, chance_weight integer, total_stock integer, remaining_stock integer, is_active boolean, sort_order integer, claim_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
begin
  perform doctors.assert_wheel_admin(p_admin_password);

  return query
  select
    p.id, p.label, p.note, p.color, p.text_color,
    p.chance_weight, p.total_stock, p.remaining_stock,
    p.is_active, p.sort_order,
    coalesce(c.claim_count, 0) as claim_count
  from doctors.wheel_prizes p
  left join (
    select prize_id, count(*) as claim_count
    from doctors.wheel_claims
    group by prize_id
  ) c on c.prize_id = p.id
  order by p.sort_order, p.created_at;
end;
$function$


CREATE OR REPLACE FUNCTION doctors.admin_update_doctor_registration(p_admin_password text, p_doctor_id uuid, p_full_name text, p_email text, p_mobile text, p_tiktok_username text, p_specialty text, p_practice_location text, p_redirect_url text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, full_name text, email text, mobile text, tiktok_username text, routing_slug text, redirect_url text, specialty text, practice_location text, created_at timestamp with time zone, prize_label text, prize_claimed_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
begin
  perform doctors.assert_wheel_admin(p_admin_password);

  update doctors.doctor_registrations
  set
    full_name = trim(p_full_name),
    email = nullif(lower(trim(coalesce(p_email, ''))), ''),
    mobile = trim(p_mobile),
    tiktok_username = regexp_replace(lower(trim(coalesce(p_tiktok_username, ''))), '^@+', ''),
    redirect_url = nullif(trim(coalesce(p_redirect_url, '')), ''),
    specialty = trim(p_specialty),
    practice_location = trim(p_practice_location)
  where doctor_registrations.id = p_doctor_id;

  return query
  select *
  from doctors.admin_list_doctor_registrations(p_admin_password) registrations
  where registrations.id = p_doctor_id;
end;
$function$


CREATE OR REPLACE FUNCTION doctors.admin_update_shop_order(p_admin_password text, p_order_id uuid, p_status text, p_payment_status text, p_maya_reference text DEFAULT NULL::text, p_admin_notes text DEFAULT NULL::text)
 RETURNS SETOF doctors.shop_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
begin
  perform doctors.assert_wheel_admin(p_admin_password);

  update doctors.shop_orders
  set
    status = p_status,
    payment_status = p_payment_status,
    maya_reference = nullif(trim(coalesce(p_maya_reference, '')), ''),
    admin_notes = nullif(trim(coalesce(p_admin_notes, '')), ''),
    paid_at = case when p_payment_status = 'paid' then coalesce(paid_at, now()) else paid_at end
  where shop_orders.id = p_order_id;

  return query select * from doctors.admin_get_shop_order_unchecked(p_order_id);
end;
$function$


CREATE OR REPLACE FUNCTION doctors.admin_upsert_wheel_prize(p_admin_password text, p_id uuid, p_label text, p_note text, p_color text, p_text_color text, p_chance_weight integer, p_total_stock integer, p_remaining_stock integer, p_is_active boolean, p_sort_order integer)
 RETURNS TABLE(id uuid, label text, note text, color text, text_color text, chance_weight integer, total_stock integer, remaining_stock integer, is_active boolean, sort_order integer, claim_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
declare
  v_id uuid;
begin
  perform doctors.assert_wheel_admin(p_admin_password);

  if p_id is null then
    insert into doctors.wheel_prizes
      (label, note, color, text_color, chance_weight, total_stock, remaining_stock, is_active, sort_order)
    values
      (p_label, p_note, p_color, p_text_color, p_chance_weight, p_total_stock, p_remaining_stock, p_is_active, p_sort_order)
    returning wheel_prizes.id into v_id;
  else
    update doctors.wheel_prizes
    set label = p_label,
        note = p_note,
        color = p_color,
        text_color = p_text_color,
        chance_weight = p_chance_weight,
        total_stock = p_total_stock,
        remaining_stock = p_remaining_stock,
        is_active = p_is_active,
        sort_order = p_sort_order,
        updated_at = now()
    where wheel_prizes.id = p_id
    returning wheel_prizes.id into v_id;
  end if;

  return query
  select *
  from doctors.admin_list_wheel_prizes(p_admin_password) p
  where p.id = v_id;
end;
$function$


CREATE OR REPLACE FUNCTION doctors.assert_wheel_admin(p_admin_password text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
begin
  if not exists (
    select 1
    from doctors.wheel_admin_settings
    where id = true
      and admin_password = p_admin_password
  ) then
    raise exception 'Invalid admin password' using errcode = '28000';
  end if;
end;
$function$


CREATE OR REPLACE FUNCTION doctors.claim_prize(p_doctor_id uuid)
 RETURNS TABLE(prize_id uuid, prize_label text, prize_note text, color text, text_color text, chance_weight integer, total_stock integer, remaining_stock integer, is_active boolean, sort_order integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
declare
  v_total_weight integer;
  v_target double precision;
  v_running double precision := 0;
  v_prize doctors.wheel_prizes%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext(p_doctor_id::text));

  return query
  select
    c.prize_id,
    c.prize_label_snapshot,
    c.prize_note_snapshot,
    p.color,
    p.text_color,
    p.chance_weight,
    p.total_stock,
    p.remaining_stock,
    p.is_active,
    p.sort_order
  from doctors.wheel_claims c
  join doctors.wheel_prizes p on p.id = c.prize_id
  where c.doctor_id = p_doctor_id;

  if found then
    return;
  end if;

  select coalesce(sum(p.chance_weight), 0)
  into v_total_weight
  from doctors.wheel_prizes p
  where p.is_active = true
    and p.chance_weight > 0
    and p.remaining_stock > 0;

  if v_total_weight <= 0 then
    raise exception 'No wheel prizes available';
  end if;

  v_target := random() * v_total_weight;

  for v_prize in
    select *
    from doctors.wheel_prizes p
    where p.is_active = true
      and p.chance_weight > 0
      and p.remaining_stock > 0
    order by p.sort_order, p.created_at
    for update
  loop
    v_running := v_running + v_prize.chance_weight;
    exit when v_target <= v_running;
  end loop;

  update doctors.wheel_prizes wp
  set remaining_stock = wp.remaining_stock - 1,
      updated_at = now()
  where wp.id = v_prize.id
    and wp.remaining_stock > 0
  returning wp.* into v_prize;

  insert into doctors.wheel_claims
    (doctor_id, prize_id, prize_label_snapshot, prize_note_snapshot)
  values
    (p_doctor_id, v_prize.id, v_prize.label, v_prize.note);

  return query
  select
    v_prize.id,
    v_prize.label,
    v_prize.note,
    v_prize.color,
    v_prize.text_color,
    v_prize.chance_weight,
    v_prize.total_stock,
    v_prize.remaining_stock,
    v_prize.is_active,
    v_prize.sort_order;
end;
$function$


