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

const newsletter_sends = [
  {
    id: '1a723b4a-b28c-4b9c-8af2-d353e2f6d5b6',
    email: 'nmapantas_2022000461@uic.edu.ph',
    status: 'sent',
    sent_at: '2026-06-12T07:27:02.04316+00:00',
    subject: 'sample upload newsletter',
    doctor_id: null,
    resend_id: '8f4ccde6-b7b8-4846-bcc8-6c4947bd63dd',
    error_message: null,
    newsletter_id: '7198ddcd-2195-40fb-9bf4-7d0e392a85dc',
  },
  {
    id: '356e0ab1-b902-4d99-b812-7c5b4e9d34f8',
    email: 'atcoriginalemail@gmail.com',
    status: 'sent',
    sent_at: '2026-06-12T07:27:02.458972+00:00',
    subject: 'sample upload newsletter',
    doctor_id: null,
    resend_id: '1517d392-28b1-4d20-a51c-fdab032e7922',
    error_message: null,
    newsletter_id: '7198ddcd-2195-40fb-9bf4-7d0e392a85dc',
  },
  {
    id: '4d1c086f-5f35-4b2b-af68-7bcfc3325d95',
    email: 'atcoriginalemail@gmail.com',
    status: 'sent',
    sent_at: '2026-06-08T14:09:57.368913+00:00',
    subject: 'GutGuard Doctors Newsletter',
    doctor_id: null,
    resend_id: '13abac3d-1da3-46cb-912b-37578f896d04',
    error_message: null,
    newsletter_id: null,
  },
  {
    id: '599d1b4a-80e6-4c6b-863c-034accae6442',
    email: 'nmapantas_2022000461@uic.edu.ph',
    status: 'sent',
    sent_at: '2026-06-12T06:38:13.771438+00:00',
    subject: 'GutGuard Doctors Newsletter',
    doctor_id: null,
    resend_id: 'bb142dbe-af43-4a38-b066-bd4bb7325424',
    error_message: null,
    newsletter_id: null,
  },
  {
    id: '5dfddf75-a673-4bda-9240-255512f7d22d',
    email: 'najeebmapantas21@gmail.com',
    status: 'sent',
    sent_at: '2026-06-19T17:04:54.788363+00:00',
    subject: 'sample upload newsletter',
    doctor_id: null,
    resend_id: '8a2c705b-216f-4ffb-8d3a-32453293319e',
    error_message: null,
    newsletter_id: '87cb905c-e8e9-48d3-b914-2897a858bff5',
  },
  {
    id: '609fae0e-b192-4de9-bde3-66e648523d60',
    email: 'kylejurg1@gmail.com',
    status: 'sent',
    sent_at: '2026-06-11T05:53:34.048691+00:00',
    subject: 'GutGuard Doctors Newsletter',
    doctor_id: '4e480985-3fc7-45ad-a292-96dae6e64d1d',
    resend_id: '64697431-0a4d-48a6-98eb-6160d0157048',
    error_message: null,
    newsletter_id: null,
  },
  {
    id: '76d4dfc4-ef8a-4ba4-aca3-78eaf7ab6296',
    email: 'atcoriginalemail@gmail.com',
    status: 'sent',
    sent_at: '2026-06-12T06:38:14.175541+00:00',
    subject: 'GutGuard Doctors Newsletter',
    doctor_id: null,
    resend_id: '3b3b1d79-8573-4b3b-972b-d3e3c0c2edbe',
    error_message: null,
    newsletter_id: null,
  },
  {
    id: '835ecb94-fd14-463d-99b1-fa0b0a76e09c',
    email: 'nmapantas_2022000461@uic.edu.ph',
    status: 'sent',
    sent_at: '2026-06-12T06:49:02.327909+00:00',
    subject: 'GutGuard Doctors Newsletter',
    doctor_id: null,
    resend_id: 'ce160e42-9321-4625-a18b-7004eef7341a',
    error_message: null,
    newsletter_id: null,
  },
  {
    id: 'b94ac23f-95ce-414d-91e4-bb264aa2aa53',
    email: 'nmapantas_2022000461@uic.edu.ph',
    status: 'sent',
    sent_at: '2026-06-08T14:09:56.9347+00:00',
    subject: 'GutGuard Doctors Newsletter',
    doctor_id: null,
    resend_id: '3a690b4f-61e9-40fb-8168-a30e5df1edee',
    error_message: null,
    newsletter_id: null,
  },
  {
    id: 'be5c1e99-9a60-4d07-8c24-56fa72431701',
    email: 'atcoriginalemail@gmail.com',
    status: 'sent',
    sent_at: '2026-06-12T06:49:02.798217+00:00',
    subject: 'GutGuard Doctors Newsletter',
    doctor_id: null,
    resend_id: '266e45c7-0d94-4123-98cd-d66f95efd177',
    error_message: null,
    newsletter_id: null,
  },
];

