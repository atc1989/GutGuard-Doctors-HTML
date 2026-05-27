import { createClient } from "https://esm.sh/@supabase/supabase-js@2.106.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ProposalRequest = {
  registrationId?: string;
};

type AttachmentConfig = {
  filename: string;
  path: string;
  required?: boolean;
};

const ATTACHMENTS: AttachmentConfig[] = [
  {
    filename: "01_TikTok_Affiliate_Onboarding.pdf",
    path: "/01_TikTok_Affiliate_Onboarding.pdf",
  },
  {
    filename: "02_LCA_Compensation_Program.pdf",
    path: "/02_LCA_Compensation_Program.pdf",
  },
  {
    filename: "03_LCA_Short_Form_Consent.pdf",
    path: "/03_LCA_Short_Form_Consent.pdf",
  },
  {
    filename: "04_LCA_Detailed_Terms_Annex.pdf",
    path: "/04_LCA_Detailed_Terms_Annex.pdf",
  },
  {
    filename: "05_LCA_Announcements_and_FAQ.pdf",
    path: "/05_LCA_Announcements_and_FAQ.pdf",
  },
  {
    filename: "06_LCA_Clinical_Dosing_Guide.pdf",
    path: "/06_LCA_Clinical_Dosing_Guide.pdf",
    required: false,
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const { registrationId } = (await req.json()) as ProposalRequest;
    if (!registrationId) {
      return jsonResponse({ error: "Missing registrationId" }, 400);
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail =
      Deno.env.get("PROPOSAL_FROM_EMAIL") ?? "GutGuard Doctors <onboarding@resend.dev>";
    const attachmentBaseUrl = getAttachmentBaseUrl();
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!resendApiKey || !supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Missing Edge Function secrets" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: registration, error: registrationError } = await supabase
      .from("doctor_registrations")
      .select("full_name, email")
      .eq("id", registrationId)
      .single();

    if (registrationError || !registration) {
      return jsonResponse({ error: "Registration not found" }, 404);
    }

    const { count: registeredCount, error: countError } = await supabase
      .from("doctor_registrations")
      .select("id", { count: "exact", head: true });

    if (countError) {
      return jsonResponse({ error: "Registration count could not be fetched" }, 500);
    }

    const attachmentResults = await Promise.all(
      ATTACHMENTS.map((attachment) => fetchAttachment(attachmentBaseUrl, attachment)),
    );
    const attachments = attachmentResults
      .filter((item): item is { filename: string; content: string } => item !== null);


    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [registration.email],
        subject: "Gutguard Doctors TikTok Proposal",
        html: proposalEmailHtml(registration.full_name, Math.min(registeredCount ?? 1, 100)),
        attachments,
      }),
    });

    const resendBody = await resendResponse.json();
    if (!resendResponse.ok) {
      return jsonResponse({ error: "Email send failed", details: resendBody }, 502);
    }

    return jsonResponse({ sent: true, resendId: resendBody.id });
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

function toBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function getAttachmentBaseUrl() {
  const explicitBaseUrl = Deno.env.get("ATTACHMENT_BASE_URL") ?? Deno.env.get("PUBLIC_SITE_URL");
  if (explicitBaseUrl) return explicitBaseUrl.replace(/\/$/, "");

  const legacyPdfUrl = Deno.env.get("PROPOSAL_PDF_URL");
  if (legacyPdfUrl) return new URL(legacyPdfUrl).origin;

  return "https://gut-guard-doctors-html.vercel.app";
}

async function fetchAttachment(baseUrl: string, attachment: AttachmentConfig) {
  const response = await fetch(`${baseUrl}${attachment.path}`);
  if (!response.ok) {
    if (attachment.required === false) {
      console.warn(`Optional attachment skipped: ${attachment.filename}`);
      return null;
    }

    throw new Error(`${attachment.filename} could not be fetched`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());

  return {
    filename: attachment.filename,
    content: toBase64(bytes),
  };
}

function proposalEmailHtml(fullName: string, registeredCount: number) {
  const safeName = escapeHtml(fullName);

  return `
    <div style="font-family:Arial,sans-serif;color:#0F0F18;line-height:1.6">
      <p>&#127807; Welcome, Doctor ${safeName}.</p>
      <p>
        You're now part of the GutGuard Lead Clinical Adopter (LCA)<br/>
        community. Read this pinned message first &mdash; it saves<br/>
        you (and us) repeat questions later.
      </p>
      <p>
        &bull; Founding cohort: 100 physicians, lifetime designation<br/>
        &bull; Active pilot: First 20 LCAs, 90-day program<br/>
        &bull; Waitlist: Positions 21&ndash;100, activated post-pilot
      </p>
      <p>Current slot count: ${registeredCount} of 100 confirmed.</p>
      <p>Please see attached email for your perusal.</p>
    </div>
  `;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
