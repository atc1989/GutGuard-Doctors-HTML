CREATE OR REPLACE FUNCTION doctors.list_wheel_prizes()
 RETURNS TABLE(id uuid, label text, note text, color text, text_color text, chance_weight integer, total_stock integer, remaining_stock integer, is_active boolean, sort_order integer, claim_count bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
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
  where p.is_active = true
    and p.chance_weight > 0
    and p.remaining_stock > 0
  order by p.sort_order, p.created_at;
$function$;