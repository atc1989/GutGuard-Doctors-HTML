import { createClient } from "https://esm.sh/@supabase/supabase-js@2.106.2";

const BUCKET = "registration-email-assets";
const MAX_ATTACHMENTS = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["application/pdf", "image/png", "image/jpeg"]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type AttachmentInput = {
  id?: string;
  filename: string;
  contentType: string;
  size: number;
  path?: string;
  base64Content?: string;
};

type AttachmentRecord = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  path: string;
};

type SettingsPayload = {
  enabled?: boolean;
  subject?: string;
  replyTo?: string;
  html?: string;
  attachments?: AttachmentInput[];
};

type RequestPayload = {
  action?: "get" | "save" | "test";
  adminPassword?: string;
  settings?: SettingsPayload;
  testEmail?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const { action, adminPassword, settings, testEmail } = (await req.json()) as RequestPayload;
    if (!adminPassword) return jsonResponse({ error: "Missing admin password" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Missing Supabase Edge Function secrets" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { error: adminError } = await supabase.rpc("assert_wheel_admin", {
      p_admin_password: adminPassword,
    });

    if (adminError) return jsonResponse({ error: "Invalid admin password" }, 401);

    if (action === "save") {
      const saved = await saveSettings(supabase, settings);
      return jsonResponse({ settings: mapSettings(saved) });
    }

    if (action === "test") {
      if (!testEmail || !isValidEmail(testEmail)) {
        return jsonResponse({ error: "Enter a valid test email." }, 400);
      }

      const saved = await getSettings(supabase);
      const result = await sendTestEmail(supabase, saved, testEmail);
      return jsonResponse(result);
    }

    const saved = await getSettings(supabase);
    return jsonResponse({ settings: mapSettings(saved) });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});

async function getSettings(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase
    .from("registration_email_settings")
    .select("id, enabled, subject, reply_to, html_template, attachments, updated_at")
    .eq("id", 1)
    .single();

  if (error) throw new Error(`Registration email settings could not be loaded: ${error.message}`);
  return data;
}

async function saveSettings(supabase: ReturnType<typeof createClient>, settings: SettingsPayload | undefined) {
  if (!settings) throw new Error("Missing registration email settings.");

  const current = await getSettings(supabase);
  const currentAttachments = parseAttachments(current.attachments);
  const nextAttachments = await resolveAttachments(supabase, currentAttachments, settings.attachments ?? []);
  const nextPaths = new Set(nextAttachments.map((attachment) => attachment.path));
  const removedPaths = currentAttachments
    .filter((attachment) => !nextPaths.has(attachment.path))
    .map((attachment) => attachment.path);

  if (removedPaths.length > 0) {
    await supabase.storage.from(BUCKET).remove(removedPaths);
  }

  const { data, error } = await supabase
    .from("registration_email_settings")
    .upsert({
      id: 1,
      enabled: Boolean(settings.enabled),
      subject: (settings.subject ?? "").trim(),
      reply_to: (settings.replyTo ?? "").trim(),
      html_template: stripScriptTags(settings.html ?? "").trim(),
      attachments: nextAttachments,
      updated_at: new Date().toISOString(),
    })
    .select("id, enabled, subject, reply_to, html_template, attachments, updated_at")
    .single();

  if (error) throw new Error(`Registration email settings could not be saved: ${error.message}`);
  return data;
}

async function resolveAttachments(
  supabase: ReturnType<typeof createClient>,
  current: AttachmentRecord[],
  input: AttachmentInput[],
) {
  if (input.length > MAX_ATTACHMENTS) throw new Error(`Upload up to ${MAX_ATTACHMENTS} attachments only.`);

  const next: AttachmentRecord[] = [];
  let totalBytes = 0;

  for (const attachment of input) {
    const filename = sanitizeFilename(attachment.filename);
    const contentType = attachment.contentType;
    const size = Number(attachment.size);

    if (!filename) throw new Error("Attachment filename is required.");
    if (!ALLOWED_TYPES.has(contentType)) throw new Error(`${filename} must be a PDF, PNG, or JPG.`);
    if (!Number.isFinite(size) || size <= 0) throw new Error(`${filename} has an invalid file size.`);
    if (size > MAX_FILE_BYTES) throw new Error(`${filename} must be 10 MB or smaller.`);

    totalBytes += size;
    if (totalBytes > MAX_TOTAL_BYTES) throw new Error("Total attachments must be 20 MB or smaller.");

    if (attachment.path && !attachment.base64Content) {
      const existing = current.find((item) => item.path === attachment.path);
      if (existing) next.push(existing);
      continue;
    }

    if (!attachment.base64Content) throw new Error(`${filename} is missing file content.`);

    const id = crypto.randomUUID();
    const path = `active/${id}-${filename}`;
    const bytes = base64ToUint8Array(attachment.base64Content);
    const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType,
      upsert: false,
    });

    if (error) throw new Error(`${filename} could not be uploaded: ${error.message}`);
    next.push({ id, filename, contentType, size, path });
  }

  return next;
}

