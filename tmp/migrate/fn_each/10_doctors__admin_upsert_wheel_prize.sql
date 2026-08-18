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
$function$;