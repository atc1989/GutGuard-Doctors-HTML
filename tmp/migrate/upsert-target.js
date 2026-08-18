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
if (!key) throw new Error('missing target service role key');

async function upsert(schema, table, rows, onConflict) {
  const headers = {
    apikey: key,
    Authorization: 'Bearer ' + key,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=minimal',
    'Accept-Profile': schema,
    'Content-Profile': schema,
  };
  // PostgREST upsert in chunks
  const chunkSize = 20;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const url =
      targetUrl +
      '/rest/v1/' +
      table +
      (onConflict ? '?on_conflict=' + encodeURIComponent(onConflict) : '');
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(chunk),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(schema + '.' + table + ' chunk ' + i + ' HTTP ' + res.status + ' ' + text.slice(0, 500));
    }
    inserted += chunk.length;
  }
  return inserted;
}

async function sqlRpc(query) {
  // fallback via MCP only; not used here
  throw new Error('sqlRpc not configured');
}

async function main() {
  const jobs = [
    {
      schema: 'doctors',
      table: 'doctor_registrations',
      file: 'public__doctor_registrations.json',
      onConflict: 'id',
      transform: (rows) =>
        rows.map((r) => ({ ...r, referred_by_partner_id: null })),
      afterRefs: true,
    },
    {
      schema: 'doctors',
      table: 'newsletter_campaigns',
      file: 'public__newsletter_campaigns.json',
      onConflict: 'id',
    },
  ];

  for (const job of jobs) {
    let rows = JSON.parse(fs.readFileSync(path.join(dataDir, job.file), 'utf8'));
    const original = rows;
    if (job.transform) rows = job.transform(rows);
    const n = await upsert(job.schema, job.table, rows, job.onConflict);
    console.log('upserted', job.schema + '.' + job.table, n);
    if (job.afterRefs) {
      const refs = original
        .filter((r) => r.referred_by_partner_id)
        .map((r) => ({
          id: r.id,
          referred_by_partner_id: r.referred_by_partner_id,
        }));
      if (refs.length) {
        // patch one by one
        for (const ref of refs) {
          const url = targetUrl + '/rest/v1/doctor_registrations?id=eq.' + ref.id;
          const res = await fetch(url, {
            method: 'PATCH',
            headers: {
              apikey: key,
              Authorization: 'Bearer ' + key,
              'Content-Type': 'application/json',
              Prefer: 'return=minimal',
              'Accept-Profile': 'doctors',
              'Content-Profile': 'doctors',
            },
            body: JSON.stringify({
              referred_by_partner_id: ref.referred_by_partner_id,
            }),
          });
          const text = await res.text();
          if (!res.ok) {
            throw new Error('patch ref ' + ref.id + ' ' + res.status + ' ' + text.slice(0, 300));
          }
        }
        console.log('patched refs', refs.length);
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
