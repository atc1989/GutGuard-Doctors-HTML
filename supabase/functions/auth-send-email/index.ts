import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, webhook-id, webhook-timestamp, webhook-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: { message: "Method not allowed" } }, 405);

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const hookSecret = (Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? "").replace("v1,whsec_", "");
  if (!resendKey || !hookSecret) return json({ error: { message: "Missing email secrets" } }, 500);

  try {
    const payload = await req.text();
    const { user, email_data } = new Webhook(hookSecret).verify(payload, Object.fromEntries(req.headers)) as {
      user: { email: string };
      email_data: {
        token?: string;
        token_hash?: string;
        redirect_to?: string;
        email_action_type?: string;
      };
    };

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const type = email_data.email_action_type || "magiclink";
    const confirmUrl = `${supabaseUrl}/auth/v1/verify?token=${email_data.token_hash ?? ""}&type=${type}&redirect_to=${encodeURIComponent(email_data.redirect_to || "")}`;
    const from =
      Deno.env.get("PROPOSAL_FROM_EMAIL") ??
      "GutGuard <gutguardhq@gutguard.ph>";

    const resend = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [user.email],
        subject: "Your GutGuard sign-in code",
        html: `<h2>Your GutGuard sign-in code</h2>
<p>Enter this code to continue:</p>
<p style="font-size:24px;letter-spacing:4px"><strong>${email_data.token ?? ""}</strong></p>
<p>Or <a href="${confirmUrl}">sign in with this link</a>. It expires shortly and can only be used once.</p>`,
      }),
    });

    if (!resend.ok) throw new Error(await resend.text());
  } catch (error) {
    return json({ error: { http_code: 401, message: error instanceof Error ? error.message : "hook failed" } }, 401);
  }

  return json({});
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
