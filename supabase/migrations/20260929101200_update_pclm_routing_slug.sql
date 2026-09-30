-- Update Mr. PCLM partner invite slug to 'icsps'
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'doctor_registrations') then
    update public.doctor_registrations
    set routing_slug = 'icsps'
    where lower(email) = 'atcconelwenxyn@gmail.com'
       or lower(full_name) like '%pclm%';
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'doctors' and table_name = 'doctor_registrations') then
    update doctors.doctor_registrations
    set routing_slug = 'icsps'
    where lower(email) = 'atcconelwenxyn@gmail.com'
       or lower(full_name) like '%pclm%';
  end if;
end $$;
