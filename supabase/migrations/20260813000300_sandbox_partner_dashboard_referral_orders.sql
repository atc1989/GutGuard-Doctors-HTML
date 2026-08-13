-- Sandbox parity for the production partner dashboard. Registrations are shared in
-- public; clicks and orders remain isolated in sandbox.
drop function if exists sandbox.partner_dashboard();
drop function if exists sandbox.partner_dashboard(text, text, integer, integer);
drop function if exists sandbox.partner_dashboard(text,text,integer,integer,timestamptz,timestamptz,text);

create function sandbox.partner_dashboard(
  p_scope text default 'all', p_status text default null,
  p_limit integer default 25, p_offset integer default 0,
  p_date_from timestamptz default null, p_date_to timestamptz default null, p_sort text default 'newest'
) returns jsonb language plpgsql stable security definer set search_path = sandbox, public as $$
declare
  v_email text; v_doctor public.doctor_registrations;
  v_scope text := lower(trim(coalesce(p_scope, 'all')));
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_order_count bigint; v_orders jsonb;
begin
  if v_scope not in ('all', 'direct', 'referred') then raise exception 'Invalid order scope.' using errcode = '22023'; end if;
  if lower(coalesce(p_sort,'newest')) not in ('newest','oldest') then raise exception 'Invalid order sort.' using errcode='22023'; end if;
  v_email := nullif(lower(trim(coalesce(auth.jwt() ->> 'email', ''))), '');
  if v_email is null then raise exception 'Sign in to view your dashboard.' using errcode = '42501'; end if;
  select * into v_doctor from public.doctor_registrations where email = v_email limit 1;
  if v_doctor.id is null then raise exception 'This email is not registered as a GutGuard partner.' using errcode = '42501'; end if;

  select count(*) into v_order_count from sandbox.shop_orders o
  join public.doctor_registrations source on source.id = o.referral_doctor_id
  where (source.id = v_doctor.id or source.referred_by_partner_id = v_doctor.id)
    and (v_scope = 'all' or (v_scope = 'direct' and source.id = v_doctor.id) or (v_scope = 'referred' and source.referred_by_partner_id = v_doctor.id))
    and (nullif(lower(trim(coalesce(p_status, ''))), '') is null or lower(o.payment_status) = lower(trim(p_status)) or lower(o.status) = lower(trim(p_status)))
    and (p_date_from is null or o.created_at>=p_date_from) and (p_date_to is null or o.created_at<p_date_to+interval '1 day');

  select coalesce(jsonb_agg(entry order by
    case when lower(coalesce(p_sort,'newest'))='oldest' then sort_at end asc,
    case when lower(coalesce(p_sort,'newest'))='newest' then sort_at end desc),'[]'::jsonb) into v_orders from (
    select o.created_at sort_at, jsonb_build_object(
      'order_code', o.order_code, 'created_at', o.created_at, 'status', o.status,
      'payment_status', o.payment_status, 'total_amount', coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0)),
      'buyer_first_name', coalesce(o.first_name, split_part(o.customer_name, ' ', 1)), 'city', o.city, 'province', o.province,
      'source_type', case when source.id = v_doctor.id then 'direct' else 'referred' end,
      'source_partner_name', source.full_name, 'source_partner_slug', source.routing_slug) entry
    from sandbox.shop_orders o join public.doctor_registrations source on source.id = o.referral_doctor_id
    where (source.id = v_doctor.id or source.referred_by_partner_id = v_doctor.id)
      and (v_scope = 'all' or (v_scope = 'direct' and source.id = v_doctor.id) or (v_scope = 'referred' and source.referred_by_partner_id = v_doctor.id))
      and (nullif(lower(trim(coalesce(p_status, ''))), '') is null or lower(o.payment_status) = lower(trim(p_status)) or lower(o.status) = lower(trim(p_status)))
      and (p_date_from is null or o.created_at>=p_date_from) and (p_date_to is null or o.created_at<p_date_to+interval '1 day')
    order by case when lower(coalesce(p_sort,'newest'))='oldest' then o.created_at end asc,
      case when lower(coalesce(p_sort,'newest'))='newest' then o.created_at end desc limit v_limit offset v_offset
  ) page;

  return jsonb_build_object(
    'partner', jsonb_build_object('full_name', v_doctor.full_name, 'routing_slug', v_doctor.routing_slug, 'joined_at', v_doctor.created_at),
    'clicks', jsonb_build_object('total', (select count(*) from sandbox.referral_clicks c where c.doctor_id = v_doctor.id),
      'last_30_days', (select count(*) from sandbox.referral_clicks c where c.doctor_id = v_doctor.id and c.created_at >= now() - interval '30 days')),
    'totals', (select jsonb_build_object(
      'direct_orders', count(*) filter (where source.id = v_doctor.id),
      'referred_orders', count(*) filter (where source.referred_by_partner_id = v_doctor.id), 'orders', count(*),
      'paid_orders', count(*) filter (where o.payment_status = 'paid'),
      'direct_paid_amount', coalesce(sum(coalesce(nullif(o.total_amount,0),o.subtotal+coalesce(o.shipping_fee,0))) filter (where o.payment_status='paid' and source.id=v_doctor.id),0),
      'referred_paid_amount', coalesce(sum(coalesce(nullif(o.total_amount,0),o.subtotal+coalesce(o.shipping_fee,0))) filter (where o.payment_status='paid' and source.referred_by_partner_id=v_doctor.id),0),
      'paid_amount', coalesce(sum(coalesce(nullif(o.total_amount,0),o.subtotal+coalesce(o.shipping_fee,0))) filter (where o.payment_status='paid'),0),
      'referred_partners', (select count(*) from public.doctor_registrations d where d.referred_by_partner_id=v_doctor.id))
      from sandbox.shop_orders o join public.doctor_registrations source on source.id=o.referral_doctor_id
      where source.id=v_doctor.id or source.referred_by_partner_id=v_doctor.id),
    'orders', v_orders,
    'orders_page', jsonb_build_object('total',v_order_count,'limit',v_limit,'offset',v_offset,'has_more',v_offset+jsonb_array_length(v_orders)<v_order_count),
    'referred_partners', (select coalesce(jsonb_agg(entry order by joined_at desc),'[]'::jsonb) from (
      select child.created_at joined_at, jsonb_build_object('full_name',child.full_name,'routing_slug',child.routing_slug,
        'specialty',child.specialty,'practice_location',child.practice_location,'joined_at',child.created_at,'orders',count(o.id),
        'paid_order_value',coalesce(sum(coalesce(nullif(o.total_amount,0),o.subtotal+coalesce(o.shipping_fee,0))) filter(where o.payment_status='paid'),0)) entry
      from public.doctor_registrations child left join sandbox.shop_orders o on o.referral_doctor_id=child.id
      where child.referred_by_partner_id=v_doctor.id group by child.id order by child.created_at desc) partners)
  );
end;
$$;
revoke all on function sandbox.partner_dashboard(text,text,integer,integer,timestamptz,timestamptz,text) from public, anon;
grant execute on function sandbox.partner_dashboard(text,text,integer,integer,timestamptz,timestamptz,text) to authenticated;
