import { NextResponse } from "next/server";
import { getMayaPayment, isMayaConfigured } from "@/lib/maya";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OrderState = { status: string; paymentStatus: string; paidAt: string | null };

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
    const mayaStatus = String(payment.paymentStatus ?? payment.status ?? "");

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("shop_orders")
      .select("id, order_code, status, payment_status, maya_payment_id, maya_payment_status")
      .eq("order_code", orderCode)
      .single();

    if (error || !data) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    // Idempotent: Maya retries and manual replays deliver the same event more than once.
    if (data.maya_payment_id === paymentId && data.maya_payment_status === mayaStatus) {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    const wasPaid = data.payment_status === "paid";
    const next = mapStatus(mayaStatus, data.status, data.payment_status);

    const { error: updateError } = await supabase
      .from("shop_orders")
      .update({
        status: next.status,
        payment_status: next.paymentStatus,
        maya_payment_id: paymentId,
        maya_payment_status: mayaStatus,
        maya_reference: payment.receiptNumber ?? payment.receipt?.receiptNo ?? paymentId,
        maya_fund_source: payment.fundSource?.type ?? null,
        paid_at: next.paidAt,
      })
      .eq("id", data.id);

    // Non-2xx makes Maya retry (0/5/15/45 min), which is what we want on a write failure.
    if (updateError) return NextResponse.json({ error: "Could not persist payment" }, { status: 500 });

    // Only on the pending -> paid transition, so retried webhooks never re-send the receipt.
    if (!wasPaid && next.paymentStatus === "paid") {
      await supabase.functions
        .invoke("send-shop-order-email", { body: { orderId: data.id, kind: "paid" } })
        .catch(() => undefined);
    }

    return NextResponse.json({ ok: true });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Webhook processing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function mapStatus(mayaStatus: string, currentStatus: string, currentPaymentStatus: string): OrderState {
  switch (mayaStatus) {
    case "PAYMENT_SUCCESS":
      return { status: "paid", paymentStatus: "paid", paidAt: new Date().toISOString() };
    case "AUTHORIZED":
    case "AUTH_SUCCESS":
      return { status: "payment_review", paymentStatus: "review", paidAt: null };
    case "PAYMENT_FAILED":
    case "AUTH_FAILED":
      // Stays pending_payment on purpose: a failed attempt is retryable, not a dead order.
      return { status: "pending_payment", paymentStatus: "failed", paidAt: null };
    case "PAYMENT_CANCELLED":
      return { status: "pending_payment", paymentStatus: "pending", paidAt: null };
    case "PAYMENT_EXPIRED":
      return { status: "cancelled", paymentStatus: "failed", paidAt: null };
    case "VOIDED":
    case "REFUNDED":
      return { status: "cancelled", paymentStatus: "refunded", paidAt: null };
    default:
      return { status: currentStatus, paymentStatus: currentPaymentStatus, paidAt: null };
  }
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
