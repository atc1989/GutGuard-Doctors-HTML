/*
 * Every text the shop sends a customer: the paid receipt, the courier notice, and the checkout
 * verification code.
 *
 * Its own function rather than a branch of send-shop-order-email, for two reasons:
 *  - the offline-payment route only calls the email function when the order has an email
 *    address, so an order with a mobile and no email would never be texted;
 *  - "shipped" and "otp" send no email at all.
 *
 * Service role only. There is no browser-callable kind here: the shop's OTP routes invoke this
 * with the service key, so a leaked order id cannot be used to text somebody repeatedly.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.106.2";
import { serveWithCors } from "../_shared/cors.ts";
import { isServiceRoleRequest } from "../_shared/service-auth.ts";
import {
  getSmsProvider,
  smsProviderEnvVar,
  normalizeSmsMobile,
  orderSmsMessages,
  otpMessage,
  textsCustomer,
  type OrderSms,
  type SmsKind,
} from "../_shared/sms.ts";

const PROD_SITE_URL = (Deno.env.get("SHOP_SITE_URL") ?? "https://gutguard.ph").replace(/\/$/, "");
const SANDBOX_SITE_URL = (Deno.env.get("SHOP_SANDBOX_SITE_URL") ?? PROD_SITE_URL).replace(/\/$/, "");

/** Long enough to find the text, short enough that a shoulder-surfed code is useless. */
const OTP_TTL_MINUTES = 10;
/** A 6-digit code brute-forces in 1,000,000 tries; five is plenty for a typo. */
const OTP_MAX_ATTEMPTS = 5;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type RequestPayload = {
  orderId?: string;
  /** "paid" and "shipped" text the customer about the order; "otp" verifies their number. */
  kind?: SmsKind | "otp";
  /** "otp" only: "send" mails a new code, "verify" checks one the buyer typed. */
  action?: "send" | "verify";
  code?: string;
  /** Which Postgres schema holds the order. "sandbox" for the mirrored system. */
  schema?: string;
};

type ShopOrder = {
  id: string;
  order_code: string;
  payment_status: string;
  mobile: string | null;
  tracking_status?: string | null;
};

serveWithCors(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    if (!(await isServiceRoleRequest(req))) return jsonResponse({ error: "Forbidden" }, 403);

    const { orderId, kind = "paid", action = "send", code, schema } = (await req.json()) as RequestPayload;
    const dbSchema = schema === "sandbox" || schema === "doctors" || schema === "public" ? schema : "doctors";
    if (!orderId) return jsonResponse({ error: "Missing orderId" }, 400);
    if (kind !== "otp" && !textsCustomer(kind)) return jsonResponse({ error: `Unknown SMS kind "${kind}"` }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: "Missing Edge Function secrets" }, 500);

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    // tracking_status is only read for the courier notice: asking for a column a schema does not
    // have makes PostgREST reject the whole select, and the fulfilment migration is newer than
    // some deployments of this one.
    const columns = kind === "shipped"
      ? "id, order_code, payment_status, mobile, tracking_status"
      : "id, order_code, payment_status, mobile";
    const { data, error } = await supabase
      .schema(dbSchema)
      .from("shop_orders")
      .select(columns)
      .eq("id", orderId)
      .single();

    if (error || !data) return jsonResponse({ error: "Order not found" }, 404);
    const order = data as unknown as ShopOrder;

    if (kind === "otp") {
      return action === "verify"
        ? await verifyOtp(supabase, dbSchema, order, code)
        : await sendOtp(supabase, dbSchema, order);
    }

    // An unpaid order can never text, and the courier notice only goes out once the parcel is
    // actually with the courier.
    if (kind === "paid" && order.payment_status !== "paid") {
      return jsonResponse({ error: "Order payment is not confirmed" }, 409);
    }
    if (kind === "shipped" && order.tracking_status !== "in_transit") {
      return jsonResponse({ error: "Order is not with the courier" }, 409);
    }

    const provider = getSmsProvider(smsProviderEnvVar(dbSchema));
    if (!provider) return jsonResponse({ sent: false, skipped: true, reason: "no provider" });

    const siteUrl = dbSchema === "sandbox" ? SANDBOX_SITE_URL : PROD_SITE_URL;
    const messages = orderSmsMessages(order, kind, siteUrl);
    // A missing number is not an error: the receipt email still has to go out.
    if (!messages.length) return jsonResponse({ sent: false, skipped: true, reason: "no mobile" });

    const results: Array<{ audience: string; status: string }> = [];
    for (const sms of messages) {
      results.push(await sendOne(supabase, dbSchema, order, kind, sms, provider, siteUrl));
    }

    return jsonResponse({
      sent: results.some((result) => result.status === "sent"),
      duplicate: results.every((result) => result.status === "duplicate"),
      provider: provider.name,
      results,
    });
  } catch (sendError) {
    const message = sendError instanceof Error ? sendError.message : String(sendError);
    console.error(`send-order-sms failed: ${message}`);
    return jsonResponse({ error: message }, 500);
  }
});

