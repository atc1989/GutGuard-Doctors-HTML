-- SANDBOX ONLY. Gives one partner a PHP 18,000 test rebate in sandbox.milestone_unlocks so the
-- wallet on sandbox.gutguard.ph has a balance to withdraw (nothing credits rebates yet).
-- Run after 20261030000000_partner_wallet.sql. Replace the email with the test partner's.
-- Cycle 0 never collides with a real milestone (cycles start at 1).

insert into sandbox.milestone_unlocks (partner_id, cycle_number, milestone_pts, rebate_amount, status)
select d.id, 0, 300, 18000, 'unlocked'
from doctors.doctor_registrations d
where d.email = lower('PARTNER_EMAIL_HERE')
on conflict (partner_id, cycle_number, milestone_pts) do nothing;

-- To remove it (and that partner's sandbox withdrawals) after testing:
-- delete from sandbox.partner_withdrawals where partner_id = (select id from doctors.doctor_registrations where email = lower('PARTNER_EMAIL_HERE'));
-- delete from sandbox.milestone_unlocks where cycle_number = 0 and partner_id = (select id from doctors.doctor_registrations where email = lower('PARTNER_EMAIL_HERE'));
