-- Partner links shortened to 8 characters.
--
-- The full uuid made for an unwieldy printed link. partner_by_key now also accepts the
-- last 8 characters of the id, which is what the QR codes and the portal show; full ids
-- and old routing slugs keep resolving. Everything else already goes through this lookup.

-- One lookup for every public partner link: /r/<key>, /dr/<key> and ?ref=<key> all accept
-- the last 8 characters of the partner id (what the links print), the full id, or the older
-- routing slug. The slug is the partner's name, so it is no longer put on new QR codes, but
-- it keeps resolving because printed codes are already out there.
-- Never grant this to anon/authenticated: it returns the whole row, contact details included.
-- ponytail: sequential scan over a table of partners. Add an index if that ever matters.

-- The LAST 8 characters, not the first: seeded rows share a prefix (4fbb1000-...-0000000N)
-- and differ only in the tail, while the tail of a v4 uuid is fully random. 8 hex characters
-- is 4.3 billion keys, and this index makes a collision impossible rather than merely
-- unlikely - a collision would silently misattribute someone's orders. The cost is that one
-- registration in a few hundred thousand fails and has to be retried; if that ever actually
-- happens, widen the links to 10 characters.
create unique index if not exists doctor_registrations_link_key
  on doctors.doctor_registrations (right(id::text, 8));

create or replace function doctors.partner_by_key(p_key text)
returns setof doctors.doctor_registrations
language sql
stable
security definer
set search_path = doctors, public
as $$
  select d.*
  from doctors.doctor_registrations d
  where nullif(lower(trim(coalesce(p_key, ''))), '') is not null
    and (
      d.routing_slug = lower(trim(p_key))
      or d.id::text = lower(trim(p_key))
      or right(d.id::text, 8) = lower(trim(p_key))
    )
  limit 1;
$$;