const shop_order_email_sends = [
  {
    id: 'ad60f1fa-c43f-4427-ab67-114f4d21696b',
    email: 'jndlonsod@gmail.com',
    status: 'sent',
    sent_at: '2026-08-09T04:34:08.444262+00:00',
    subject: 'We received your GutGuard order GG-20260809-610DC19E',
    order_id: '2c5fdf99-650e-4e71-8e2b-d93571d0da37',
    resend_id: '9e5d778d-9ec2-4e2f-b384-c2f17efcece9',
    error_message: null,
  },
  {
    id: 'c2454da5-b30c-445b-91e1-de987980d50d',
    email: 'jndlonsod@gmail.com',
    status: 'sent',
    sent_at: '2026-08-12T12:02:54.589308+00:00',
    subject: 'We received your GutGuard order GG-20260812-8989A2C6',
    order_id: '22d82d8d-509d-4f1f-a267-21b331e2cba4',
    resend_id: 'c36b9152-e120-4e51-95e2-738331d7d814',
    error_message: null,
  },
  {
    id: 'ef3ee6d1-70c6-462f-b367-020d46fa9fc0',
    email: 'najeebmapantas21@gmail.com',
    status: 'sent',
    sent_at: '2026-08-08T16:08:09.026286+00:00',
    subject: 'We received your GutGuard order GG-20260808-7977B937',
    order_id: 'a75de5a8-c7c3-4a0e-bc3b-c9de3d921e7f',
    resend_id: '5abaa073-ea21-4ece-bbf2-6c9186414c3a',
    error_message: null,
  },
  {
    id: 'f4e43f70-b5e8-435b-8dbc-d16cc1dc85b2',
    email: 'jndlonsod@gmail.com',
    status: 'sent',
    sent_at: '2026-08-13T09:25:09.51198+00:00',
    subject: 'We received your GutGuard order GG-20260813-D95D625E',
    order_id: 'cbdabc79-934b-490f-a453-919c9661c536',
    resend_id: '6b97bb49-921a-488f-9882-9e6c0f8a79ed',
    error_message: null,
  },
];

