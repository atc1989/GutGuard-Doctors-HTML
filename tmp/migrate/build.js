const fs = require("fs");
const path = require("path");
const outDir = "C:/Users/najee/Projects/GutGuard-Doctors-HTML/tmp/migrate";

const tableDdls = [
`CREATE TABLE IF NOT EXISTS public.doctor_registrations (id uuid DEFAULT gen_random_uuid() NOT NULL, full_name text NOT NULL, email text NOT NULL, mobile text NOT NULL, specialty text NOT NULL, practice_location text NOT NULL, task_email_received boolean DEFAULT false NOT NULL, task_facebook_followed boolean DEFAULT false NOT NULL, task_tiktok_followed boolean DEFAULT false NOT NULL, task_reel_created boolean DEFAULT false NOT NULL, prize_label text, prize_note text, prize_claimed_at timestamp with time zone, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL, tiktok_username text, routing_slug text NOT NULL, redirect_url text, referred_by_partner_id uuid, PRIMARY KEY (id));`,
`CREATE TABLE IF NOT EXISTS public.doctor_sequence_enrollments (id uuid DEFAULT gen_random_uuid() NOT NULL, doctor_id uuid NOT NULL, current_step integer DEFAULT 0 NOT NULL, status text DEFAULT 'active'::text NOT NULL, enrolled_at timestamp with time zone DEFAULT now() NOT NULL, PRIMARY KEY (id), CONSTRAINT doctor_sequence_enrollments_status_check CHECK (((status = ANY (ARRAY['active'::text, 'completed'::text])))));`,
`CREATE TABLE IF NOT EXISTS public.email_sequence_sends (id uuid DEFAULT gen_random_uuid() NOT NULL, enrollment_id uuid NOT NULL, doctor_id uuid NOT NULL, step_id uuid NOT NULL, sent_at timestamp with time zone DEFAULT now() NOT NULL, clicked_at timestamp with time zone, status text DEFAULT 'sent'::text NOT NULL, PRIMARY KEY (id), CONSTRAINT email_sequence_sends_status_check CHECK (((status = ANY (ARRAY['sent'::text, 'clicked'::text])))));`,
`CREATE TABLE IF NOT EXISTS public.email_sequence_steps (id uuid DEFAULT gen_random_uuid() NOT NULL, step_number integer NOT NULL, subject text NOT NULL, html_body text NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL, attachments jsonb DEFAULT '[]'::jsonb NOT NULL, PRIMARY KEY (id));`,
`CREATE TABLE IF NOT EXISTS public.newsletter_campaigns (id uuid DEFAULT gen_random_uuid() NOT NULL, title text NOT NULL, subject text NOT NULL, html_template text NOT NULL, recipient_count integer DEFAULT 0 NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL, PRIMARY KEY (id));`,
`CREATE TABLE IF NOT EXISTS public.newsletter_sends (id uuid DEFAULT gen_random_uuid() NOT NULL, doctor_id uuid, email text DEFAULT ''::text NOT NULL, subject text NOT NULL, status text NOT NULL, resend_id text, error_message text, sent_at timestamp with time zone DEFAULT now() NOT NULL, newsletter_id uuid, PRIMARY KEY (id), CONSTRAINT newsletter_sends_status_check CHECK (((status = ANY (ARRAY['sent'::text, 'failed'::text, 'skipped'::text])))));`,
`CREATE TABLE IF NOT EXISTS public.partner_referral_email_sends (id uuid DEFAULT gen_random_uuid() NOT NULL, registration_id uuid NOT NULL, referrer_id uuid NOT NULL, recipient_email text NOT NULL, subject text NOT NULL, status text NOT NULL, resend_id text, error_message text, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL, PRIMARY KEY (id), CONSTRAINT partner_referral_email_sends_status_check CHECK (((status = ANY (ARRAY['sending'::text, 'sent'::text, 'failed'::text, 'skipped'::text])))));`,
`CREATE TABLE IF NOT EXISTS public.partner_referral_email_settings (id smallint DEFAULT 1 NOT NULL, enabled boolean DEFAULT true NOT NULL, subject text DEFAULT 'A new partner registered through your GutGuard link'::text NOT NULL, reply_to text DEFAULT ''::text NOT NULL, body_text text DEFAULT ''::text NOT NULL, html_template text DEFAULT '<div style="font-family:Arial,sans-serif;color:#0F0F18;line-height:1.6"><h1>A new GutGuard partner joined</h1><p>Hello {{partner_name}},</p><p>{{new_partner_name}} registered through your referral link.</p><p><strong>Specialty:</strong> {{new_partner_specialty}}<br><strong>Location:</strong> {{new_partner_location}}<br><strong>Registered:</strong> {{registered_at}}</p><p><a href="{{dashboard_url}}">Open your partner dashboard</a></p></div>'::text NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL, PRIMARY KEY (id), CONSTRAINT partner_referral_email_settings_id_check CHECK (((id = 1))));`,
`CREATE TABLE IF NOT EXISTS public.prizes (id bigint GENERATED ALWAYS AS IDENTITY NOT NULL, label text NOT NULL, note text NOT NULL, weight integer NOT NULL, color text NOT NULL, text_color text NOT NULL, active boolean DEFAULT true NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL, PRIMARY KEY (id), CONSTRAINT prizes_weight_check CHECK (((weight > 0))));`,
`CREATE TABLE IF NOT EXISTS public.referral_clicks (id uuid DEFAULT gen_random_uuid() NOT NULL, routing_slug text NOT NULL, doctor_id uuid, created_at timestamp with time zone DEFAULT now() NOT NULL, PRIMARY KEY (id));`,
`CREATE TABLE IF NOT EXISTS public.registration_email_sends (id uuid DEFAULT gen_random_uuid() NOT NULL, registration_id uuid, email text DEFAULT ''::text NOT NULL, subject text DEFAULT ''::text NOT NULL, status text NOT NULL, resend_id text, error_message text, sent_at timestamp with time zone DEFAULT now() NOT NULL, PRIMARY KEY (id), CONSTRAINT registration_email_sends_status_check CHECK (((status = ANY (ARRAY['sent'::text, 'failed'::text, 'skipped'::text, 'test'::text])))));`,
`CREATE TABLE IF NOT EXISTS public.registration_email_settings (id smallint DEFAULT 1 NOT NULL, enabled boolean DEFAULT false NOT NULL, subject text DEFAULT ''::text NOT NULL, reply_to text DEFAULT ''::text NOT NULL, html_template text DEFAULT ''::text NOT NULL, attachments jsonb DEFAULT '[]'::jsonb NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL, body_text text DEFAULT ''::text NOT NULL, PRIMARY KEY (id), CONSTRAINT registration_email_settings_id_check CHECK (((id = 1))));`,
`CREATE TABLE IF NOT EXISTS public.shop_order_email_sends (id uuid DEFAULT gen_random_uuid() NOT NULL, order_id uuid, email text NOT NULL, subject text NOT NULL, status text NOT NULL, resend_id text, error_message text, sent_at timestamp with time zone DEFAULT now() NOT NULL, PRIMARY KEY (id), CONSTRAINT shop_order_email_sends_status_check CHECK (((status = ANY (ARRAY['sent'::text, 'failed'::text, 'skipped'::text])))));`,
`CREATE TABLE IF NOT EXISTS public.shop_orders (id uuid DEFAULT gen_random_uuid() NOT NULL, order_code text NOT NULL, status text DEFAULT 'pending_payment'::text NOT NULL, payment_status text DEFAULT 'pending'::text NOT NULL, payment_method text DEFAULT 'maya'::text NOT NULL, maya_reference text, customer_name text NOT NULL, email text NOT NULL, mobile text NOT NULL, address text NOT NULL, city text NOT NULL, province text NOT NULL, zip text NOT NULL, subtotal numeric(12,2) DEFAULT 0 NOT NULL, items jsonb DEFAULT '[]'::jsonb NOT NULL, admin_notes text, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL, barangay text DEFAULT ''::text NOT NULL, province_code text, city_municipality_code text, barangay_code text, shipping_region text, shipping_fee numeric(12,2) DEFAULT 0 NOT NULL, shipping_weight_grams integer DEFAULT 0 NOT NULL, total_amount numeric(12,2) DEFAULT 0 NOT NULL, maya_checkout_id text, maya_payment_id text, maya_payment_status text, maya_request_reference text, maya_fund_source text, payment_attempts integer DEFAULT 0 NOT NULL, paid_at timestamp with time zone, first_name text, last_name text, referral_slug text, referral_doctor_id uuid, PRIMARY KEY (id), CONSTRAINT shop_orders_payment_status_check CHECK (((payment_status = ANY (ARRAY['pending'::text, 'review'::text, 'paid'::text, 'failed'::text, 'refunded'::text])))), CONSTRAINT shop_orders_status_check CHECK (((status = ANY (ARRAY['pending_payment'::text, 'payment_review'::text, 'paid'::text, 'confirmed'::text, 'cancelled'::text, 'fulfilled'::text])))));`,
`CREATE TABLE IF NOT EXISTS public.sms_campaigns (id uuid DEFAULT gen_random_uuid() NOT NULL, title text NOT NULL, message_template text NOT NULL, recipient_count integer DEFAULT 0 NOT NULL, provider text, created_at timestamp with time zone DEFAULT now() NOT NULL, PRIMARY KEY (id));`,
`CREATE TABLE IF NOT EXISTS public.sms_sends (id uuid DEFAULT gen_random_uuid() NOT NULL, sms_campaign_id uuid, doctor_id uuid, mobile text DEFAULT ''::text NOT NULL, message text NOT NULL, status text NOT NULL, provider_message_id text, error_message text, sent_at timestamp with time zone DEFAULT now() NOT NULL, PRIMARY KEY (id), CONSTRAINT sms_sends_status_check CHECK (((status = ANY (ARRAY['sent'::text, 'failed'::text, 'skipped'::text])))));`,
`CREATE TABLE IF NOT EXISTS public.tiktok_credentials (id text DEFAULT 'default'::text NOT NULL, access_token text, refresh_token text NOT NULL, expires_at bigint DEFAULT 0 NOT NULL, refresh_token_expires_at bigint, updated_at timestamp with time zone DEFAULT now() NOT NULL, PRIMARY KEY (id), CONSTRAINT tiktok_credentials_id_check CHECK (((id = 'default'::text))));`,
`CREATE TABLE IF NOT EXISTS public.wheel_admin_settings (id boolean DEFAULT true NOT NULL, admin_password text NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL, PRIMARY KEY (id), CONSTRAINT wheel_admin_settings_id_check CHECK ((id)));`,
`CREATE TABLE IF NOT EXISTS public.wheel_claims (id uuid DEFAULT gen_random_uuid() NOT NULL, doctor_id uuid NOT NULL, prize_id uuid NOT NULL, prize_label_snapshot text NOT NULL, prize_note_snapshot text NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL, PRIMARY KEY (id));`,
`CREATE TABLE IF NOT EXISTS public.wheel_prizes (id uuid DEFAULT gen_random_uuid() NOT NULL, label text NOT NULL, note text DEFAULT ''::text NOT NULL, color text DEFAULT '#0608A9'::text NOT NULL, text_color text DEFAULT '#F4F1EA'::text NOT NULL, chance_weight integer DEFAULT 1 NOT NULL, total_stock integer DEFAULT 0 NOT NULL, remaining_stock integer DEFAULT 0 NOT NULL, is_active boolean DEFAULT true NOT NULL, sort_order integer DEFAULT 0 NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL, PRIMARY KEY (id), CONSTRAINT wheel_prizes_chance_weight_check CHECK (((chance_weight >= 0))), CONSTRAINT wheel_prizes_total_stock_check CHECK (((total_stock >= 0))), CONSTRAINT wheel_prizes_remaining_stock_check CHECK (((remaining_stock >= 0))), CONSTRAINT wheel_prizes_check CHECK (((remaining_stock <= total_stock))));`,
`CREATE TABLE IF NOT EXISTS sandbox.referral_clicks (id uuid DEFAULT gen_random_uuid() NOT NULL, routing_slug text NOT NULL, doctor_id uuid, created_at timestamp with time zone DEFAULT now() NOT NULL, PRIMARY KEY (id));`,
`CREATE TABLE IF NOT EXISTS sandbox.shop_order_email_sends (id uuid DEFAULT gen_random_uuid() NOT NULL, order_id uuid, email text NOT NULL, subject text NOT NULL, status text NOT NULL, resend_id text, error_message text, sent_at timestamp with time zone DEFAULT now() NOT NULL, PRIMARY KEY (id), CONSTRAINT shop_order_email_sends_status_check CHECK (((status = ANY (ARRAY['sent'::text, 'failed'::text, 'skipped'::text])))));`,
`CREATE TABLE IF NOT EXISTS sandbox.shop_orders (id uuid DEFAULT gen_random_uuid() NOT NULL, order_code text NOT NULL, status text DEFAULT 'pending_payment'::text NOT NULL, payment_status text DEFAULT 'pending'::text NOT NULL, payment_method text DEFAULT 'maya'::text NOT NULL, maya_reference text, customer_name text NOT NULL, email text NOT NULL, mobile text NOT NULL, address text NOT NULL, city text NOT NULL, province text NOT NULL, barangay text DEFAULT ''::text NOT NULL, zip text NOT NULL, province_code text, city_municipality_code text, barangay_code text, shipping_region text, shipping_fee numeric(12,2) DEFAULT 0 NOT NULL, shipping_weight_grams integer DEFAULT 0 NOT NULL, total_amount numeric(12,2) DEFAULT 0 NOT NULL, subtotal numeric(12,2) DEFAULT 0 NOT NULL, items jsonb DEFAULT '[]'::jsonb NOT NULL, admin_notes text, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL, first_name text, last_name text, referral_slug text, referral_doctor_id uuid, maya_checkout_id text, maya_payment_id text, maya_payment_status text, maya_request_reference text, maya_fund_source text, payment_attempts integer DEFAULT 0 NOT NULL, paid_at timestamp with time zone, PRIMARY KEY (id), CONSTRAINT shop_orders_payment_status_check CHECK (((payment_status = ANY (ARRAY['pending'::text, 'review'::text, 'paid'::text, 'failed'::text, 'refunded'::text])))), CONSTRAINT shop_orders_status_check CHECK (((status = ANY (ARRAY['pending_payment'::text, 'payment_review'::text, 'paid'::text, 'confirmed'::text, 'cancelled'::text, 'fulfilled'::text])))));`,
];