async function sendOne(
  supabase: ReturnType<typeof createClient>,
  schema: string,
  order: ShopOrder,
  kind: SmsKind,
  sms: OrderSms,
  provider: { name: string; send: (input: { to: string; message: string }) => Promise<string | null> },
  siteUrl: string,
) {
  // sms.test.ts holds the copy to one segment for the origins we ship, but a long preview origin
  // could still push it over. Say so rather than quietly bill two credits.
  if (sms.message.length > 160) {
    console.warn(
      `SMS ${kind} for ${order.order_code} is ${sms.message.length} characters: 2 credits. Origin ${siteUrl}.`,
    );
  }

  try {
    // ponytail: check-then-send. Two callers racing can still send twice; the unique index in
    // the migration keeps the second row out, so a duplicate is visible rather than silent.
    const { data: already } = await supabase
      .schema(schema)
      .from("shop_order_sms_sends")
      .select("order_id")
      .eq("order_id", order.id)
      .eq("kind", kind)
      .eq("mobile", sms.to)
      .eq("status", "sent")
      .limit(1);
    if (already?.length) return { audience: sms.audience, status: "duplicate" };

    const messageId = await provider.send({ to: sms.to, message: sms.message });
    // Sent is sent: the customer has the text whatever the log does next, so never let a failed
    // insert report a delivered message as a failure.
    recordAttempt(supabase, schema, order.id, kind, sms.to, provider.name, { status: "sent", messageId }).catch(
      (logError) => console.error(`SMS ${kind} sent but not logged for ${order.order_code}: ${logError}`),
    );
    return { audience: sms.audience, status: "sent" };
  } catch (sendError) {
    const errorMessage = sendError instanceof Error ? sendError.message : String(sendError);
    await recordAttempt(supabase, schema, order.id, kind, sms.to, provider.name, {
      status: "failed",
      errorMessage,
    }).catch(() => {});
    console.error(`SMS ${kind} for order ${order.order_code} failed: ${errorMessage}`);
    return { audience: sms.audience, status: "failed" };
  }
}

async function recordAttempt(
  supabase: ReturnType<typeof createClient>,
  schema: string,
  orderId: string,
  kind: string,
  mobile: string,
  provider: string,
  outcome: { status: "sent" | "failed"; messageId?: string | null; errorMessage?: string },
) {
  const { error } = await supabase.schema(schema).from("shop_order_sms_sends").insert({
    order_id: orderId,
    mobile,
    kind,
    status: outcome.status,
    provider,
    provider_message_id: outcome.messageId ?? null,
    error_message: outcome.errorMessage ?? null,
  });
  if (error) throw new Error(error.message);
}

/**
 * Texts a fresh code and keeps only its hash. Resending replaces the stored code, so the last
 * text is the only one that works.
 */
async function sendOtp(supabase: ReturnType<typeof createClient>, schema: string, order: ShopOrder) {
  const mobile = normalizeSmsMobile(order.mobile);
  if (!mobile) return jsonResponse({ error: "Order has no mobile number" }, 400);

  const provider = getSmsProvider(smsProviderEnvVar(schema));
  if (!provider) return jsonResponse({ sent: false, skipped: true, reason: "no provider" });

  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
  const { error: saveError } = await supabase
    .schema(schema)
    .from("shop_mobile_otps")
    .upsert(
      {
        order_id: order.id,
        mobile,
        code_hash: await sha256Hex(code),
        expires_at: new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString(),
        attempts: 0,
        verified_at: null,
      },
      { onConflict: "order_id" },
    );
  // Storing the code must come first: a text whose code was never saved can only ever fail.
  if (saveError) throw new Error(`Could not store the checkout code: ${saveError.message}`);

  await provider.send({ to: mobile, message: otpMessage(code, OTP_TTL_MINUTES) });
  return jsonResponse({ sent: true, provider: provider.name, expiresInMinutes: OTP_TTL_MINUTES });
}

/** Checks a code the buyer typed. Never says whether the code was wrong or merely expired. */
async function verifyOtp(
  supabase: ReturnType<typeof createClient>,
  schema: string,
  order: ShopOrder,
  code: string | undefined,
) {
  const typed = (code ?? "").replace(/\D/g, "");
  if (typed.length !== 6) return jsonResponse({ verified: false, error: "Enter the 6-digit code" }, 400);

  const { data, error } = await supabase
    .schema(schema)
    .from("shop_mobile_otps")
    .select("order_id, mobile, code_hash, expires_at, attempts, verified_at")
    .eq("order_id", order.id)
    .maybeSingle();
  if (error) throw new Error(`Could not read the checkout code: ${error.message}`);
  if (!data) return jsonResponse({ verified: false, error: "Ask for a new code" }, 400);

  const otp = data as {
    mobile: string;
    code_hash: string;
    expires_at: string;
    attempts: number;
    verified_at: string | null;
  };
  // Verifying twice is not a failure: the buyer may retry a payment that never started.
  if (otp.verified_at) return jsonResponse({ verified: true });
  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    return jsonResponse({ verified: false, error: "Too many attempts. Ask for a new code" }, 429);
  }
  if (new Date(otp.expires_at).getTime() < Date.now()) {
    return jsonResponse({ verified: false, error: "That code expired. Ask for a new one" }, 400);
  }

  if (!timingSafeEqual(await sha256Hex(typed), otp.code_hash)) {
    await supabase
      .schema(schema)
      .from("shop_mobile_otps")
      .update({ attempts: otp.attempts + 1 })
      .eq("order_id", order.id);
    return jsonResponse(
      { verified: false, error: "That code does not match", attemptsLeft: OTP_MAX_ATTEMPTS - otp.attempts - 1 },
      400,
    );
  }

  const { error: markError } = await supabase
    .schema(schema)
    .from("shop_mobile_otps")
    .update({ verified_at: new Date().toISOString() })
    .eq("order_id", order.id);
  // Without the mark, the checkout gate would refuse the payment the buyer just unlocked.
  if (markError) throw new Error(`Could not record the verification: ${markError.message}`);

  return jsonResponse({ verified: true });
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return diff === 0;
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
