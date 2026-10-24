-- The shop shows "Become a partner" in place of Log in when a visitor came through a partner's
-- shop link, but only if that partner may recruit. Locked = an affiliate whose referral QR is
-- off, the same rule as the share page (SharePage.tsx isReferralLocked).
-- Same function as 20261024000000_partner_codes.sql plus can_refer. Return type changes need a
-- drop. Used by both deployments: the sandbox site reads partners through `doctors` too.

drop function if exists doctors.get_partner_invitation(text);

create function doctors.get_partner_invitation(p_slug text)
returns table (routing_slug text, full_name text, link_key text, partner_code integer, can_refer boolean)
language sql
stable
security definer
set search_path = doctors, public
as $$
  select d.routing_slug, d.full_name, right(d.id::text, 5), d.partner_code,
    d.store_type <> 'affiliate' or d.referral_qr_enabled
  from doctors.partner_by_key(p_slug) d;
$$;

grant execute on function doctors.get_partner_invitation(text) to anon, authenticated;