const fks = [
  `ALTER TABLE doctors.doctor_registrations ADD CONSTRAINT doctor_registrations_referred_by_partner_id_fkey FOREIGN KEY (referred_by_partner_id) REFERENCES doctors.doctor_registrations(id);`,
  `ALTER TABLE doctors.wheel_claims ADD CONSTRAINT wheel_claims_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES doctors.doctor_registrations(id);`,
  `ALTER TABLE doctors.wheel_claims ADD CONSTRAINT wheel_claims_prize_id_fkey FOREIGN KEY (prize_id) REFERENCES doctors.wheel_prizes(id);`,
  `ALTER TABLE doctors.newsletter_sends ADD CONSTRAINT newsletter_sends_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES doctors.doctor_registrations(id);`,
  `ALTER TABLE doctors.newsletter_sends ADD CONSTRAINT newsletter_sends_newsletter_id_fkey FOREIGN KEY (newsletter_id) REFERENCES doctors.newsletter_campaigns(id);`,
  `ALTER TABLE doctors.registration_email_sends ADD CONSTRAINT registration_email_sends_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES doctors.doctor_registrations(id);`,
  `ALTER TABLE doctors.sms_sends ADD CONSTRAINT sms_sends_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES doctors.doctor_registrations(id);`,
  `ALTER TABLE doctors.sms_sends ADD CONSTRAINT sms_sends_sms_campaign_id_fkey FOREIGN KEY (sms_campaign_id) REFERENCES doctors.sms_campaigns(id);`,
  `ALTER TABLE doctors.doctor_sequence_enrollments ADD CONSTRAINT doctor_sequence_enrollments_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES doctors.doctor_registrations(id);`,
  `ALTER TABLE doctors.email_sequence_sends ADD CONSTRAINT email_sequence_sends_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES doctors.doctor_registrations(id);`,
  `ALTER TABLE doctors.email_sequence_sends ADD CONSTRAINT email_sequence_sends_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES doctors.doctor_sequence_enrollments(id);`,
  `ALTER TABLE doctors.email_sequence_sends ADD CONSTRAINT email_sequence_sends_step_id_fkey FOREIGN KEY (step_id) REFERENCES doctors.email_sequence_steps(id);`,
  `ALTER TABLE doctors.shop_orders ADD CONSTRAINT shop_orders_referral_doctor_id_fkey FOREIGN KEY (referral_doctor_id) REFERENCES doctors.doctor_registrations(id);`,
  `ALTER TABLE doctors.shop_order_email_sends ADD CONSTRAINT shop_order_email_sends_order_id_fkey FOREIGN KEY (order_id) REFERENCES doctors.shop_orders(id);`,
  `ALTER TABLE doctors.referral_clicks ADD CONSTRAINT referral_clicks_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES doctors.doctor_registrations(id);`,
  `ALTER TABLE doctors.partner_referral_email_sends ADD CONSTRAINT partner_referral_email_sends_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES doctors.doctor_registrations(id);`,
  `ALTER TABLE doctors.partner_referral_email_sends ADD CONSTRAINT partner_referral_email_sends_referrer_id_fkey FOREIGN KEY (referrer_id) REFERENCES doctors.doctor_registrations(id);`,
  `ALTER TABLE sandbox.shop_orders ADD CONSTRAINT shop_orders_referral_doctor_id_fkey FOREIGN KEY (referral_doctor_id) REFERENCES doctors.doctor_registrations(id);`,
  `ALTER TABLE sandbox.shop_order_email_sends ADD CONSTRAINT shop_order_email_sends_order_id_fkey FOREIGN KEY (order_id) REFERENCES sandbox.shop_orders(id);`,
  `ALTER TABLE sandbox.referral_clicks ADD CONSTRAINT referral_clicks_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES doctors.doctor_registrations(id);`,
];

