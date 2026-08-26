alter table doctors.email_sequence_sends
  alter column step_id drop not null;

alter table doctors.email_sequence_sends
  drop constraint if exists email_sequence_sends_step_id_fkey;

alter table doctors.email_sequence_sends
  add constraint email_sequence_sends_step_id_fkey
  foreign key (step_id)
  references doctors.email_sequence_steps(id)
  on delete set null;
