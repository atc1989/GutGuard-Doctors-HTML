const fs = require('fs');
const path = require('path');

const dataDir = 'C:/Users/najee/Projects/GutGuard-Doctors-HTML/tmp/migrate/data';
const sqlDir = 'C:/Users/najee/Projects/GutGuard-Doctors-HTML/tmp/migrate/sql/batches';
fs.mkdirSync(sqlDir, { recursive: true });

function buildInsert(target, rows) {
  const dollar = 'ggmig';
  const payload = JSON.stringify(rows);
  return (
    'INSERT INTO ' +
    target +
    '\nSELECT * FROM jsonb_populate_recordset(NULL::' +
    target +
    ', $' +
    dollar +
    '$' +
    payload +
    '$' +
    dollar +
    '$)\nON CONFLICT DO NOTHING;'
  );
}

const docs = JSON.parse(
  fs.readFileSync(path.join(dataDir, 'public__doctor_registrations.json'), 'utf8')
);
const nulled = docs.map((r) => ({ ...r, referred_by_partner_id: null }));
const batchSize = 15;
let n = 0;
for (let i = 0; i < nulled.length; i += batchSize) {
  const chunk = nulled.slice(i, i + batchSize);
  const name = 'docs_' + String(n).padStart(2, '0') + '.sql';
  fs.writeFileSync(path.join(sqlDir, name), buildInsert('doctors.doctor_registrations', chunk));
  console.log(name, chunk.length, fs.statSync(path.join(sqlDir, name)).size);
  n++;
}
const refs = docs
  .filter((r) => r.referred_by_partner_id)
  .map((r) => ({ id: r.id, referred_by_partner_id: r.referred_by_partner_id }));
fs.writeFileSync(
  path.join(sqlDir, 'docs_refs.sql'),
  "UPDATE doctors.doctor_registrations d SET referred_by_partner_id=(e->>'referred_by_partner_id')::uuid FROM jsonb_array_elements($ggmig$" +
    JSON.stringify(refs) +
    "$ggmig$) e WHERE d.id=(e->>'id')::uuid; SELECT count(*) FILTER (WHERE referred_by_partner_id IS NOT NULL)::int AS with_ref, count(*)::int AS total FROM doctors.doctor_registrations;"
);

const news = JSON.parse(
  fs.readFileSync(path.join(dataDir, 'public__newsletter_campaigns.json'), 'utf8')
);
fs.writeFileSync(
  path.join(sqlDir, 'newsletters.sql'),
  buildInsert('doctors.newsletter_campaigns', news) +
    '\nSELECT count(*)::int AS c FROM doctors.newsletter_campaigns;'
);

const shops = JSON.parse(
  fs.readFileSync(path.join(dataDir, 'public__shop_orders.json'), 'utf8')
);
for (let i = 0, b = 0; i < shops.length; i += 10, b++) {
  const chunk = shops.slice(i, i + 10);
  const name = 'shops_' + String(b).padStart(2, '0') + '.sql';
  fs.writeFileSync(path.join(sqlDir, name), buildInsert('doctors.shop_orders', chunk));
  console.log(name, chunk.length, fs.statSync(path.join(sqlDir, name)).size);
}

console.log('done batches', n, 'news', news.length, 'shops', shops.length);
