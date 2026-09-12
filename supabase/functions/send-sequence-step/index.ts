import { createClient } from "https://esm.sh/@supabase/supabase-js@2.106.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SendSequenceStepRequest = {
  doctorId: string;
  stepNumber?: number;
  onlyIfUnenrolled?: boolean;
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

type SequenceAttachment = { filename: string; content: string; content_type: string; size: number };

type SequenceStep = {
  id: string;
  step_number: number;
  subject: string;
  html_body: string;
  attachments?: SequenceAttachment[];
};

type Enrollment = {
  id: string;
  doctor_id: string;
  current_step: number;
  status: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const { doctorId, stepNumber, onlyIfUnenrolled } = (await req.json()) as SendSequenceStepRequest;
    if (!doctorId) return jsonResponse({ error: "Missing doctorId" }, 400);

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail =
      Deno.env.get("SEQUENCE_FROM_EMAIL") ??
      Deno.env.get("NEWSLETTER_FROM_EMAIL") ??
      Deno.env.get("REGISTRATION_FROM_EMAIL") ??
      Deno.env.get("PROPOSAL_FROM_EMAIL") ??
      "GutGuard Doctors <onboarding@resend.dev>";
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!resendApiKey || !supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Missing Edge Function secrets" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, { db: { schema: "doctors" } });

    // Fetch doctor
    const { data: doctorData, error: doctorError } = await supabase
      .from("doctor_registrations")
      .select("id, name_prefix, full_name, email, mobile, tiktok_username, specialty, practice_location, routing_slug, redirect_url, created_at")
      .eq("id", doctorId)
      .single();

    if (doctorError || !doctorData) return jsonResponse({ error: "Doctor not found" }, 404);
    const doctor = doctorData as DoctorRegistration;

    const email = (doctor.email ?? "").trim().toLowerCase();
    if (!isValidEmail(email)) return jsonResponse({ error: "Doctor has no valid email" }, 400);

    // Find or create enrollment
    let enrollment: Enrollment | null = null;
    const { data: existingEnrollment } = await supabase
      .from("doctor_sequence_enrollments")
      .select("id, doctor_id, current_step, status")
      .eq("doctor_id", doctorId)
      .single();

    const targetStep = stepNumber ?? (existingEnrollment ? existingEnrollment.current_step : 1);

    if (onlyIfUnenrolled && existingEnrollment) {
      return jsonResponse({ sent: false, skipped: true, reason: "already enrolled" });
    }

    if (!existingEnrollment) {
      const { data: newEnrollment, error: enrollError } = await supabase
        .from("doctor_sequence_enrollments")
        .insert({ doctor_id: doctorId, current_step: targetStep, status: "active" })
        .select()
        .single();
      if (enrollError) throw enrollError;
      enrollment = newEnrollment as Enrollment;
    } else {
      enrollment = existingEnrollment as Enrollment;
    }

    // Fetch the target step
    const { data: stepData, error: stepError } = await supabase
      .from("email_sequence_steps")
      .select("id, step_number, subject, html_body, attachments")
      .eq("step_number", targetStep)
      .single();

    if (stepError || !stepData) {
      // No step at this number — sequence is complete
      await supabase
        .from("doctor_sequence_enrollments")
        .update({ status: "completed" })
        .eq("id", enrollment.id);
      return jsonResponse({ sent: false, reason: "No step at this number — sequence complete" });
    }

    const step = stepData as SequenceStep;

    // Generate unique send record first (we need the send ID for the click URL)
    const { data: sendRecord, error: sendInsertError } = await supabase
      .from("email_sequence_sends")
      .insert({
        enrollment_id: enrollment.id,
        step_id: step.id,
        doctor_id: doctorId,
        status: "sent",
      })
      .select()
      .single();

    if (sendInsertError) throw sendInsertError;

    const siteUrl = (Deno.env.get("PUBLIC_SITE_URL") ?? supabaseUrl).replace(/\/$/, "");
    const clickUrl = `${supabaseUrl}/functions/v1/track-sequence-click?send_id=${sendRecord.id}`;

    // Render HTML with placeholders
    const html = renderTemplate(step.html_body, doctor, clickUrl, siteUrl, step.step_number);

    // Build Resend payload
    const resendPayload: Record<string, unknown> = {
      from: fromEmail,
      to: [email],
      subject: renderSubject(step.subject, doctor),
      html,
    };

    // Attach files if present
    const stepAttachments = step.attachments ?? [];
    if (stepAttachments.length > 0) {
      resendPayload.attachments = stepAttachments.map((att) => ({
        filename: att.filename,
        content: att.content,
      }));
    }

    // Send via Resend
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(resendPayload),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text();
      await supabase
        .from("email_sequence_sends")
        .update({ status: "failed" })
        .eq("id", sendRecord.id);
      return jsonResponse({ error: `Resend error: ${errBody}` }, 500);
    }

    // Update enrollment current_step
    await supabase
      .from("doctor_sequence_enrollments")
      .update({ current_step: targetStep })
      .eq("id", enrollment.id);

    return jsonResponse({ sent: true, sendId: sendRecord.id, step: targetStep });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return jsonResponse({ error: message }, 500);
  }
});

function renderTemplate(html: string, doctor: DoctorRegistration, clickUrl: string, siteUrl: string, currentStep: number) {
  const tiktokUsername = (doctor.tiktok_username ?? "").trim().replace(/^@+/, "").toLowerCase();
  const routingUrl = doctor.routing_slug ? `${siteUrl}/dr/${encodeURIComponent(doctor.routing_slug)}` : "";

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
    sequence_click_url: clickUrl,
    next_step_number: String(currentStep + 1),
  };

  return stripScriptTags(html).replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    if (key === "sequence_click_url") return clickUrl;
    if (!(key in replacements)) return `{{${key}}}`;
    return escapeHtml(replacements[key]);
  });
}

function renderSubject(subject: string, doctor: DoctorRegistration) {
  const tiktokUsername = (doctor.tiktok_username ?? "").trim().replace(/^@+/, "").toLowerCase();
  const replacements: Record<string, string> = {
    doctor_name: doctor.full_name ?? "",
    name_prefix: doctor.name_prefix ?? "",
    prefixed_name: formatPrefixedName(doctor.name_prefix, doctor.full_name),
    tiktok_username: tiktokUsername,
    specialty: doctor.specialty ?? "",
    clinic_location: doctor.practice_location ?? "",
  };
  return subject.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    return replacements[key] ?? `{{${key}}}`;
  });
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
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function stripScriptTags(html: string) {
  return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
