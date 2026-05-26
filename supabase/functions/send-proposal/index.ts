import { createClient } from "https://esm.sh/@supabase/supabase-js@2.106.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ProposalRequest = {
  registrationId?: string;
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
    if (!registrationId) {
      return jsonResponse({ error: "Missing registrationId" }, 400);
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail =
      Deno.env.get("PROPOSAL_FROM_EMAIL") ?? "GutGuard Doctors <onboarding@resend.dev>";
    const proposalPdfUrl = Deno.env.get("PROPOSAL_PDF_URL");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!resendApiKey || !proposalPdfUrl || !supabaseUrl || !serviceRoleKey) {
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

    const pdfResponse = await fetch(proposalPdfUrl);
    if (!pdfResponse.ok) {
      return jsonResponse({ error: "Proposal PDF could not be fetched" }, 500);
    }

    const pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer());
    const pdfBase64 = toBase64(pdfBytes);

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [registration.email],
        subject: "Your GutGuard Doctors TikTok Affiliate Proposal",
        html: proposalEmailHtml(registration.full_name, proposalPdfUrl),
        attachments: [
          {
            filename: "GutGuard_Doctor_TikTok_Proposal.pdf",
            content: pdfBase64,
          },
        ],
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

function proposalEmailHtml(fullName: string, proposalUrl: string) {
  const safeName = escapeHtml(fullName);
  const safeProposalUrl = escapeHtml(proposalUrl);

  return `
    <div style="font-family:Arial,sans-serif;color:#0F0F18;line-height:1.6">
      <p>Dear ${safeName},</p>
      <p>Thank you for registering for the GutGuard Doctors' TikTok Affiliate Program.</p>
      <p>Your proposal PDF is attached to this email. You may also view it here:</p>
      <p><a href="${safeProposalUrl}">${safeProposalUrl}</a></p>
      <p>With our compliments,<br/>GutGuard Doctors</p>
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
