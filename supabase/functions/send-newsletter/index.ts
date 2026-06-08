import { createClient } from "https://esm.sh/@supabase/supabase-js@2.106.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type NewsletterRequest = {
  adminPassword?: string;
  doctorIds?: string[];
};

type DoctorRegistration = {
  id: string;
  full_name: string | null;
  email: string | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const { adminPassword, doctorIds } = (await req.json()) as NewsletterRequest;
    const cleanDoctorIds = Array.from(new Set(doctorIds ?? [])).filter(Boolean);

    if (!adminPassword) return jsonResponse({ error: "Missing adminPassword" }, 400);
    if (cleanDoctorIds.length === 0) return jsonResponse({ error: "No doctors selected" }, 400);

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail =
      Deno.env.get("NEWSLETTER_FROM_EMAIL") ??
      Deno.env.get("PROPOSAL_FROM_EMAIL") ??
      "GutGuard Doctors <onboarding@resend.dev>";
    const subject = Deno.env.get("NEWSLETTER_SUBJECT") ?? "GutGuard Doctors Newsletter";
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!resendApiKey || !supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Missing Edge Function secrets" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { error: adminError } = await supabase.rpc("assert_wheel_admin", {
      p_admin_password: adminPassword,
    });

    if (adminError) return jsonResponse({ error: "Invalid admin password" }, 401);

    const { data: doctors, error: doctorsError } = await supabase
      .from("doctor_registrations")
      .select("id, full_name, email")
      .in("id", cleanDoctorIds);

    if (doctorsError) return jsonResponse({ error: "Doctors could not be fetched" }, 500);

    const results = [];

    for (const doctor of (doctors ?? []) as DoctorRegistration[]) {
      const email = (doctor.email ?? "").trim().toLowerCase();

      if (!isValidEmail(email)) {
        await recordSendAttempt(supabase, {
          doctorId: doctor.id,
          email,
          subject,
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
            subject,
            html: newsletterEmailHtml(doctor.full_name ?? "Doctor"),
          }),
        });
        const resendBody = await resendResponse.json();

        if (!resendResponse.ok) {
          const message = stringifyError(resendBody);
          await recordSendAttempt(supabase, {
            doctorId: doctor.id,
            email,
            subject,
            status: "failed",
            errorMessage: message,
          });
          results.push({ doctorId: doctor.id, email, status: "failed", error: message });
          continue;
        }

        await recordSendAttempt(supabase, {
          doctorId: doctor.id,
          email,
          subject,
          status: "sent",
          resendId: resendBody.id,
        });
        results.push({ doctorId: doctor.id, email, status: "sent", resendId: resendBody.id });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unexpected send error";
        await recordSendAttempt(supabase, {
          doctorId: doctor.id,
          email,
          subject,
          status: "failed",
          errorMessage: message,
        });
        results.push({ doctorId: doctor.id, email, status: "failed", error: message });
      }
    }

    const knownDoctorIds = new Set((doctors ?? []).map((doctor) => doctor.id));
    for (const missingId of cleanDoctorIds.filter((id) => !knownDoctorIds.has(id))) {
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
    doctorId: string;
    email: string;
    subject: string;
    status: "sent" | "failed" | "skipped";
    resendId?: string | null;
    errorMessage?: string | null;
  },
) {
  await supabase.from("newsletter_sends").insert({
    doctor_id: input.doctorId,
    email: input.email,
    subject: input.subject,
    status: input.status,
    resend_id: input.resendId ?? null,
    error_message: input.errorMessage ?? null,
  });
}

function newsletterEmailHtml(fullName: string) {
  const safeName = escapeHtml(fullName);

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f4f1ea;color:#0f0f18;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      GutGuard Doctors update: onboarding reminders, TikTok tasks, and next steps.
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f1ea;">
      <tr>
        <td align="center" style="padding:22px 12px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background:#ffffff;border:1px solid #ded8ca;">
            <tr>
              <td style="background:#0608a9;padding:18px 24px;text-align:center;">
                <img src="https://gut-guard-doctors-html.vercel.app/gutguard-logo.png" width="44" alt="GutGuard" style="display:inline-block;border:0;vertical-align:middle;margin-right:8px;" />
                <span style="display:inline-block;color:#f4f1ea;font-size:18px;font-weight:700;vertical-align:middle;">GutGuard Doctors</span>
              </td>
            </tr>
            <tr>
              <td style="background:#0f0f18;padding:38px 28px 34px;text-align:left;">
                <p style="margin:0 0 12px;color:#c9ac7e;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Doctors' TikTok Affiliate Program</p>
                <h1 style="margin:0;color:#f4f1ea;font-family:Georgia,'Times New Roman',serif;font-size:38px;line-height:1.05;font-weight:400;">Your GutGuard activation starts here.</h1>
                <p style="margin:18px 0 0;color:#ebe7de;font-size:16px;line-height:1.55;">Hello Doctor ${safeName}, here are your quick reminders for completing your affiliate onboarding.</p>
              </td>
            </tr>
            <tr>
              <td style="background:#eaff18;padding:26px 28px;">
                <h2 style="margin:0 0 10px;color:#0f0f18;font-size:28px;line-height:1.12;font-weight:800;">Complete your TikTok steps</h2>
                <p style="margin:0;color:#0f0f18;font-size:16px;line-height:1.5;">Follow the official page, post your first introduction reel, and keep your registered TikTok username active for tracking.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;background:#ffffff;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="padding:18px;border:1px solid #e5e0d2;background:#f8f6ef;">
                      <p style="margin:0 0 8px;color:#0608a9;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">This Week's Checklist</p>
                      <p style="margin:0 0 10px;color:#0f0f18;font-size:18px;font-weight:700;">Keep these three items moving:</p>
                      <ul style="margin:0;padding-left:20px;color:#3a3a48;font-size:15px;line-height:1.7;">
                        <li>Confirm your email and review your onboarding documents.</li>
                        <li>Follow GutGuard on TikTok and Facebook.</li>
                        <li>Post your first short introduction reel.</li>
                      </ul>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 28px;background:#ffffff;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="padding:20px;background:#0608a9;color:#f4f1ea;">
                      <p style="margin:0 0 8px;color:#c9ac7e;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Booth Reminder</p>
                      <p style="margin:0;color:#ffffff;font-size:20px;line-height:1.35;font-weight:700;">After completing verification, proceed to the GutGuard exhibitor for your prize wheel spin.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:4px 28px 32px;background:#ffffff;">
                <a href="https://www.tiktok.com/@gutguardph" style="display:inline-block;background:#0f0f18;color:#f4f1ea;text-decoration:none;font-size:15px;font-weight:700;padding:15px 24px;">Visit GutGuard TikTok</a>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 28px;background:#ebe7de;text-align:center;">
                <p style="margin:0;color:#6b6b7a;font-size:12px;line-height:1.5;">GutGuard Doctors | Innovision Grand International OPC<br />FDA CPR No. FR-40000015571456</p>
                <p style="margin:14px 0 0;color:#6b6b7a;font-size:11px;line-height:1.5;">You are receiving this email because you registered for the GutGuard Doctors TikTok Affiliate Program.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
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