const indexes = [
"CREATE INDEX IF NOT EXISTS doctor_registrations_email_idx ON doctors.doctor_registrations USING btree (lower(email))",
"CREATE UNIQUE INDEX IF NOT EXISTS doctor_registrations_email_key ON doctors.doctor_registrations USING btree (email) WHERE (email <> ''::text)",
"CREATE INDEX IF NOT EXISTS doctor_registrations_referred_by_partner_id_idx ON doctors.doctor_registrations USING btree (referred_by_partner_id, created_at DESC)",
"CREATE UNIQUE INDEX IF NOT EXISTS doctor_registrations_routing_slug_key ON doctors.doctor_registrations USING btree (routing_slug)",
"CREATE UNIQUE INDEX IF NOT EXISTS doctor_registrations_tiktok_username_unique ON doctors.doctor_registrations USING btree (lower(tiktok_username)) WHERE ((tiktok_username IS NOT NULL) AND (tiktok_username <> ''::text))",
"CREATE UNIQUE INDEX IF NOT EXISTS doctor_sequence_enrollments_doctor_id_key ON doctors.doctor_sequence_enrollments USING btree (doctor_id)",
"CREATE UNIQUE INDEX IF NOT EXISTS email_sequence_steps_step_number_key ON doctors.email_sequence_steps USING btree (step_number)",
"CREATE UNIQUE INDEX IF NOT EXISTS partner_referral_email_one_inflight_idx ON doctors.partner_referral_email_sends USING btree (registration_id) WHERE (status = 'sending'::text)",
"CREATE UNIQUE INDEX IF NOT EXISTS partner_referral_email_one_success_idx ON doctors.partner_referral_email_sends USING btree (registration_id) WHERE (status = 'sent'::text)",
"CREATE UNIQUE INDEX IF NOT EXISTS prizes_label_key ON doctors.prizes USING btree (label)",
"CREATE INDEX IF NOT EXISTS referral_clicks_doctor_id_idx ON doctors.referral_clicks USING btree (doctor_id, created_at DESC)",
"CREATE INDEX IF NOT EXISTS registration_email_sends_registration_id_idx ON doctors.registration_email_sends USING btree (registration_id)",
"CREATE INDEX IF NOT EXISTS registration_email_sends_sent_at_idx ON doctors.registration_email_sends USING btree (sent_at DESC)",
"CREATE INDEX IF NOT EXISTS shop_order_email_sends_order_id_idx ON doctors.shop_order_email_sends USING btree (order_id, sent_at DESC)",
"CREATE INDEX IF NOT EXISTS shop_orders_created_at_idx ON doctors.shop_orders USING btree (created_at DESC)",
"CREATE INDEX IF NOT EXISTS shop_orders_maya_payment_id_idx ON doctors.shop_orders USING btree (maya_payment_id)",
"CREATE INDEX IF NOT EXISTS shop_orders_order_code_idx ON doctors.shop_orders USING btree (order_code)",
"CREATE UNIQUE INDEX IF NOT EXISTS shop_orders_order_code_key ON doctors.shop_orders USING btree (order_code)",
"CREATE INDEX IF NOT EXISTS shop_orders_referral_doctor_id_idx ON doctors.shop_orders USING btree (referral_doctor_id, created_at DESC)",
"CREATE INDEX IF NOT EXISTS shop_orders_status_idx ON doctors.shop_orders USING btree (status, payment_status)",
"CREATE INDEX IF NOT EXISTS sms_sends_doctor_id_sent_at_idx ON doctors.sms_sends USING btree (doctor_id, sent_at DESC)",
"CREATE INDEX IF NOT EXISTS sms_sends_sms_campaign_id_idx ON doctors.sms_sends USING btree (sms_campaign_id)",
"CREATE UNIQUE INDEX IF NOT EXISTS wheel_claims_doctor_id_key ON doctors.wheel_claims USING btree (doctor_id)",
"CREATE UNIQUE INDEX IF NOT EXISTS wheel_prizes_label_key ON doctors.wheel_prizes USING btree (label)",
"CREATE INDEX IF NOT EXISTS sandbox_referral_clicks_doctor_id_idx ON sandbox.referral_clicks USING btree (doctor_id, created_at DESC)",
"CREATE INDEX IF NOT EXISTS sandbox_shop_order_email_sends_order_id_idx ON sandbox.shop_order_email_sends USING btree (order_id, sent_at DESC)",
"CREATE INDEX IF NOT EXISTS sandbox_shop_orders_created_at_idx ON sandbox.shop_orders USING btree (created_at DESC)",
"CREATE INDEX IF NOT EXISTS sandbox_shop_orders_maya_payment_id_idx ON sandbox.shop_orders USING btree (maya_payment_id)",
"CREATE INDEX IF NOT EXISTS sandbox_shop_orders_order_code_idx ON sandbox.shop_orders USING btree (order_code)",
"CREATE INDEX IF NOT EXISTS sandbox_shop_orders_referral_doctor_id_idx ON sandbox.shop_orders USING btree (referral_doctor_id, created_at DESC)",
"CREATE INDEX IF NOT EXISTS sandbox_shop_orders_status_idx ON sandbox.shop_orders USING btree (status, payment_status)",
"CREATE UNIQUE INDEX IF NOT EXISTS sandbox_shop_orders_order_code_key ON sandbox.shop_orders USING btree (order_code)",
];

