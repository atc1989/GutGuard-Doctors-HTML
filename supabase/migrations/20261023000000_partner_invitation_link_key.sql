-- Referral QR codes now print the partner's 5-character link key instead of their name.
-- Old name links (www.gutguard.ph/<NAME>) still resolve, and app/[slug]/route.ts redirects
-- them to the key URL - for that it needs the key, so the invitation lookup returns it.
-- The key is not sensitive: it is what the QR codes print.

drop function if exists doctors.get_partner_invitation(text);

create or replace function doctors.get_partner_invitation(p_slug text)
returns table (routing_slug text, full_name text, link_key text)
language sql
stable
security definer
set search_path = doctors, public
as $$
  select d.routing_slug, d.full_name, right(d.id::text, 5) from doctors.partner_by_key(p_slug) d;
$$;

grant execute on function doctors.get_partner_invitation(text) to anon, authenticated;
