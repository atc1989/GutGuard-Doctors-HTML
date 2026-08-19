import { createClient } from "https://esm.sh/@supabase/supabase-js@2.106.2";

// Deploy with JWT verification off (same as send-proposal). Registration is anonymous,
// so the partner portal cannot attach a user JWT when a new doctor is created.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const { registrationId } = (await req.json()) as { registrationId?: string };
    if (!registrationId) return json({ error: "Missing registrationId" }, 400);
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!url || !key || !resendKey) return json({ error: "Missing Edge Function secrets" }, 500);
    const db = createClient(url, key, { db: { schema: "doctors" } });

    const { data: child } = await db
      .from("doctor_registrations")
      .select("id, full_name, specialty, practice_location, created_at, referred_by_partner_id")
      .eq("id", registrationId)
      .single();
    if (!child?.referred_by_partner_id) {
      return json({ sent: false, skipped: true, reason: "Registration has no referrer" });
    }
    const { data: referrer } = await db
      .from("doctor_registrations")
      .select("id, full_name, email")
      .eq("id", child.referred_by_partner_id)
      .single();
    const recipient = String(referrer?.email ?? "").trim().toLowerCase();
    if (!referrer || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      return json({ sent: false, skipped: true, reason: "Referrer has no valid email" });
    }
    const { data: existing } = await db
      .from("partner_referral_email_sends")
      .select("resend_id")
      .eq("registration_id", registrationId)
      .eq("status", "sent")
      .maybeSingle();
    if (existing) return json({ sent: true, duplicate: true, resendId: existing.resend_id });
    const { data: settings } = await db.from("partner_referral_email_settings").select("*").eq("id", 1).single();
    if (!settings?.enabled) {
      return json({ sent: false, skipped: true, reason: "Referral notifications are disabled" });
    }

    const { data: attempt, error: attemptError } = await db
      .from("partner_referral_email_sends")
      .insert({
        registration_id: registrationId,
        referrer_id: referrer.id,
        recipient_email: recipient,
        subject: settings.subject,
        status: "sending",
      })
      .select("id")
      .single();
    if (attemptError) {
      return json({ sent: false, duplicate: true, reason: "Notification is already in progress" });
    }
    const replacements: Record<string, string> = {
      partner_name: referrer.full_name ?? "",
      new_partner_name: child.full_name ?? "",
      new_partner_specialty: child.specialty ?? "",
      new_partner_location: child.practice_location ?? "",
      registered_at: new Date(child.created_at).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
      dashboard_url: `${(Deno.env.get("PUBLIC_SITE_URL") ?? "https://partners.gutguard.ph").replace(/\/$/, "")}/partner`,
    };
    const render = (value: string) =>
      value.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, k) => escapeHtml(replacements[k] ?? `{{${k}}}`));
    const template = String(settings.html_template ?? "").trim() || renderBodyText(String(settings.body_text ?? ""));
    if (!String(settings.subject ?? "").trim() || !template) {
      await db
        .from("partner_referral_email_sends")
        .update({
          status: "skipped",
          error_message: "Template is incomplete",
          updated_at: new Date().toISOString(),
        })
        .eq("id", attempt.id);
      return json({ sent: false, skipped: true, reason: "Referral notification template is incomplete" });
    }
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from:
          Deno.env.get("PARTNER_REFERRAL_FROM_EMAIL") ??
          Deno.env.get("REGISTRATION_FROM_EMAIL") ??
          "GutGuard Partners <onboarding@resend.dev>",
        to: [recipient],
        subject: render(String(settings.subject)),
        html: render(template),
        reply_to: String(settings.reply_to ?? "").trim() || undefined,
      }),
    });
    const body = await response.json();
    await db
      .from("partner_referral_email_sends")
      .update(
        response.ok
          ? { status: "sent", resend_id: body.id, updated_at: new Date().toISOString() }
          : { status: "failed", error_message: JSON.stringify(body), updated_at: new Date().toISOString() },
      )
      .eq("id", attempt.id);
    return response.ok ? json({ sent: true, resendId: body.id }) : json({ error: "Email send failed" }, 502);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function renderBodyText(value: string) {
  return `<div style="font-family:Arial,sans-serif;color:#0F0F18;line-height:1.6">${escapeHtml(value)
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("")}</div>`;
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