function rewritePublicToDoctors(sql) {
  let s = sql;
  // Longest-first table-ish replacements already handled if we do schema first
  s = s.replace(/CREATE OR REPLACE FUNCTION public\./g, "CREATE OR REPLACE FUNCTION doctors.");
  s = s.replace(/CREATE FUNCTION public\./g, "CREATE FUNCTION doctors.");
  s = s.replace(/ALTER FUNCTION public\./g, "ALTER FUNCTION doctors.");
  // Table references public.X -> doctors.X but not public schema grants of unrelated
  const tables = [
    "partner_referral_email_settings","partner_referral_email_sends","doctor_sequence_enrollments",
    "registration_email_settings","registration_email_sends","email_sequence_sends","email_sequence_steps",
    "newsletter_campaigns","newsletter_sends","wheel_admin_settings","doctor_registrations","tiktok_credentials",
    "shop_order_email_sends","referral_clicks","sms_campaigns","wheel_prizes","wheel_claims","shop_orders",
    "sms_sends","prizes"
  ];
  for (const t of tables) {
    s = s.replaceAll(`public.${t}`, `doctors.${t}`);
  }
  s = s.replace(/SET search_path TO 'public'/g, "SET search_path TO 'doctors', 'public'");
  s = s.replace(/SET search_path TO \"public\"/g, "SET search_path TO 'doctors', 'public'");
  // sandbox functions that referenced public.doctor_registrations already fixed by table replace
  return s;
}

const parts = [];
parts.push(`-- Doctors schema migration into GutGuard LifeStyle`);
parts.push(`CREATE SCHEMA IF NOT EXISTS doctors;`);
parts.push(`CREATE SCHEMA IF NOT EXISTS sandbox;`);
parts.push(`GRANT USAGE ON SCHEMA doctors TO anon, authenticated, service_role;`);
parts.push(`GRANT USAGE ON SCHEMA sandbox TO anon, authenticated, service_role;`);

for (const ddl of tableDdls) {
  parts.push(ddl.replaceAll("public.", "doctors."));
}

parts.push(...fks);
parts.push(...indexes.map(i => i + ";"));

// RLS
const rlsTables = [
  "doctor_registrations","prizes","wheel_prizes","wheel_claims","wheel_admin_settings","newsletter_sends",
  "newsletter_campaigns","registration_email_settings","registration_email_sends","sms_campaigns","sms_sends",
  "email_sequence_steps","doctor_sequence_enrollments","email_sequence_sends","tiktok_credentials","shop_orders",
  "shop_order_email_sends","referral_clicks","partner_referral_email_settings","partner_referral_email_sends"
];
for (const t of rlsTables) parts.push(`ALTER TABLE doctors.${t} ENABLE ROW LEVEL SECURITY;`);
parts.push(`ALTER TABLE sandbox.shop_orders ENABLE ROW LEVEL SECURITY;`);
parts.push(`ALTER TABLE sandbox.shop_order_email_sends ENABLE ROW LEVEL SECURITY;`);
parts.push(`ALTER TABLE sandbox.referral_clicks ENABLE ROW LEVEL SECURITY;`);
parts.push(`DROP POLICY IF EXISTS "Allow reading active prizes" ON doctors.prizes;`);
parts.push(`CREATE POLICY "Allow reading active prizes" ON doctors.prizes AS PERMISSIVE FOR SELECT TO anon, authenticated USING (active = true);`);

parts.push(`GRANT ALL ON ALL TABLES IN SCHEMA doctors TO anon, authenticated, service_role;`);
parts.push(`GRANT ALL ON ALL SEQUENCES IN SCHEMA doctors TO anon, authenticated, service_role;`);
parts.push(`GRANT ALL ON ALL TABLES IN SCHEMA sandbox TO anon, authenticated, service_role;`);
parts.push(`GRANT ALL ON ALL SEQUENCES IN SCHEMA sandbox TO anon, authenticated, service_role;`);
parts.push(`ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA doctors GRANT ALL ON TABLES TO anon, authenticated, service_role;`);
parts.push(`ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA doctors GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;`);
parts.push(`ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA doctors GRANT ALL ON ROUTINES TO anon, authenticated, service_role;`);
parts.push(`ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA sandbox GRANT ALL ON TABLES TO anon, authenticated, service_role;`);
parts.push(`ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA sandbox GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;`);
parts.push(`ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA sandbox GRANT ALL ON ROUTINES TO anon, authenticated, service_role;`);

fs.writeFileSync(path.join(outDir, "01_tables.sql"), parts.join("\n\n"));

// Functions
const raw = fs.readFileSync(path.join(outDir, "functions.json"), "utf8");
const parsed = JSON.parse(raw);
const rows = parsed.result ? JSON.parse(parsed.result.match(/<untrusted-data[^>]*>\n?([\s\S]*?)\n?<\/untrusted-data>/)?.[1] || "[]") : parsed;
// MCP file is either raw array or wrapped - try both
let fns = parsed;
if (parsed.result && typeof parsed.result === "string") {
  const m = parsed.result.match(/\[{[\s\S]*}\]/);
  fns = m ? JSON.parse(m[0]) : [];
} else if (Array.isArray(parsed)) {
  fns = parsed;
} else if (parsed[0]?.def) {
  fns = parsed;
}

const fnParts = [];
for (const row of fns) {
  if (!row.def) continue;
  let def = row.def;
  if (def.includes("FUNCTION sandbox.") || def.includes("FUNCTION public.") === false && row.sig?.startsWith("sandbox.")) {
    // keep sandbox schema for sandbox functions; still rewrite public table refs to doctors
    def = def;
    for (const t of ["doctor_registrations","shop_orders","shop_order_email_sends","referral_clicks"]) {
      def = def.replaceAll(`public.${t}`, t === "doctor_registrations" ? `doctors.${t}` : (def.includes("sandbox.") ? def : `doctors.${t}`));
    }
    // simpler: for sandbox functions only replace public.doctor_registrations
    def = row.def.replaceAll("public.doctor_registrations", "doctors.doctor_registrations");
    def = def.replace(/SET search_path TO 'public'/g, "SET search_path TO 'doctors', 'sandbox', 'public'");
  } else {
    def = rewritePublicToDoctors(def);
  }
  // Detect sandbox by signature
  if ((row.sig || "").startsWith("sandbox.")) {
    def = row.def
      .replaceAll("public.doctor_registrations", "doctors.doctor_registrations")
      .replace(/SET search_path TO 'public'/g, "SET search_path TO 'doctors', 'sandbox', 'public'");
  }
  fnParts.push(def);
}
fs.writeFileSync(path.join(outDir, "02_functions.sql"), fnParts.join("\n\n"));

const triggers = `
CREATE OR REPLACE TRIGGER doctor_registrations_referrer_immutable
BEFORE UPDATE OF referred_by_partner_id ON doctors.doctor_registrations
FOR EACH ROW EXECUTE FUNCTION doctors.prevent_partner_referrer_change();

CREATE OR REPLACE TRIGGER doctor_registrations_touch_updated_at
BEFORE UPDATE ON doctors.doctor_registrations
FOR EACH ROW EXECUTE FUNCTION doctors.touch_updated_at();

CREATE OR REPLACE TRIGGER shop_orders_touch_updated_at
BEFORE UPDATE ON doctors.shop_orders
FOR EACH ROW EXECUTE FUNCTION doctors.touch_shop_order_updated_at();

CREATE OR REPLACE TRIGGER touch_tiktok_credentials_updated_at
BEFORE UPDATE ON doctors.tiktok_credentials
FOR EACH ROW EXECUTE FUNCTION doctors.touch_tiktok_credentials_updated_at();

CREATE OR REPLACE TRIGGER shop_orders_touch_updated_at
BEFORE UPDATE ON sandbox.shop_orders
FOR EACH ROW EXECUTE FUNCTION sandbox.touch_shop_order_updated_at();
`;
fs.writeFileSync(path.join(outDir, "03_triggers.sql"), triggers);
fs.writeFileSync(path.join(outDir, "fn_count.txt"), String(fnParts.length));
console.log("tables sql bytes", fs.statSync(path.join(outDir,"01_tables.sql")).size);
console.log("functions count", fnParts.length, "bytes", fs.statSync(path.join(outDir,"02_functions.sql")).size);
