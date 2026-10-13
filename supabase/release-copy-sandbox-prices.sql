-- ONE-OFF release step (not a migration): copy the boss-approved shop prices from the
-- sandbox mirror into production. Run in the production SQL editor (GutGuard Life Style)
-- AFTER the boss confirms sandbox.gutguard.ph, BEFORE or right after merging sandbox -> main.
--
-- Safe before the merge: the production site on `main` does not read doctors.products or
-- doctors.promos yet, so customers see no change until the new code deploys.
--
-- Copies what sandbox has at the moment it runs:
--   * products: every product id that exists in both schemas (price, per-cap, caps, labels, status,
--               dosage line and "What's included" - needs migration 20261013000000_product_details)
--   * promos:   "Holiday Promo" and "Standard discount" only, matched by name
--               (any test promos created on sandbox are NOT copied)

begin;

update doctors.products d
set name = s.name,
    phase = s.phase,
    days = s.days,
    caps = s.caps,
    price = s.price,
    per_cap_price = s.per_cap_price,
    tag = s.tag,
    image = s.image,
    sort_order = s.sort_order,
    status = s.status,
    dosage = s.dosage,
    includes = s.includes,
    includes_note = s.includes_note,
    updated_at = now()
from sandbox.products s
where d.id = s.id;

update doctors.promos d
set label = s.label,
    starts_on = s.starts_on,
    ends_on = s.ends_on,
    enabled = s.enabled,
    discounts = s.discounts,
    prices = s.prices,
    per_cap = s.per_cap,
    updated_at = now()
from sandbox.promos s
where d.name = s.name
  and d.name in ('Holiday Promo', 'Standard discount');

commit;

-- Check: every row should say "same". "is not distinct from" so a null (e.g. no end date)
-- counts as equal - a plain "=" made "Standard discount" read DIFFERENT when it was the same.
select 'product ' || d.id as row,
       case when (d.price, d.per_cap_price, d.caps, d.status, d.name, d.phase, d.tag, d.dosage, d.includes, d.includes_note)
               is not distinct from (s.price, s.per_cap_price, s.caps, s.status, s.name, s.phase, s.tag, s.dosage, s.includes, s.includes_note)
            then 'same' else 'DIFFERENT' end as result
from doctors.products d join sandbox.products s using (id)
union all
select 'promo ' || d.name,
       case when (d.enabled, d.label, d.starts_on, d.ends_on, d.discounts, d.prices, d.per_cap)
               is not distinct from (s.enabled, s.label, s.starts_on, s.ends_on, s.discounts, s.prices, s.per_cap)
            then 'same' else 'DIFFERENT' end
from doctors.promos d join sandbox.promos s using (name)
where d.name in ('Holiday Promo', 'Standard discount')
order by 1;
