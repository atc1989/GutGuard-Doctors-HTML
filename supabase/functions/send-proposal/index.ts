import { createClient } from "https://esm.sh/@supabase/supabase-js@2.106.2";

const BUCKET = "registration-email-assets";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ProposalRequest = {
  registrationId?: string;
};

type DoctorRegistration = {
  id: string;
  full_name: string | null;
  name_prefix: string | null;
  email: string | null;
  mobile: string | null;
  tiktok_username: string | null;
  specialty: string | null;
  practice_location: string | null;
  routing_slug: string | null;
  redirect_url: string | null;
  created_at: string | null;
};

type AttachmentRecord = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  path: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const { registrationId } = (await req.json()) as ProposalRequest;
    if (!registrationId) return jsonResponse({ error: "Missing registrationId" }, 400);

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail =
      Deno.env.get("REGISTRATION_FROM_EMAIL") ??
      Deno.env.get("PROPOSAL_FROM_EMAIL") ??
      "GutGuard Doctors <onboarding@resend.dev>";
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!resendApiKey || !supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Missing Edge Function secrets" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, { db: { schema: "doctors" } });
    const { data: registration, error: registrationError } = await supabase
      .from("doctor_registrations")
      .select(
        "id, name_prefix, full_name, email, mobile, tiktok_username, specialty, practice_location, routing_slug, redirect_url, created_at",
      )
      .eq("id", registrationId)
      .single();

    if (registrationError || !registration) {
      return jsonResponse({ error: "Registration not found" }, 404);
    }

    const doctor = registration as DoctorRegistration;
    const email = (doctor.email ?? "").trim().toLowerCase();
    if (!isValidEmail(email)) {
      await recordSendAttempt(supabase, {
        registrationId,
        email,
        subject: "",
        status: "skipped",
        errorMessage: "Missing or invalid email address",
      });
      return jsonResponse({ sent: false, skipped: true, reason: "Missing or invalid email address" });
    }

    const { data: settings, error: settingsError } = await supabase
      .from("registration_email_settings")
      .select("enabled, subject, reply_to, body_text, html_template, attachments")
      .eq("id", 1)
      .single();

    const bodyText = String(settings?.body_text ?? "").trim();
    const htmlTemplate = String(settings?.html_template ?? "").trim() || renderBodyText(bodyText);

    if (settingsError || !settings?.enabled || !settings.subject || !htmlTemplate) {
      await recordSendAttempt(supabase, {
        registrationId,
        email,
        subject: String(settings?.subject ?? ""),
        status: "skipped",
        errorMessage: "Registration email is disabled or missing a body",
      });
      return jsonResponse({ sent: false, skipped: true, reason: "Registration email is disabled or missing a body" });
    }

    const attachments = await fetchAttachments(supabase, parseAttachments(settings.attachments));
    const subject = String(settings.subject).trim();
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject,
        html: renderDoctorTemplate(htmlTemplate, doctor),
        reply_to: String(settings.reply_to ?? "").trim() || undefined,
        attachments,
      }),
    });

    const resendBody = await resendResponse.json();
    if (!resendResponse.ok) {
      const message = stringifyError(resendBody);
      await recordSendAttempt(supabase, {
        registrationId,
        email,
        subject,
        status: "failed",
        errorMessage: message,
      });
      return jsonResponse({ error: "Email send failed", details: resendBody }, 502);
    }

    await recordSendAttempt(supabase, {
      registrationId,
      email,
      subject,
      status: "sent",
      resendId: resendBody.id,
    });
    return jsonResponse({ sent: true, resendId: resendBody.id });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});

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

async function recordSendAttempt(
  supabase: ReturnType<typeof createClient>,
  input: {
    registrationId?: string | null;
    email: string;
    subject: string;
    status: "sent" | "failed" | "skipped" | "test";
    resendId?: string | null;
    errorMessage?: string | null;
  },
) {
  await supabase.from("registration_email_sends").insert({
    registration_id: input.registrationId ?? null,
    email: input.email,
    subject: input.subject,
    status: input.status,
    resend_id: input.resendId ?? null,
    error_message: input.errorMessage ?? null,
  });
}

function renderDoctorTemplate(html: string, doctor: DoctorRegistration) {
  const routingSlug = doctor.routing_slug || slugifyDoctorRoute(doctor.full_name);
  const tiktokUsername = (doctor.tiktok_username ?? "").trim().replace(/^@+/, "").toLowerCase();
  const routingUrl = `${getSiteOrigin()}/dr/${routingSlug}`;
  const replacements: Record<string, string> = {
    doctor_name: doctor.full_name ?? "",
    name_prefix: doctor.name_prefix ?? "",
    prefixed_name: formatPrefixedName(doctor.name_prefix, doctor.full_name),
    doctor_email: doctor.email ?? "",
    doctor_mobile: doctor.mobile ?? "",
    tiktok_username: tiktokUsername,
    specialty: doctor.specialty ?? "",
    clinic_location: doctor.practice_location ?? "",
    routing_url: routingUrl,
    redirect_url: doctor.redirect_url ?? (tiktokUsername ? `https://www.tiktok.com/@${tiktokUsername}` : ""),
    registered_at: formatDate(doctor.created_at),
  };

  return stripScriptTags(html).replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
    if (!(key in replacements)) return match;
    return escapeHtml(replacements[key]);
  });
}

function renderBodyText(value: string) {
  if (!value.trim()) return "";

  const body = escapeHtml(value)
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br/>")}</p>`)
    .join("");

  return `<div style="font-family:Arial,sans-serif;color:#0F0F18;line-height:1.6">${body}</div>`;
}

function parseAttachments(value: unknown): AttachmentRecord[] {
  return Array.isArray(value) ? (value as AttachmentRecord[]) : [];
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function getSiteOrigin() {
  return (Deno.env.get("PUBLIC_SITE_URL") ?? "https://gut-guard-doctors-html.vercel.app").replace(/\/$/, "");
}

function slugifyDoctorRoute(value: string | null | undefined) {
  const slug = (value ?? "doctor")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return slug || "doctor";
}

function formatPrefixedName(prefix?: string | null, name?: string | null) {
  const n = (name ?? "").trim();
  if (!n) return "";
  return `${(prefix || "Dr.").trim()} ${n}`;
}

function formatDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function stripScriptTags(value: string) {
  return value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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
