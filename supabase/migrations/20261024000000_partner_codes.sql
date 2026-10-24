-- Partner codes: one sequential number per partner (10001, 10002, ...), easy to read off a
-- poster or say out loud. Printed links become www.gutguard.ph/s/<code> (shop) and
-- www.gutguard.ph/j/<code> (join). Old /r/<key> and /<KEY> links keep resolving through
-- partner_by_key. Codes are deliberately NOT matched there: some old hex keys are all digits
-- (77982 is a real one), and a code equal to one would send the scan to the wrong partner.
--
-- partner_dashboard and admin_list_doctor_registrations are copied from the DEPLOYED
-- definitions (2026-10-24), not the repo copies, which have drifted.

create sequence if not exists doctors.partner_code_seq start 10001;

alter table doctors.doctor_registrations add column if not exists partner_code integer;

-- Oldest partner gets 10001. Done before the default is set: a volatile default on ADD COLUMN
-- would number existing rows in physical order instead.
update doctors.doctor_registrations d
set partner_code = n.code
from (
  select r.id, 10000 + row_number() over (order by r.created_at, r.id) as code
  from doctors.doctor_registrations r
) n
where d.id = n.id and d.partner_code is null;

select setval('doctors.partner_code_seq', greatest((select max(partner_code) from doctors.doctor_registrations), 10000));

alter table doctors.doctor_registrations
  alter column partner_code set default nextval('doctors.partner_code_seq'),
  alter column partner_code set not null,
  add constraint doctor_registrations_partner_code_key unique (partner_code);

alter sequence doctors.partner_code_seq owned by doctors.doctor_registrations.partner_code;

-- What /s/<code> and /j/<code> resolve. Anything that is not a plain number is no match.
create or replace function doctors.partner_slug_by_code(p_code text)
returns text
language sql
stable
security definer
set search_path = doctors, public
as $$
  select d.routing_slug
  from doctors.doctor_registrations d
  where d.partner_code = case
    when trim(coalesce(p_code, '')) ~ '^[0-9]{1,9}$' then trim(p_code)::integer
  end;
$$;

revoke all on function doctors.partner_slug_by_code(text) from public;
grant execute on function doctors.partner_slug_by_code(text) to anon, authenticated;

-- Invitations also return the code: old /<KEY> links redirect to /j/<code>, and a pending
-- partner has no name yet, so the form says "partner #<code>" instead.
drop function if exists doctors.get_partner_invitation(text);

create function doctors.get_partner_invitation(p_slug text)
returns table (routing_slug text, full_name text, link_key text, partner_code integer)
language sql
stable
security definer
set search_path = doctors, public
as $$
  select d.routing_slug, d.full_name, right(d.id::text, 5), d.partner_code from doctors.partner_by_key(p_slug) d;
$$;

grant execute on function doctors.get_partner_invitation(text) to anon, authenticated;

-- Staff mint a blank partner: just a code and both QRs. Admin fills the details later; once an
-- email is on the row the partner can sign in by OTP. Pending == email ''.
-- routing_slug is partner-<code> and stays that way on activation: orders and clicks recorded
-- before then are keyed to it.
create or replace function doctors.admin_create_pending_partner(p_admin_password text)
returns table (id uuid, partner_code integer, routing_slug text)
language plpgsql
security definer
set search_path = doctors, public
as $$
#variable_conflict use_column
declare
  v_id uuid;
  v_code integer;
  v_main_store_id uuid;
begin
  perform doctors.assert_wheel_admin(p_admin_password);

  -- Same root store register_doctor falls back to when there is no referrer.
  select d.id into v_main_store_id from doctors.doctor_registrations d
  where d.store_type = 'main'
  order by (d.routing_slug = 'gutguard-main') desc, d.created_at
  limit 1;

  -- Old link keys are id tails with unique indexes on them; keep them free, as register_doctor does.
  loop
    v_id := gen_random_uuid();
    exit when not exists (
      select 1 from doctors.doctor_registrations d
      where right(d.id::text, 5) = right(v_id::text, 5) or right(d.id::text, 8) = right(v_id::text, 8)
    );
  end loop;

  v_code := nextval('doctors.partner_code_seq');

  insert into doctors.doctor_registrations (
    id, partner_code, full_name, email, mobile, specialty, practice_location,
    routing_slug, store_type, referral_qr_enabled, main_store_id
  ) values (
    v_id, v_code, '', '', '', '', '',
    'partner-' || v_code, 'affiliate', true, v_main_store_id
  );

  return query select v_id, v_code, 'partner-' || v_code;