const sandbox_referral_clicks = [
  {
    id: '081ac8a3-31c9-e4d4-56e8-fbbed9017f0a',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-06-30T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: '0b367a94-0b16-3b4d-056b-463f5f1b0ca4',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-07-12T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: '224557cb-a508-c4b2-c025-a1700e395a3d',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-07-15T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: '2531f3f4-5888-9e45-35fd-f1fe751d5375',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-07-22T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: '34a4d525-f213-7590-2eb7-3d7033a46d60',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-07-30T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: '37ef97d9-966d-153e-8aca-d0d55758be3c',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-07-08T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: '393c1c25-7d2d-68d8-5fa7-9715ccf7a857',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-08-06T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: '3e475bca-836b-6c46-d59f-d74eaea2e5f5',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-07-17T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: '3f27501b-8da3-6d9d-bed3-31ad89198000',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-07-28T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: '43d0d416-9372-3c80-f34b-722b8bf64ecc',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-07-19T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: '480ae8f4-8db2-1630-c298-53e79a35c498',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-07-05T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: '48fe8a54-54aa-faf2-8c93-7efe76931dc7',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-08-13T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: '5251439c-94ee-00d0-5e6b-281d6c8257c2',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-07-23T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: '53ddc304-45f5-6a63-f2f0-73487879f19f',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-07-02T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: '5c95b2e1-4194-fa40-1d26-6d37eee2b7b0',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-07-21T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: '6034b421-d0c7-78a4-7e53-d045cf4d4732',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-07-26T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: '65e507c5-53a4-0ada-316d-0412ebec6fa3',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-06-29T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: '68eb3397-7ffe-2a16-7605-5fadfb84fc33',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-07-25T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: '690ab3f8-b90b-e80c-4bb7-dc1f5e8f83ee',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-07-11T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: '6e3b5c99-e58b-e8a8-6097-1ea7a77ab670',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-08-03T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: '7706c6f9-afad-445b-bb6e-c655f21da150',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-08-08T11:09:34.331391+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: '7706c6f9-afad-445b-bb6e-c655f21da151',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-08-12T11:09:34.331391+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: '7706c6f9-afad-445b-bb6e-c655f21da152',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-08-13T10:09:34.331391+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: '7a7b683b-4e3a-8f4e-2ec9-09a286b359e4',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-07-03T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: '7bde1af8-b611-a1e0-c565-d9c5c9f2f5ed',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-06-27T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: '7da1fc87-8a24-2dbb-b796-495e6df8bf28',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-06-25T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: '7df3e750-5b3b-5239-f18c-942f014429fc',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-07-01T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: '7fa50808-8f77-8f43-237e-f38fbbbeba0d',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-06-21T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: '85f93aed-576b-cfee-b170-2cb532e08064',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-08-02T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: '88885362-5baa-34ad-9806-e830e5a68a3c',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-07-04T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: '8a6e7be0-3598-02a3-6fbf-62c901a3eba7',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-06-28T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: '8f0bb75e-07cd-7a11-52c1-4b608a99522d',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-07-07T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: '90061ac0-bcd9-d17f-d888-e331979136ac',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-07-18T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: '90b83561-4c01-779e-5879-435fbb353a07',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-06-24T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: '944033af-10c1-6a8a-1826-983dc62bde7f',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-06-22T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: '9f8bc587-0623-3220-039f-5579a7bcf022',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-08-05T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: 'a07fc453-4dcf-f473-05af-399d792e6b64',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-07-31T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: 'a1cc3aaf-8312-36ae-0030-af0c811b6d7d',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-06-26T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: 'a2fce6af-8540-0990-4ae3-4e05195aae58',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-08-04T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: 'a59b8501-a7e0-ae0a-618f-4ac9f315750f',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-08-08T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: 'a7c025ff-3b41-a705-4a08-34db23fd49b8',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-08-11T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: 'a9f17dfe-7ca6-40f0-30af-abe34741e2a9',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-07-16T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: 'ac805fbe-5adb-27c4-1b19-f44ae0035b2a',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-06-23T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: 'b32e0645-bd3c-5899-2aec-47342d36bfc5',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-07-09T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: 'b831a65b-d903-d7b3-5beb-4413a368756c',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-08-09T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: 'b8dfdcfb-4633-4059-b5e0-70ff1b08884c',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-06-20T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: 'bc641e02-938f-cbac-2547-e9686af5158f',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-07-24T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: 'c5eed903-03ae-9fee-bb6a-a6f7b63baac3',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-07-14T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: 'c8693068-99e8-04c2-50b9-8d1acab4d99e',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-07-13T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: 'ccdad8f8-840f-d250-0005-eda5531b89ab',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-07-29T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: 'cfbe0036-5e96-bbae-6db6-fc81ab404d75',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-07-20T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: 'd3dafae5-0b6c-ce2a-a3f8-152da4c0a027',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-08-01T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: 'de93f040-8a6e-dcf4-1010-0ee61e646dc7',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-07-27T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: 'df297e54-7f37-d2ff-8b75-4b0e126c7b0c',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-08-07T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: 'e139cdc8-b1d7-d47e-120e-99aee2bf7e53',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-08-10T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: 'e5c13403-0c4e-143b-cf66-f9ea2efc622f',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-07-10T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: 'ea88a19f-dd70-1616-5179-d5b6e997aaee',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-08-12T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
  {
    id: 'ed81e058-9c99-2e1b-f2ad-582937d8dc2b',
    doctor_id: 'e313dbf7-b736-4fc3-a8fd-e6edbb882297',
    created_at: '2026-07-06T19:58:16.185289+00:00',
    routing_slug: 'najeeb-mapantas',
  },
];

async function main() {
  fs.writeFileSync(
    path.join(dataDir, 'public__newsletter_sends.json'),
    JSON.stringify(newsletter_sends, null, 0),
    'utf8'
  );
  fs.writeFileSync(
    path.join(dataDir, 'public__shop_order_email_sends.json'),
    JSON.stringify(shop_order_email_sends, null, 0),
    'utf8'
  );
  fs.writeFileSync(
    path.join(dataDir, 'sandbox__referral_clicks.json'),
    JSON.stringify(sandbox_referral_clicks, null, 0),
    'utf8'
  );

  await migInsert('doctors', 'newsletter_sends', newsletter_sends);
  await migInsert('doctors', 'shop_order_email_sends', shop_order_email_sends);
  await migInsert('sandbox', 'referral_clicks', sandbox_referral_clicks, 20);
  console.log('phase3 done', {
    newsletter_sends: newsletter_sends.length,
    shop_order_email_sends: shop_order_email_sends.length,
    sandbox_referral_clicks: sandbox_referral_clicks.length,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
