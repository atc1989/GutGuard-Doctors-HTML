import { createClient } from "https://esm.sh/@supabase/supabase-js@2.106.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SmsBlastRequest = {
  adminPassword?: string;
  doctorIds?: string[];
  title?: string;
  message?: string;
};

type DoctorRegistration = {
  id: string;
  full_name: string | null;
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
    const { adminPassword, doctorIds, title, message } = (await req.json()) as SmsBlastRequest;
    const cleanDoctorIds = Array.from(new Set(doctorIds ?? [])).filter(Boolean);
    const cleanTitle = (title ?? "").trim();
    const cleanMessage = (message ?? "").trim();

    if (!adminPassword) return jsonResponse({ error: "Missing adminPassword" }, 400);
    if (cleanDoctorIds.length === 0) return jsonResponse({ error: "No doctors selected" }, 400);
    if (!cleanTitle) return jsonResponse({ error: "Missing SMS campaign title" }, 400);
    if (!cleanMessage) return jsonResponse({ error: "Missing SMS message" }, 400);
    if (cleanMessage.length > 1_600) return jsonResponse({ error: "SMS message is too large" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Missing Edge Function secrets" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { error: adminError } = await supabase.rpc("assert_wheel_admin", {
      p_admin_password: adminPassword,
    });

    if (adminError) return jsonResponse({ error: "Invalid admin password" }, 401);

    const provider = getSmsProvider();
    if (!provider) {
      return jsonResponse(
        { error: "SMS provider is not configured. Choose and configure an SMS gateway before live sending." },
        501,
      );
    }

    const { data: campaign, error: campaignError } = await supabase
      .from("sms_campaigns")
      .insert({
        title: cleanTitle,
        message_template: cleanMessage,
        recipient_count: cleanDoctorIds.length,
        provider: provider.name,
      })
      .select("id")
      .single();

    if (campaignError || !campaign?.id) {
      return jsonResponse({ error: "SMS campaign could not be created" }, 500);
    }

    const { data: doctors, error: doctorsError } = await supabase
      .from("doctor_registrations")
      .select("id, full_name, mobile, tiktok_username, specialty, practice_location, created_at")
      .in("id", cleanDoctorIds);

    if (doctorsError) {
      return jsonResponse({ error: `Doctors could not be fetched: ${doctorsError.message}` }, 500);
    }

    const results = [];
    const prizeLabelsByDoctor = await getPrizeLabelsByDoctor(supabase, cleanDoctorIds);

    for (const doctor of (doctors ?? []) as DoctorRegistration[]) {
      doctor.prize_label = prizeLabelsByDoctor[doctor.id] ?? "";
      const mobile = normalizeSmsMobile(doctor.mobile);

      if (!mobile) {
        await recordSendAttempt(supabase, {
          smsCampaignId: campaign.id,
          doctorId: doctor.id,
          mobile: doctor.mobile ?? "",
          message: cleanMessage,
          status: "skipped",
          errorMessage: "Missing or invalid mobile number",
        });
        results.push({
          doctorId: doctor.id,
          mobile: doctor.mobile ?? "",
          status: "skipped",
          error: "Missing or invalid mobile number",
        });
        continue;
      }

      const renderedMessage = renderDoctorTemplate(cleanMessage, doctor);

      try {
        const providerMessageId = await provider.send({
          to: mobile,
          message: renderedMessage,
        });

        await recordSendAttempt(supabase, {
          smsCampaignId: campaign.id,
          doctorId: doctor.id,
          mobile,
          message: renderedMessage,
          status: "sent",
          providerMessageId,
        });
        results.push({ doctorId: doctor.id, mobile, status: "sent", providerMessageId });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unexpected SMS send error";
        await recordSendAttempt(supabase, {
          smsCampaignId: campaign.id,
          doctorId: doctor.id,
          mobile,
          message: renderedMessage,
          status: "failed",
          errorMessage,
        });
        results.push({ doctorId: doctor.id, mobile, status: "failed", error: errorMessage });
      }
    }

    const knownDoctorIds = new Set((doctors ?? []).map((doctor) => doctor.id));
    for (const missingId of cleanDoctorIds.filter((id) => !knownDoctorIds.has(id))) {
      await recordSendAttempt(supabase, {
        smsCampaignId: campaign.id,
        doctorId: missingId,
        mobile: "",
        message: cleanMessage,
        status: "skipped",
        errorMessage: "Doctor registration not found",
      });
      results.push({
        doctorId: missingId,
        mobile: "",
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

function getSmsProvider() {
  const providerName = (Deno.env.get("SMS_PROVIDER") ?? "").trim().toLowerCase();
  if (!providerName) return null;

  return {
    name: providerName,
    async send(_: { to: string; message: string }) {
      throw new Error(`SMS provider adapter "${providerName}" is not implemented yet.`);
    },
  };
}

async function recordSendAttempt(
  supabase: ReturnType<typeof createClient>,
  input: {
    smsCampaignId: string;
    doctorId: string;
    mobile: string;
    message: string;
    status: SendStatus;
    providerMessageId?: string | null;
    errorMessage?: string | null;
  },
) {
  await supabase.from("sms_sends").insert({
    sms_campaign_id: input.smsCampaignId,
    doctor_id: input.doctorId,
    mobile: input.mobile,
    message: input.message,
    status: input.status,
    provider_message_id: input.providerMessageId ?? null,
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

function renderDoctorTemplate(message: string, doctor: DoctorRegistration) {
  const replacements: Record<string, string> = {
    doctor_name: doctor.full_name ?? "",
    doctor_mobile: normalizeSmsMobile(doctor.mobile) || doctor.mobile || "",
    tiktok_username: doctor.tiktok_username ?? "",
    specialty: doctor.specialty ?? "",
    clinic_location: doctor.practice_location ?? "",
    registered_at: formatDate(doctor.created_at),
    prize_label: doctor.prize_label ?? "",
  };

  return message.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
    if (!(key in replacements)) return match;
    return replacements[key];
  });
}

function normalizeSmsMobile(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (/^09\d{9}$/.test(digits)) return `+63${digits.slice(1)}`;
  if (/^639\d{9}$/.test(digits)) return `+${digits}`;
  if (/^9\d{9}$/.test(digits)) return `+63${digits}`;
  return "";
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
