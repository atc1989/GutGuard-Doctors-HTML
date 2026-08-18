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
$function$;