/**
 * Build INSERT SQL for doctors.doctor_registrations from a JSON array file.
 * Usage: node build-insert.js <input.json> <output.sql> [schema.table]
 */
const fs = require('fs');
const inFile = process.argv[2];
const outFile = process.argv[3];
const target = process.argv[4] || 'doctors.doctor_registrations';
const rows = JSON.parse(fs.readFileSync(inFile, 'utf8'));
const payload = JSON.stringify(rows);
const sql =
  `INSERT INTO ${target}\n` +
  `SELECT * FROM jsonb_populate_recordset(NULL::${target}, $ggmig$${payload}$ggmig$)\n` +
  `ON CONFLICT DO NOTHING;\n` +
  `SELECT count(*)::int AS c FROM ${target};`;
fs.writeFileSync(outFile, sql);
console.log(JSON.stringify({ rows: rows.length, sqlBytes: Buffer.byteLength(sql), outFile }));
