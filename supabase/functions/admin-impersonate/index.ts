// "Log in as this doctor" for the admin doctors list.
//
// Mints a one-time magic link for a registered partner and hands it back to the caller;
// GoTrue does not email it. Opening the link establishes a real partner session, so the
// portal runs under the doctor's own JWT and every partner RPC resolves identity the
// normal way (auth.jwt() ->> 'email'). Nothing about the impersonation path lives in the
// data-access functions.
//
// The only gate is the shared admin password. A leaked password therefore reaches any
// partner account, and the audit row can only say "an admin" - see the migration note.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.106.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ImpersonateRequest = {
  adminPassword?: string;
  email?: string;
  redirectTo?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const request = (await req.json()) as ImpersonateRequest;
    if (!request.adminPassword) return jsonResponse({ error: "Missing adminPassword" }, 400);

    const email = (request.email ?? "").trim().toLowerCase();
    if (!email) return jsonResponse({ error: "Missing email" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: "Missing Supabase Edge Function secrets" }, 500);

    const supabase = createClient(supabaseUrl, serviceRoleKey, { db: { schema: "doctors" } });
    const { error: adminError } = await supabase.rpc("assert_wheel_admin", {
      p_admin_password: request.adminPassword,
    });
    if (adminError) return jsonResponse({ error: "Invalid admin password" }, 401);

    // Only a registered partner can be impersonated. Without this the service role would
    // happily mint a session for any address an admin typed, including one that is not a
    // partner at all - and partner_dashboard would then fail in a confusing way.
    const { data: doctor, error: doctorError } = await supabase
      .from("doctor_registrations")
      .select("id, email, full_name")
      .eq("email", email)
      .maybeSingle();
    if (doctorError) return jsonResponse({ error: doctorError.message }, 500);
    if (!doctor) return jsonResponse({ error: "This email is not a registered partner." }, 404);

    // Partner rows predate the partner login, so many have no auth.users entry yet. The
    // real sign-in flow passes shouldCreateUser: true; create the confirmed user here for
    // the same reason, otherwise magiclink generation fails for every legacy partner.
    let link = await generateMagicLink(supabase, email, request.redirectTo);
    if (!link.ok && isMissingUser(link.error)) {
      const { error: createError } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
      });
      if (createError) return jsonResponse({ error: createError.message }, 500);
      link = await generateMagicLink(supabase, email, request.redirectTo);
    }
    if (!link.ok) return jsonResponse({ error: link.error }, 500);

    // Logged only once a link actually exists, so a row always means real access.
    const { error: logError } = await supabase.from("admin_impersonation_log").insert({
      doctor_id: doctor.id,
      doctor_email: email,
      source_ip: req.headers.get("x-forwarded-for") ?? "",
      user_agent: req.headers.get("user-agent") ?? "",
    });
    // An unwritable audit row must not silently become an unaudited login.
    if (logError) return jsonResponse({ error: `Impersonation not recorded: ${logError.message}` }, 500);

    return jsonResponse({ actionLink: link.actionLink, fullName: doctor.full_name });
  } catch (caught) {
    return jsonResponse({ error: caught instanceof Error ? caught.message : "Unexpected error" }, 500);
  }
});

type LinkResult = { ok: true; actionLink: string } | { ok: false; error: string };

/**
 * redirectTo is passed through to GoTrue, which refuses any target that is not on the
 * project's URI allow list - the same guard the partner's own sign-in relies on. That
 * list, not this function, is what keeps the link from being redirected off-site.
 */
async function generateMagicLink(
  supabase: ReturnType<typeof createClient>,
  email: string,
  redirectTo?: string,
): Promise<LinkResult> {
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: redirectTo ? { redirectTo } : undefined,
  });

  if (error) return { ok: false, error: error.message };

  const actionLink = data?.properties?.action_link ?? "";
  if (!actionLink) return { ok: false, error: "Auth returned no action link." };
  return { ok: true, actionLink };
}

function isMissingUser(message: string) {
  return /not found|no user|does not exist/i.test(message);
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