end;
$$;

-- Admin RPCs are service_role only (see 20260930000000_revoke_admin_rpcs_from_anon).
revoke all on function doctors.admin_create_pending_partner(text) from public, anon, authenticated;
grant execute on function doctors.admin_create_pending_partner(text) to service_role;

-- Clearing an email wrote NULL into a NOT NULL column. Empty string is what "no email" means
-- everywhere else (register_doctor, the partial unique index), and now marks a pending partner.
create or replace function doctors.admin_update_doctor_registration(
  p_admin_password text, p_doctor_id uuid, p_full_name text, p_email text, p_mobile text,
  p_tiktok_username text, p_specialty text, p_practice_location text,
  p_redirect_url text default null::text, p_name_prefix text default ''::text
)
returns table (
  id uuid, full_name text, name_prefix text, email text, mobile text, tiktok_username text,
  routing_slug text, redirect_url text, specialty text, practice_location text,
  created_at timestamp with time zone, prize_label text, prize_claimed_at timestamp with time zone
)
language plpgsql
security definer
set search_path to 'doctors', 'public'
as $$
begin
  perform doctors.assert_wheel_admin(p_admin_password);

  update doctors.doctor_registrations
  set
    name_prefix = trim(coalesce(p_name_prefix, '')),
    full_name = trim(p_full_name),
    email = lower(trim(coalesce(p_email, ''))),
    mobile = trim(p_mobile),
    tiktok_username = regexp_replace(lower(trim(coalesce(p_tiktok_username, ''))), '^@+', ''),
    redirect_url = nullif(trim(coalesce(p_redirect_url, '')), ''),
    specialty = trim(p_specialty),
    practice_location = trim(p_practice_location)
  where doctor_registrations.id = p_doctor_id;

  return query
  select
    r.id, r.full_name, r.name_prefix, r.email, r.mobile, r.tiktok_username,
    r.routing_slug, r.redirect_url, r.specialty, r.practice_location,
    r.created_at, r.prize_label, r.prize_claimed_at
  from doctors.admin_list_doctor_registrations(p_admin_password) r
  where r.id = p_doctor_id;
end;
$$;

-- Deployed definition + partner_code. Return type changes need a drop.
drop function if exists doctors.admin_list_doctor_registrations(text);

create function doctors.admin_list_doctor_registrations(p_admin_password text)
returns table(
  id uuid, full_name text, name_prefix text, email text, mobile text, tiktok_username text,
  routing_slug text, redirect_url text, specialty text, practice_location text,
  where_did_you_find_us text, referred_by_partner_id uuid, referrer_name text, referrer_prefix text,
  referrer_slug text, store_type text, referral_qr_enabled boolean, main_store_id uuid,
  promoted_at timestamp with time zone, promoted_by text, created_at timestamp with time zone,
  prize_label text, prize_claimed_at timestamp with time zone, shop_show_protocol boolean,
  partner_code integer
)
language plpgsql
security definer
set search_path to 'doctors', 'public'
as $$
begin
  perform doctors.assert_wheel_admin(p_admin_password);

  return query
  select
    d.id,
    d.full_name::text,
    d.name_prefix::text,
    d.email::text,
    d.mobile::text,
    d.tiktok_username::text,
    d.routing_slug::text,
    coalesce(d.redirect_url, '')::text,
    d.specialty::text,
    d.practice_location::text,
    coalesce(d.where_did_you_find_us, '')::text,
    d.referred_by_partner_id,
    ref.full_name::text as referrer_name,
    ref.name_prefix::text as referrer_prefix,
    ref.routing_slug::text as referrer_slug,
    d.store_type::text,
    d.referral_qr_enabled,
    d.main_store_id,
    d.promoted_at,
    d.promoted_by::text,
    d.created_at,
    null::text as prize_label,
    null::timestamptz as prize_claimed_at,
    d.shop_show_protocol,
    d.partner_code
  from doctors.doctor_registrations d
  left join doctors.doctor_registrations ref on ref.id = d.referred_by_partner_id
  order by d.created_at desc;
end;
$$;

revoke all on function doctors.admin_list_doctor_registrations(text) from public, anon, authenticated;
grant execute on function doctors.admin_list_doctor_registrations(text) to service_role;

