const fs = require('fs');
const path = require('path');

const tools =
  'C:/Users/najee/.cursor/projects/c-Users-najee-Projects-GutGuard-Doctors-HTML/agent-tools';
const data = 'C:/Users/najee/Projects/GutGuard-Doctors-HTML/tmp/migrate/data';
const sqlDir = 'C:/Users/najee/Projects/GutGuard-Doctors-HTML/tmp/migrate/sql';
fs.mkdirSync(data, { recursive: true });
fs.mkdirSync(sqlDir, { recursive: true });

function extractFile(file) {
  const raw = JSON.parse(fs.readFileSync(path.join(tools, file), 'utf8'));
  const text = String(raw.result);
  const re =
    /<untrusted-data-[0-9a-f-]+>\r?\n([\s\S]*?)\r?\n<\/untrusted-data-[0-9a-f-]+>/g;
  const matches = [...text.matchAll(re)];
  if (!matches.length) throw new Error('no match ' + file);
  return JSON.parse(matches[matches.length - 1][1]);
}

function unwrap(parsed) {
  if (Array.isArray(parsed) && parsed[0] && parsed[0].data !== undefined) {
    return parsed[0].data;
  }
  return parsed;
}

function save(name, rows) {
  const p = path.join(data, name);
  fs.writeFileSync(p, JSON.stringify(rows));
  console.log(name, Array.isArray(rows) ? rows.length : '?', fs.statSync(p).size);
  return rows;
}

function buildInsert(target, rows, opts = {}) {
  const dollar = 'ggmig';
  const override = opts.overriding ? ' OVERRIDING SYSTEM VALUE' : '';
  let payloadRows = rows;
  if (opts.nullRef) {
    payloadRows = rows.map((r) => ({ ...r, referred_by_partner_id: null }));
  }
  const payload = JSON.stringify(payloadRows);
  let sql =
    'INSERT INTO ' +
    target +
    override +
    '\nSELECT * FROM jsonb_populate_recordset(NULL::' +
    target +
    ', $' +
    dollar +
    '$' +
    payload +
    '$' +
    dollar +
    '$)\nON CONFLICT DO NOTHING;\n';
  if (opts.nullRef) {
    const refs = rows.filter((r) => r.referred_by_partner_id);
    if (refs.length) {
      const refPayload = JSON.stringify(
        refs.map((r) => ({
          id: r.id,
          referred_by_partner_id: r.referred_by_partner_id,
        }))
      );
      sql +=
        'UPDATE doctors.doctor_registrations d SET referred_by_partner_id=(e->>\'referred_by_partner_id\')::uuid FROM jsonb_array_elements($' +
        dollar +
        '$' +
        refPayload +
        '$' +
        dollar +
        '$) e WHERE d.id=(e->>\'id\')::uuid;\n';
    }
  }
  sql += 'SELECT count(*)::int AS c FROM ' + target + ';';
  return sql;
}

const map = {
  '9855ad97-cb4e-4cd8-9fe6-25e46696674d.txt': {
    json: 'public__doctor_registrations.json',
    sql: 'doctors__doctor_registrations.sql',
    target: 'doctors.doctor_registrations',
    nullRef: true,
  },
  'd9de8e07-a77a-40ad-b977-ed9896b8ebb3.txt': {
    json: 'public__newsletter_campaigns.json',
    sql: 'doctors__newsletter_campaigns.sql',
    target: 'doctors.newsletter_campaigns',
  },
  'b88eea12-3e09-460f-8696-6b3a998f77d4.txt': {
    json: 'public__shop_orders.json',
    sql: 'doctors__shop_orders.sql',
    target: 'doctors.shop_orders',
  },
};

for (const [file, cfg] of Object.entries(map)) {
  const rows = save(cfg.json, unwrap(extractFile(file)));
  const sql = buildInsert(cfg.target, rows, {
    nullRef: !!cfg.nullRef,
    overriding: !!cfg.overriding,
  });
  const out = path.join(sqlDir, cfg.sql);
  fs.writeFileSync(out, sql);
  console.log('sql', cfg.sql, fs.statSync(out).size);
}
