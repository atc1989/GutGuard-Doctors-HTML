const fs = require('fs');
const path = require('path');

const dataDir = 'C:/Users/najee/Projects/GutGuard-Doctors-HTML/tmp/migrate/data';
const tools =
  'C:/Users/najee/.cursor/projects/c-Users-najee-Projects-GutGuard-Doctors-HTML/agent-tools';
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

function extractFile(file) {
  const raw = JSON.parse(fs.readFileSync(path.join(tools, file), 'utf8'));
  const text = String(raw.result);
  const re =
    /<untrusted-data-[0-9a-f-]+>\r?\n([\s\S]*?)\r?\n<\/untrusted-data-[0-9a-f-]+>/g;
  const matches = [...text.matchAll(re)];
  if (!matches.length) throw new Error('no match ' + file);
  const parsed = JSON.parse(matches[matches.length - 1][1]);
  if (Array.isArray(parsed) && parsed[0] && parsed[0].data !== undefined) {
    return parsed[0].data;
  }
  return parsed;
}

const env = loadEnv('C:/Users/najee/Projects/GutGuard-Daily/.env.local');
const key = env.SUPABASE_SERVICE_ROLE_KEY;

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

async function migInsert(schema, table, rows, chunkSize = 20) {
  let last = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    last = await rpc('gg_mig_insert', {
      p_schema: schema,
      p_table: table,
      p_rows: chunk,
    });
    console.log(schema + '.' + table, i, '->', last);
  }
  return last;
}

async function main() {
  // newsletters + shops from saved json
  await migInsert(
    'doctors',
    'newsletter_campaigns',
    JSON.parse(fs.readFileSync(path.join(dataDir, 'public__newsletter_campaigns.json'), 'utf8')),
    3
  );
  await migInsert(
    'doctors',
    'shop_orders',
    JSON.parse(fs.readFileSync(path.join(dataDir, 'public__shop_orders.json'), 'utf8')),
    10
  );

  // export remaining tables via listing newest agent-tools if present; otherwise expect files
  const jobs = [
    ['doctors', 'wheel_claims', 'public__wheel_claims.json'],
    ['doctors', 'doctor_sequence_enrollments', 'public__doctor_sequence_enrollments.json'],
    ['doctors', 'email_sequence_sends', 'public__email_sequence_sends.json'],
    ['doctors', 'newsletter_sends', 'public__newsletter_sends.json'],
    ['doctors', 'registration_email_sends', 'public__registration_email_sends.json'],
    ['doctors', 'shop_order_email_sends', 'public__shop_order_email_sends.json'],
    ['doctors', 'referral_clicks', 'public__referral_clicks.json'],
    ['sandbox', 'shop_orders', 'sandbox__shop_orders.json'],
    ['sandbox', 'referral_clicks', 'sandbox__referral_clicks.json'],
  ];

  for (const [schema, table, file] of jobs) {
    const p = path.join(dataDir, file);
    if (!fs.existsSync(p)) {
      console.log('SKIP missing', file);
      continue;
    }
    const rows = JSON.parse(fs.readFileSync(p, 'utf8'));
    await migInsert(schema, table, rows, 20);
  }
  console.log('phase2 done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
