import { createClient } from "https://esm.sh/@supabase/supabase-js@2.106.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type NewsletterRequest = {
  adminPassword?: string;
  doctorIds?: string[];
  subject?: string;
  html?: string;
};

type DoctorRegistration = {
  id: string;
  full_name: string | null;
  email: string | null;
  mobile: string | null;
  tiktok_username: string | null;
  specialty: string | null;
  practice_location: string | null;
  created_at: string | null;
  prize_label?: string | null;
};

type SendStatus = "sent" | "failed" | "skipped";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const { adminPassword, doctorIds, subject, html } = (await req.json()) as NewsletterRequest;
    const cleanDoctorIds = Array.from(new Set(doctorIds ?? [])).filter(Boolean);
    const cleanSubject = (subject ?? "").trim();
    const cleanHtml = stripScriptTags(html ?? "").trim();

    if (!adminPassword) return jsonResponse({ error: "Missing adminPassword" }, 400);
    if (cleanDoctorIds.length === 0) return jsonResponse({ error: "No doctors selected" }, 400);
    if (!cleanSubject) return jsonResponse({ error: "Missing newsletter subject" }, 400);
    if (!cleanHtml) return jsonResponse({ error: "Missing newsletter HTML" }, 400);
    if (cleanHtml.length > 250_000) return jsonResponse({ error: "Newsletter HTML is too large" }, 400);

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail =
      Deno.env.get("NEWSLETTER_FROM_EMAIL") ??
      Deno.env.get("PROPOSAL_FROM_EMAIL") ??
      "GutGuard Doctors <onboarding@resend.dev>";
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!resendApiKey || !supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Missing Edge Function secrets" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, { db: { schema: "doctors" } });
    const { error: adminError } = await supabase.rpc("assert_wheel_admin", {
      p_admin_password: adminPassword,
    });

    if (adminError) return jsonResponse({ error: "Invalid admin password" }, 401);

    const { data: campaign, error: campaignError } = await supabase
      .from("newsletter_campaigns")
      .insert({
        title: cleanSubject,
        subject: cleanSubject,
        html_template: cleanHtml,
        recipient_count: cleanDoctorIds.length,
      })
      .select("id")
      .single();

    if (campaignError || !campaign?.id) {
      return jsonResponse({ error: "Newsletter campaign could not be created" }, 500);
    }

    const { data: doctors, error: doctorsError } = await supabase
      .from("doctor_registrations")
      .select("id, full_name, email, mobile, tiktok_username, specialty, practice_location, created_at")
      .in("id", cleanDoctorIds);

    if (doctorsError) {
      return jsonResponse({ error: `Doctors could not be fetched: ${doctorsError.message}` }, 500);
    }

    const results = [];
    const prizeLabelsByDoctor = await getPrizeLabelsByDoctor(supabase, cleanDoctorIds);

    for (const doctor of (doctors ?? []) as DoctorRegistration[]) {
      doctor.prize_label = prizeLabelsByDoctor[doctor.id] ?? "";
      const email = (doctor.email ?? "").trim().toLowerCase();

      if (!isValidEmail(email)) {
        await recordSendAttempt(supabase, {
          newsletterId: campaign.id,
          doctorId: doctor.id,
          email,
          subject: cleanSubject,
          status: "skipped",
          errorMessage: "Missing or invalid email address",
        });
        results.push({
          doctorId: doctor.id,
          email,
          status: "skipped",
          error: "Missing or invalid email address",
        });
        continue;
      }

      try {
        const resendResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [email],
            subject: cleanSubject,
            html: renderDoctorTemplate(cleanHtml, doctor),
          }),
        });
        const resendBody = await resendResponse.json();

        if (!resendResponse.ok) {
          const message = stringifyError(resendBody);
          await recordSendAttempt(supabase, {
            newsletterId: campaign.id,
            doctorId: doctor.id,
            email,
            subject: cleanSubject,
            status: "failed",
            errorMessage: message,
          });
          results.push({ doctorId: doctor.id, email, status: "failed", error: message });
          continue;
        }

        await recordSendAttempt(supabase, {
          newsletterId: campaign.id,
          doctorId: doctor.id,
          email,
          subject: cleanSubject,
          status: "sent",
          resendId: resendBody.id,
        });
        results.push({ doctorId: doctor.id, email, status: "sent", resendId: resendBody.id });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unexpected send error";
        await recordSendAttempt(supabase, {
          newsletterId: campaign.id,
          doctorId: doctor.id,
          email,
          subject: cleanSubject,
          status: "failed",
          errorMessage: message,
        });
        results.push({ doctorId: doctor.id, email, status: "failed", error: message });
      }
    }

    const knownDoctorIds = new Set((doctors ?? []).map((doctor) => doctor.id));
    for (const missingId of cleanDoctorIds.filter((id) => !knownDoctorIds.has(id))) {
      await recordSendAttempt(supabase, {
        newsletterId: campaign.id,
        doctorId: missingId,
        email: "",
        subject: cleanSubject,
        status: "skipped",
        errorMessage: "Doctor registration not found",
      });
      results.push({
        doctorId: missingId,
        email: "",
        status: "skipped",
        error: "Doctor registration not found",
      });
    }

    return jsonResponse({
      sent: results.filter((result) => result.status === "sent").length,
      failed: results.filter((result) => result.status === "failed").length,
      skipped: results.filter((result) => result.status === "skipped").length,
      results,
    });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      500,
    );
  }
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

async function recordSendAttempt(
  supabase: ReturnType<typeof createClient>,
  input: {
    newsletterId: string;
    doctorId: string;
    email: string;
    subject: string;
    status: SendStatus;
    resendId?: string | null;
    errorMessage?: string | null;
  },
) {
  await supabase.from("newsletter_sends").insert({
    newsletter_id: input.newsletterId,
    doctor_id: input.doctorId,
    email: input.email,
    subject: input.subject,
    status: input.status,
    resend_id: input.resendId ?? null,
    error_message: input.errorMessage ?? null,
  });
}

async function getPrizeLabelsByDoctor(supabase: ReturnType<typeof createClient>, doctorIds: string[]) {
  const { data, error } = await supabase
    .from("wheel_claims")
    .select("doctor_id, prize_label, claimed_at")
    .in("doctor_id", doctorIds)
    .order("claimed_at", { ascending: false });

  if (error) return {};

  return ((data ?? []) as Array<{ doctor_id: string; prize_label: string | null }>).reduce<Record<string, string>>(
    (current, claim) => {
      if (!current[claim.doctor_id]) current[claim.doctor_id] = claim.prize_label ?? "";
      return current;
    },
    {},
  );
}

function renderDoctorTemplate(html: string, doctor: DoctorRegistration) {
  const replacements: Record<string, string> = {
    doctor_name: doctor.full_name ?? "",
    doctor_email: doctor.email ?? "",
    doctor_mobile: doctor.mobile ?? "",
    tiktok_username: doctor.tiktok_username ?? "",
    specialty: doctor.specialty ?? "",
    clinic_location: doctor.practice_location ?? "",
    registered_at: formatDate(doctor.created_at),
    prize_label: doctor.prize_label ?? "",
  };

  return html.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
    if (!(key in replacements)) return match;
    return escapeHtml(replacements[key]);
  });
}

function formatDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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
