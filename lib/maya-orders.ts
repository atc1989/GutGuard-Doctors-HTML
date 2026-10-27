import type { MayaPayment } from "@/lib/maya";
import { SHOP_SCHEMA, type getSupabaseAdmin } from "@/lib/supabase-admin";

/** Schema-scoped admin client - the generic differs between `public` and `sandbox`. */
type ShopAdminClient = ReturnType<typeof getSupabaseAdmin>;

// Single place where a Maya payment becomes an order state. The webhook and the
// reconcile fallback both route through here so they can never disagree.

export type OrderPaymentState = { status: string; paymentStatus: string; paidAt: string | null };

export function mapMayaStatus(
  mayaStatus: string,
  currentStatus: string,
  currentPaymentStatus: string,
): OrderPaymentState {
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

export const PAYMENT_ORDER_COLUMNS = "id, status, payment_status, maya_payment_id, maya_payment_status, maya_checkout_id, maya_request_reference, payment_attempts, paid_at";

type OrderRow = {
  id: string;
  status: string;
  payment_status: string;
  maya_payment_id: string | null;
  maya_payment_status: string | null;
  maya_checkout_id?: string | null;
  maya_request_reference?: string | null;
  payment_attempts?: number | null;
  paid_at?: string | null;
};

/** Failures must reach the webhook caller so Maya retries even after the order is paid. */
export async function sendPaidReceipt(supabase: ShopAdminClient, orderId: string) {
  const { data, error } = await supabase.functions.invoke("send-shop-order-email", {
    body: { orderId, kind: "paid", schema: SHOP_SCHEMA },
  });
  if (error || (!data?.sent && !data?.duplicate)) throw new Error("Paid receipt delivery failed; retry required.");
}

/**
 * Conditional writes prevent a stale webhook/reconcile response from un-paying an
 * order. Duplicate paid notifications still retry the independently idempotent receipt.
 */
export async function applyPaymentToOrder(
  supabase: ShopAdminClient,
  order: OrderRow,
  payment: MayaPayment,
): Promise<{ changed: boolean; paymentStatus: string }> {
  for (let retry = 0; retry < 3; retry++) {
    const paymentId = payment.id;
    const mayaStatus = String(payment.paymentStatus ?? payment.status ?? "");

    if (order.maya_payment_id === paymentId && order.maya_payment_status === mayaStatus) {
      if (order.payment_status === "paid") await sendPaidReceipt(supabase, order.id);
      return { changed: false, paymentStatus: order.payment_status };
    }

    const wasPaid = order.payment_status === "paid";
    const next = mapMayaStatus(mayaStatus, order.status, order.payment_status);

    // Preserve fulfilment, the original payment identity and paid_at on later
    // successes. A refund is not an invitation for an old success to revive an order.
    if (order.payment_status === "refunded") return { changed: false, paymentStatus: "refunded" };
    if (wasPaid && next.paymentStatus === "paid") {
      await sendPaidReceipt(supabase, order.id);
      return { changed: false, paymentStatus: "paid" };
    }

    // An abandoned session must not replace the state of a newer attempt. Success
    // still counts: money received on any attempt settles this order.
    if (!wasPaid && next.paymentStatus !== "paid" && (
      (order.maya_checkout_id && order.maya_checkout_id !== paymentId) ||
      (order.maya_request_reference && payment.requestReferenceNumber && order.maya_request_reference !== payment.requestReferenceNumber)
    )) return { changed: false, paymentStatus: order.payment_status };

    // A paid order only leaves "paid" when the payment that paid it is voided or refunded. A late
    // webhook for an earlier, abandoned attempt (PAYMENT_EXPIRED / FAILED) must not un-pay it.
    if (wasPaid && next.paymentStatus !== "paid" && (order.maya_payment_id !== paymentId || next.paymentStatus !== "refunded")) {
      return { changed: false, paymentStatus: order.payment_status };
    }

    let update = supabase
      .from("shop_orders")
      .update({
        status: next.status,
        payment_status: next.paymentStatus,
        maya_payment_id: paymentId,
        maya_payment_status: mayaStatus,
        maya_reference: payment.receiptNumber ?? payment.receipt?.receiptNo ?? paymentId,
        maya_fund_source: payment.fundSource?.type ?? null,
        paid_at: next.paidAt ?? order.paid_at ?? null,
      })
      .eq("id", order.id).eq("status", order.status).eq("payment_status", order.payment_status);
    for (const key of ["maya_payment_id", "maya_payment_status", "maya_checkout_id", "maya_request_reference", "payment_attempts"] as const) {
      if (order[key] !== undefined) update = order[key] === null ? update.is(key, null) : update.eq(key, order[key]!);
    }
    const { data, error } = await update.select("id").maybeSingle();

    if (error) throw new Error("Could not persist payment");
    if (!data) {
      const fresh = await supabase.from("shop_orders").select(PAYMENT_ORDER_COLUMNS).eq("id", order.id).single();
      if (fresh.error || !fresh.data) throw new Error("Could not reload payment state");
      order = fresh.data as OrderRow;
      continue;
    }

    if (!wasPaid && next.paymentStatus === "paid") {
      await sendPaidReceipt(supabase, order.id);
    }

    return { changed: true, paymentStatus: next.paymentStatus };
  }
  throw new Error("Order changed during payment verification; retry required.");
}
