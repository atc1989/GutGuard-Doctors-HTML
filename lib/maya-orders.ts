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

type OrderRow = {
  id: string;
  status: string;
  payment_status: string;
  maya_payment_id: string | null;
  maya_payment_status: string | null;
};

/**
 * Applies a retrieved Maya payment to its order. Idempotent: replays and retries that
 * carry no new information return early, so the receipt email fires exactly once.
 */
export async function applyPaymentToOrder(
  supabase: ShopAdminClient,
  order: OrderRow,
  payment: MayaPayment,
): Promise<{ changed: boolean; paymentStatus: string }> {
  const paymentId = payment.id;
  const mayaStatus = String(payment.paymentStatus ?? payment.status ?? "");

  if (order.maya_payment_id === paymentId && order.maya_payment_status === mayaStatus) {
    return { changed: false, paymentStatus: order.payment_status };
  }

  const wasPaid = order.payment_status === "paid";
  const next = mapMayaStatus(mayaStatus, order.status, order.payment_status);

  const { error } = await supabase
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
    .eq("id", order.id);

  if (error) throw new Error("Could not persist payment");

  // Only on the pending -> paid transition, so a webhook and a reconcile racing each
  // other cannot both send the receipt.
  if (!wasPaid && next.paymentStatus === "paid") {
    await supabase.functions
      .invoke("send-shop-order-email", {
        body: { orderId: order.id, kind: "paid", schema: SHOP_SCHEMA },
      })
      .catch(() => undefined);
  }

  return { changed: true, paymentStatus: next.paymentStatus };
}