-- Deployed definition + 'partner_code' on the partner object, for the share page's links.
create or replace function doctors.partner_dashboard(
  p_scope text default 'all'::text, p_status text default null::text, p_limit integer default 25,
  p_offset integer default 0, p_date_from timestamp with time zone default null::timestamp with time zone,
  p_date_to timestamp with time zone default null::timestamp with time zone, p_sort text default 'newest'::text
)
returns jsonb
language plpgsql
stable security definer
set search_path to 'doctors', 'public'
as $$
DECLARE
  v_email text;
  v_doctor doctors.doctor_registrations;
  v_scope text := lower(trim(coalesce(p_scope, 'all')));
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_order_count bigint;
  v_orders jsonb;
BEGIN
  if v_scope not in ('all', 'direct', 'referred') then
    raise exception 'Invalid order scope.' using errcode = '22023';
  end if;
  if lower(coalesce(p_sort, 'newest')) not in ('newest', 'oldest') then
    raise exception 'Invalid order sort.' using errcode = '22023';
  end if;

  v_email := nullif(lower(trim(coalesce(auth.jwt() ->> 'email', ''))), '');
  if v_email is null then
    raise exception 'Sign in to view your dashboard.' using errcode = '42501';
  end if;

  select * into v_doctor
  from doctors.doctor_registrations
  where email = v_email
  limit 1;

  if v_doctor.id is null then
    raise exception 'This email is not registered as a GutGuard partner.' using errcode = '42501';
  end if;

  select count(*) into v_order_count
  from doctors.shop_orders o
  join doctors.doctor_registrations source on source.id = o.referral_doctor_id
  where (source.id = v_doctor.id or source.referred_by_partner_id = v_doctor.id)
    and (
      v_scope = 'all'
      or (v_scope = 'direct' and source.id = v_doctor.id)
      or (v_scope = 'referred' and source.referred_by_partner_id = v_doctor.id)
    )
    and doctors.partner_order_matches_status(o.payment_status, o.status, p_status)
    and (p_date_from is null or o.created_at >= p_date_from)
    and (p_date_to is null or o.created_at < p_date_to + interval '1 day');

  select coalesce(jsonb_agg(entry order by
    case when lower(coalesce(p_sort, 'newest')) = 'oldest' then sort_at end asc,
    case when lower(coalesce(p_sort, 'newest')) = 'newest' then sort_at end desc
  ), '[]'::jsonb) into v_orders
  from (
    select o.created_at as sort_at, jsonb_build_object(
      'order_code', o.order_code,
      'created_at', o.created_at,
      'status', o.status,
      'payment_status', o.payment_status,
      'total_amount', coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0)),
      'buyer_first_name', coalesce(o.first_name, split_part(o.customer_name, ' ', 1)),
      'buyer_name', coalesce(
        nullif(trim(o.customer_name), ''),
        nullif(trim(concat_ws(' ', o.first_name, o.last_name)), '')
      ),
      'buyer_email', coalesce(o.email, ''),
      'buyer_mobile', coalesce(o.mobile, ''),
      'address', coalesce(o.address, ''),
      'barangay', coalesce(o.barangay, ''),
      'zip', coalesce(o.zip, ''),
      'city', o.city,
      'province', o.province,
      'source_type', case when source.id = v_doctor.id then 'direct' else 'referred' end,
      'source_partner_name', source.full_name,
      'source_partner_slug', source.routing_slug
    ) as entry
    from doctors.shop_orders o
    join doctors.doctor_registrations source on source.id = o.referral_doctor_id
    where (source.id = v_doctor.id or source.referred_by_partner_id = v_doctor.id)
      and (
        v_scope = 'all'
        or (v_scope = 'direct' and source.id = v_doctor.id)
        or (v_scope = 'referred' and source.referred_by_partner_id = v_doctor.id)
      )
      and doctors.partner_order_matches_status(o.payment_status, o.status, p_status)
      and (p_date_from is null or o.created_at >= p_date_from)
      and (p_date_to is null or o.created_at < p_date_to + interval '1 day')
    order by
      case when lower(coalesce(p_sort, 'newest')) = 'oldest' then o.created_at end asc,
      case when lower(coalesce(p_sort, 'newest')) = 'newest' then o.created_at end desc
    limit v_limit offset v_offset
  ) page;

  return jsonb_build_object(
    'partner', jsonb_build_object(
      'id', v_doctor.id,
      'partner_code', v_doctor.partner_code,
      'full_name', v_doctor.full_name,
      'routing_slug', v_doctor.routing_slug,
      'store_type', v_doctor.store_type,
      'referral_qr_enabled', v_doctor.referral_qr_enabled,
      'main_store_id', v_doctor.main_store_id,
      'promoted_at', v_doctor.promoted_at,
      'promoted_by', v_doctor.promoted_by,
      'joined_at', v_doctor.created_at
    ),
    'clicks', jsonb_build_object(
      'total', (
        select count(*) from doctors.referral_clicks c where c.doctor_id = v_doctor.id
      ),
      'last_30_days', (
        select count(*) from doctors.referral_clicks c
        where c.doctor_id = v_doctor.id and c.created_at >= now() - interval '30 days'
      )
    ),
    'points', (
      SELECT jsonb_build_object(
        'total_all_time', coalesce(sum(p.points), 0),
        'own_points', coalesce(sum(p.points) filter (where p.depth = 0), 0),
        'passup_points', coalesce(sum(p.points) filter (where p.depth = 1), 0),
        'current_cycle', floor(coalesce(sum(p.points), 0) / 1500) + 1,
        'points_in_cycle', coalesce(sum(p.points), 0) % 1500
      )
      FROM doctors.partner_points p
      WHERE p.partner_id = v_doctor.id
    ),
    'rebates', (
      SELECT coalesce(jsonb_agg(
        jsonb_build_object(
          'cycle_number', m.cycle_number,
          'milestone_pts', m.milestone_pts,
          'rebate_amount', m.rebate_amount,
          'status', m.status,
          'created_at', m.created_at
        ) ORDER BY m.created_at DESC
      ), '[]'::jsonb)
      FROM doctors.milestone_unlocks m
      WHERE m.partner_id = v_doctor.id
    ),
    'point_sources', (
      SELECT coalesce(jsonb_agg(
        jsonb_build_object(
          'order_code', coalesce(o.order_code, pp.order_id::text),
          'points', pp.points,
          'depth', pp.depth,
          'source_partner', coalesce(seller.full_name, 'Direct Customer'),
          'source_partner_slug', seller.routing_slug,
          'created_at', pp.created_at
        ) ORDER BY pp.created_at DESC
      ), '[]'::jsonb)
      FROM doctors.partner_points pp
      LEFT JOIN doctors.shop_orders o ON o.id = pp.order_id
      LEFT JOIN doctors.doctor_registrations seller ON seller.id = o.referral_doctor_id
      WHERE pp.partner_id = v_doctor.id
    ),
    'totals', (
      select jsonb_build_object(
        'direct_orders', count(*) filter (where source.id = v_doctor.id),
        'referred_orders', count(*) filter (where source.referred_by_partner_id = v_doctor.id),
        'orders', count(*),
        'paid_orders', count(*) filter (where o.payment_status = 'paid'),
        'direct_paid_amount', coalesce(sum(
          coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0))
        ) filter (where o.payment_status = 'paid' and source.id = v_doctor.id), 0),
        'referred_paid_amount', coalesce(sum(
          coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0))
        ) filter (where o.payment_status = 'paid' and source.referred_by_partner_id = v_doctor.id), 0),
        'paid_amount', coalesce(sum(
          coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0))
        ) filter (where o.payment_status = 'paid'), 0),
        'referred_partners', (
          select count(*) from doctors.doctor_registrations d
          where d.referred_by_partner_id = v_doctor.id
        )
      )
      from doctors.shop_orders o
      join doctors.doctor_registrations source on source.id = o.referral_doctor_id
      where source.id = v_doctor.id or source.referred_by_partner_id = v_doctor.id
    ),
    'orders', v_orders,
    'orders_page', jsonb_build_object(
      'total', v_order_count,
      'limit', v_limit,
      'offset', v_offset,
      'has_more', v_offset + jsonb_array_length(v_orders) < v_order_count
    ),
    'referred_partners', (
      select coalesce(jsonb_agg(entry order by joined_at desc), '[]'::jsonb)
      from (
        select child.created_at as joined_at, jsonb_build_object(
          'full_name', child.full_name,
          'routing_slug', child.routing_slug,
          'specialty', child.specialty,
          'practice_location', child.practice_location,
          'store_type', child.store_type,
          'referral_qr_enabled', child.referral_qr_enabled,
          'joined_at', child.created_at,
          'orders', count(o.id),
          'paid_order_value', coalesce(sum(
            coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0))
          ) filter (where o.payment_status = 'paid'), 0)
        ) as entry
        from doctors.doctor_registrations child
        left join doctors.shop_orders o on o.referral_doctor_id = child.id
        where child.referred_by_partner_id = v_doctor.id
        group by child.id
        order by child.created_at desc
      ) partners
    )
  );
END;
$$;
