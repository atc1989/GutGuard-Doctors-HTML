const fs = require('fs');
const path = require('path');

const root = 'C:/Users/najee/Projects/GutGuard-Doctors-HTML/tmp/migrate';
const dataDir = path.join(root, 'data');
const sqlDir = path.join(root, 'sql');
const toolsDir =
  'C:/Users/najee/.cursor/projects/c-Users-najee-Projects-GutGuard-Doctors-HTML/agent-tools';

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(sqlDir, { recursive: true });

function extractFromText(text) {
  const m = String(text).match(
    /<untrusted-data-[^>]+>\s*([\s\S]*?)\s*<\/untrusted-data-/
  );
  if (!m) throw new Error('no untrusted-data block');
  return JSON.parse(m[1]);
}

function extractFromMcpFile(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const text = typeof raw.result === 'string' ? raw.result : JSON.stringify(raw);
  return extractFromText(text);
}

function saveJson(name, value) {
  const file = path.join(dataDir, name);
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
  console.log('saved', name, Array.isArray(value) ? value.length : typeof value);
  return file;
}

function buildInsert(targetSchema, table, rows, opts = {}) {
  const dollar = opts.dollar || 'ggmig';
  const override = opts.overriding ? ' OVERRIDING SYSTEM VALUE' : '';
  const conflict = opts.onConflict || 'ON CONFLICT DO NOTHING';
  const payload = JSON.stringify(rows);
  return (
    `INSERT INTO ${targetSchema}.${table}${override}\n` +
    `SELECT * FROM jsonb_populate_recordset(NULL::${targetSchema}.${table}, $${dollar}$${payload}$${dollar}$)\n` +
    `${conflict};`
  );
}

function writeSql(name, sql) {
  const file = path.join(sqlDir, name);
  fs.writeFileSync(file, sql);
  console.log('sql', name, sql.length);
  return file;
}

const cmd = process.argv[2];

if (cmd === 'from-tools') {
  const file = process.argv[3];
  const out = process.argv[4];
  const rows = extractFromMcpFile(path.isAbsolute(file) ? file : path.join(toolsDir, file));
  const data = Array.isArray(rows) && rows[0] && rows[0].data !== undefined ? rows[0].data : rows;
  saveJson(out, data);
} else if (cmd === 'make-insert') {
  const schema = process.argv[3];
  const table = process.argv[4];
  const jsonFile = process.argv[5];
  const sqlName = process.argv[6];
  const overriding = process.argv.includes('--override');
  const rows = JSON.parse(fs.readFileSync(path.join(dataDir, jsonFile), 'utf8'));
  writeSql(sqlName, buildInsert(schema, table, rows, { overriding }));
} else if (cmd === 'list-tools') {
  const files = fs
    .readdirSync(toolsDir)
    .map((f) => ({ f, t: fs.statSync(path.join(toolsDir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t)
    .slice(0, 20);
  for (const x of files) {
    const sz = fs.statSync(path.join(toolsDir, x.f)).size;
    console.log(`${x.f}\t${sz}\t${Math.round((Date.now() - x.t) / 1000)}s`);
  }
} else {
  console.log('usage: from-tools <file> <out.json> | make-insert <schema> <table> <json> <sql> [--override] | list-tools');
}

module.exports = { extractFromText, extractFromMcpFile, saveJson, buildInsert, writeSql, dataDir, sqlDir };
