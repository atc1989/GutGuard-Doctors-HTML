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
  if (!res.ok) throw new Error(fn + ' ' + res.status + ' ' + text.slice(0, 800));
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function main() {
  const campaigns = JSON.parse(
    fs.readFileSync(path.join(dataDir, 'public__newsletter_campaigns.json'), 'utf8')
  );
  // Step templates also live as newsletter campaigns; prefer dedicated html files if present.
  const htmlFiles = {
    '3d8b68aa-8902-4999-b1a0-4baac5138b47': 'step_1_html.txt',
    '68ae97f6-9006-45ef-b23d-0d85b53f62c9': 'step_2_html.txt',
    'e8eb0703-0113-4b49-8f77-b80989b515b7': 'step_3_html.txt',
  };

  for (const [id, file] of Object.entries(htmlFiles)) {
    const p = path.join(dataDir, file);
    if (!fs.existsSync(p)) {
      console.log('missing html', file);
      continue;
    }
    const html = fs.readFileSync(p, 'utf8');
    await rpc('gg_mig_update_email_step', {
      p_id: id,
      p_html: html,
      p_attachments: null,
    });
    console.log('updated html', id, html.length);
  }

  const attachments = [];
  for (let i = 0; i < 6; i++) {
    const a = JSON.parse(
      fs.readFileSync(path.join(dataDir, 'step_1_att_' + i + '.json'), 'utf8')
    );
    attachments.push({
      filename: a.filename,
      content_type: a.content_type,
      size: a.size,
      content: a.content,
    });
  }

  await rpc('gg_mig_update_email_step', {
    p_id: '3d8b68aa-8902-4999-b1a0-4baac5138b47',
    p_html: null,
    p_attachments: attachments,
  });
  console.log('updated attachments', attachments.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
