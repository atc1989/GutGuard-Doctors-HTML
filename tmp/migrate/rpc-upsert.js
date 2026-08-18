const fs = require('fs');
const path = require('path');

const dataDir = 'C:/Users/najee/Projects/GutGuard-Doctors-HTML/tmp/migrate/data';
const targetUrl = 'https://rvwseybgimmewuoccecu.supabase.co';

function loadEnv(file) {
  const text = fs.readFileSync(file, 'utf8');
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^"|"$/g, '');
  }
  return out;
}

const env = loadEnv('C:/Users/najee/Projects/GutGuard-Daily/.env.local');
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) throw new Error('missing service role');

async function rpc(fn, args) {
  const res = await fetch(targetUrl + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(fn + ' ' + res.status + ' ' + text.slice(0, 500));
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function migInsert(schema, table, rows, chunkSize = 25) {
  let last = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    last = await rpc('gg_mig_insert', {
      p_schema: schema,
      p_table: table,
      p_rows: chunk,
    });
    console.log(schema + '.' + table, 'chunk', i, '->', last);
  }
  return last;
}

async function main() {
  const docs = JSON.parse(
    fs.readFileSync(path.join(dataDir, 'public__doctor_registrations.json'), 'utf8')
  );
  const nulled = docs.map((r) => ({ ...r, referred_by_partner_id: null }));
  await migInsert('doctors', 'doctor_registrations', nulled, 25);
  const refs = docs
    .filter((r) => r.referred_by_partner_id)
    .map((r) => ({ id: r.id, referred_by_partner_id: r.referred_by_partner_id }));
  if (refs.length) {
    const withRef = await rpc('gg_mig_patch_doctor_refs', { p_refs: refs });
    console.log('patched refs ->', withRef);
  }

  const news = JSON.parse(
    fs.readFileSync(path.join(dataDir, 'public__newsletter_campaigns.json'), 'utf8')
  );
  await migInsert('doctors', 'newsletter_campaigns', news, 3);

  const shops = JSON.parse(
    fs.readFileSync(path.join(dataDir, 'public__shop_orders.json'), 'utf8')
  );
  await migInsert('doctors', 'shop_orders', shops, 10);

  console.log('phase1 done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
