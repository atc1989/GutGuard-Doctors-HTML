import { NextResponse } from "next/server";
import { getMayaPayment, isMayaConfigured, MayaApiError } from "@/lib/maya";
import { applyPaymentToOrder } from "@/lib/maya-orders";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Maya's webhook payload carries no signature, so the only field trusted here is the
 * payment id. Everything that decides money state is re-fetched from Maya with the
 * secret key, which makes a spoofed POST harmless on its own.
 * Optional IP allowlisting is layered on top via MAYA_WEBHOOK_IPS.
 */
export async function POST(request: Request) {
  if (!isMayaConfigured || !isSupabaseAdminConfigured) {
    return NextResponse.json({ error: "Payments are not configured." }, { status: 503 });
  }

  if (!isAllowedIp(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let paymentId = "";
  try {
    const body = (await request.json()) as { id?: string; paymentId?: string };
    paymentId = body.id ?? body.paymentId ?? "";
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  if (!paymentId) return NextResponse.json({ error: "Missing payment id" }, { status: 400 });

  try {
    const payment = await getMayaPayment(paymentId);
    const reference = payment.requestReferenceNumber ?? "";
    if (!reference) return NextResponse.json({ error: "Payment has no reference number" }, { status: 422 });

    // Retries carry a "-2" style suffix; the order code is the part before it.
    const orderCode = reference.replace(/-\d+$/, "");

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("shop_orders")
      .select("id, status, payment_status, maya_payment_id, maya_payment_status")
      .eq("order_code", orderCode)
      .single();

    if (error || !data) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const result = await applyPaymentToOrder(supabase, data, payment);
    return NextResponse.json({ ok: true, duplicate: !result.changed });
  } catch (caught) {
    // Maya cannot find this payment - a synthetic id from the Manager "Test Webhooks"
    // tool, or an event for another merchant. Permanent, so acknowledge it: four retries
    // over 45 minutes would all fail the same way. Auth failures (401/403) deliberately
    // fall through to 500 so a bad secret key surfaces as retries instead of silence.
    if (isUnknownPayment(caught)) {
      return NextResponse.json({ ok: true, ignored: "unknown payment" });
    }

    // Non-2xx makes Maya retry (0/5/15/45 min), which is what we want on a write failure.
    const message = caught instanceof Error ? caught.message : "Webhook processing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Scoped to MayaApiError on purpose: a database error that happens to say "not found"
 *  must still retry, not be acknowledged as a phantom payment. */
function isUnknownPayment(caught: unknown) {
  if (!(caught instanceof MayaApiError)) return false;
  return caught.status === 404 || /does not exist/i.test(caught.message);
}

/**
 * ponytail: opt-in allowlist. Maya publishes prod IPs 18.138.50.235 / 3.1.207.200 and
 * sandbox 13.229.160.234 / 3.1.199.75, but hardcoding them means a silent outage if Maya
 * rotates. The secret-key re-fetch above is the actual authentication; set MAYA_WEBHOOK_IPS
 * to enforce the network layer too.
 */
function isAllowedIp(request: Request) {
  const allowList = (process.env.MAYA_WEBHOOK_IPS ?? "")
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean);
  if (allowList.length === 0) return true;

  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const clientIp = forwarded.split(",")[0]?.trim();
  return Boolean(clientIp) && allowList.includes(clientIp);
}
