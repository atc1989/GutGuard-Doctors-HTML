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
$function$;