const fs = require('fs');
const path = require('path');
const dataDir = 'C:/Users/najee/Projects/GutGuard-Doctors-HTML/tmp/migrate/data';
fs.mkdirSync(dataDir, { recursive: true });

function extract(text) {
  const m = String(text).match(/<untrusted-data-[^>]+>\s*([\s\S]*?)\s*<\/untrusted-data-/);
  if (!m) throw new Error('no block in input');
  return JSON.parse(m[1]);
}

const infile = process.argv[2];
const outname = process.argv[3];
const raw = fs.readFileSync(infile, 'utf8');
let parsed;
try {
  const j = JSON.parse(raw);
  parsed = extract(typeof j.result === 'string' ? j.result : raw);
} catch {
  parsed = extract(raw);
}
const data = Array.isArray(parsed) && parsed[0] && Object.prototype.hasOwnProperty.call(parsed[0], 'data')
  ? parsed[0].data
  : parsed;
const out = path.join(dataDir, outname);
fs.writeFileSync(out, JSON.stringify(data));
console.log(JSON.stringify({ out, rows: Array.isArray(data) ? data.length : null, bytes: fs.statSync(out).size }));
