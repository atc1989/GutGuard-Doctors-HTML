const fs = require('fs');
const path = require('path');

const dir = 'C:/Users/najee/Projects/GutGuard-Doctors-HTML/tmp/migrate/data';

function extractFromMcpText(text) {
  const m = String(text).match(/<untrusted-data-[^>]+>\s*([\s\S]*?)\s*<\/untrusted-data-/);
  if (!m) throw new Error('no untrusted-data block');
  return JSON.parse(m[1]);
}

function extractFromMcpFile(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const text = typeof raw.result === 'string' ? raw.result : JSON.stringify(raw);
  return extractFromMcpText(text);
}

function saveTable(schemaTable, rows) {
  const file = path.join(dir, schemaTable.replace('.', '__') + '.json');
  fs.writeFileSync(file, JSON.stringify(rows, null, 2));
  console.log('saved', file, Array.isArray(rows) ? rows.length : typeof rows);
  return file;
}

function buildInsert(targetSchema, table, rows, opts = {}) {
  const dollar = opts.dollar || 'ggmig';
  const payload = JSON.stringify(rows);
  const conflict = opts.onConflict || 'ON CONFLICT DO NOTHING';
  return (
    `INSERT INTO ${targetSchema}.${table}\n` +
    `SELECT * FROM jsonb_populate_recordset(NULL::${targetSchema}.${table}, $${dollar}$${payload}$${dollar}$)\n` +
    `${conflict};`
  );
}

module.exports = { extractFromMcpText, extractFromMcpFile, saveTable, buildInsert, dir };