async function sendTestEmail(supabase: ReturnType<typeof createClient>, settings: Record<string, unknown>, testEmail: string) {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail =
    Deno.env.get("REGISTRATION_FROM_EMAIL") ??
    Deno.env.get("PROPOSAL_FROM_EMAIL") ??
    "GutGuard Doctors <onboarding@resend.dev>";

  if (!resendApiKey) throw new Error("Missing RESEND_API_KEY.");

  const subject = String(settings.subject ?? "").trim();
  const html = String(settings.html_template ?? "").trim();
  if (!subject) throw new Error("Save a subject before sending a test email.");
  if (!html) throw new Error("Save an HTML template before sending a test email.");

  const attachments = await fetchAttachments(supabase, parseAttachments(settings.attachments));
  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [testEmail],
      subject,
      html: renderTemplate(html, sampleDoctor()),
      reply_to: String(settings.reply_to ?? "").trim() || undefined,
      attachments,
    }),
  });
  const resendBody = await resendResponse.json();

  await supabase.from("registration_email_sends").insert({
    email: testEmail,
    subject,
    status: resendResponse.ok ? "test" : "failed",
    resend_id: resendResponse.ok ? resendBody.id : null,
    error_message: resendResponse.ok ? null : stringifyError(resendBody),
  });

  if (!resendResponse.ok) {
    throw new Error(`Test email failed: ${stringifyError(resendBody)}`);
  }

  return { sent: true, resendId: resendBody.id };
}

async function fetchAttachments(supabase: ReturnType<typeof createClient>, attachments: AttachmentRecord[]) {
  const results = [];

  for (const attachment of attachments) {
    const { data, error } = await supabase.storage.from(BUCKET).download(attachment.path);
    if (error || !data) throw new Error(`${attachment.filename} could not be read from storage.`);

    results.push({
      filename: attachment.filename,
      content: toBase64(new Uint8Array(await data.arrayBuffer())),
    });
  }

  return results;
}

function mapSettings(settings: Record<string, unknown>) {
  return {
    enabled: Boolean(settings.enabled),
    subject: String(settings.subject ?? ""),
    replyTo: String(settings.reply_to ?? ""),
    html: String(settings.html_template ?? ""),
    attachments: parseAttachments(settings.attachments),
    updatedAt: String(settings.updated_at ?? ""),
    fromLabel:
      Deno.env.get("REGISTRATION_FROM_EMAIL") ??
      Deno.env.get("PROPOSAL_FROM_EMAIL") ??
      "GutGuard Doctors <onboarding@resend.dev>",
  };
}

function parseAttachments(value: unknown): AttachmentRecord[] {
  return Array.isArray(value) ? (value as AttachmentRecord[]) : [];
}

function sampleDoctor() {
  return {
    full_name: "Dr. Maria Santos",
    email: "doctor@example.com",
    mobile: "09171234567",
    tiktok_username: "gutguarddoctor",
    specialty: "Internal Medicine",
    practice_location: "Makati City",
    routing_slug: "maria-santos",
    redirect_url: "https://www.tiktok.com/@gutguarddoctor",
    created_at: new Date().toISOString(),
  };
}

function renderTemplate(html: string, doctor: Record<string, string>) {
  const routingUrl = `${getSiteOrigin()}/dr/${doctor.routing_slug}`;
  const replacements: Record<string, string> = {
    doctor_name: doctor.full_name ?? "",
    doctor_email: doctor.email ?? "",
    doctor_mobile: doctor.mobile ?? "",
    tiktok_username: doctor.tiktok_username ?? "",
    specialty: doctor.specialty ?? "",
    clinic_location: doctor.practice_location ?? "",
    routing_url: routingUrl,
    redirect_url: doctor.redirect_url ?? "",
    registered_at: formatDate(doctor.created_at),
  };

  return html.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
    if (!(key in replacements)) return match;
    return escapeHtml(replacements[key]);
  });
}

function getSiteOrigin() {
  return (Deno.env.get("PUBLIC_SITE_URL") ?? "https://gut-guard-doctors-html.vercel.app").replace(/\/$/, "");
}

function base64ToUint8Array(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function sanitizeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

function stripScriptTags(value: string) {
  return value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function formatDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function stringifyError(value: unknown) {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return "Email send failed";
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
