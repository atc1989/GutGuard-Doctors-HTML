import { NextResponse } from "next/server";
import { getMayaPayment, isMayaConfigured, MayaApiError } from "@/lib/maya";
import { applyPaymentToOrder } from "@/lib/maya-orders";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook fallback, as recommended by Maya ("If webhooks fail, retrieve the transaction").
 * A dropped or misconfigured webhook would otherwise leave a genuinely paid order sitting
 * at "awaiting payment" and invite the customer to pay a second time.
 *
 * Safe to expose: it takes no amount and no status from the caller. It only asks Maya what
 * happened to this order's own checkout and writes back the answer.
 */
export async function POST(request: Request) {
  if (!isMayaConfigured || !isSupabaseAdminConfigured) {
    return NextResponse.json({ error: "Payments are not configured." }, { status: 503 });
  }

  let orderCode = "";
  try {
    const body = (await request.json()) as { orderCode?: string };
    orderCode = (body.orderCode ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!orderCode) return NextResponse.json({ error: "Missing orderCode." }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("shop_orders")
    .select("id, status, payment_status, maya_payment_id, maya_payment_status, maya_checkout_id")
    .eq("order_code", orderCode)
    .single();

  if (error || !data) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  // Already settled, or no checkout was ever started - nothing to ask Maya about.
  if (data.payment_status === "paid") return NextResponse.json({ paymentStatus: "paid", changed: false });
  if (!data.maya_checkout_id) return NextResponse.json({ paymentStatus: data.payment_status, changed: false });

  try {
    // For Maya Checkout the checkoutId is the payment id.
    const payment = await getMayaPayment(data.maya_checkout_id);
    const result = await applyPaymentToOrder(supabase, data, payment);
    return NextResponse.json({ paymentStatus: result.paymentStatus, changed: result.changed });
  } catch (caught) {
    // An unpaid checkout that was never attempted has no payment record yet - not an error.
    if (caught instanceof MayaApiError && (caught.status === 404 || /does not exist/i.test(caught.message))) {
      return NextResponse.json({ paymentStatus: data.payment_status, changed: false });
    }

    const message = caught instanceof Error ? caught.message : "Could not reconcile payment.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
