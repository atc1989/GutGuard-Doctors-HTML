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

  if (!wasPaid && next.paymentStatus === "paid") {
    try {
      await supabase.functions.invoke("send-shop-order-email", {
        body: { orderId: order.id, kind: "paid", schema: SHOP_SCHEMA },
      });
    } catch {
      // Best-effort receipt notification
    }
  }

  return { changed: true, paymentStatus: next.paymentStatus };
}

async function processOrderPoints(supabase: ShopAdminClient, orderId: string) {
  // 1. Fetch Order and Buyer's Referrer
  const { data: order } = await supabase
    .from("shop_orders")
    .select("partner_id, doctor_registrations(referred_by_partner_id)")
    .eq("id", orderId)
    .single();

  if (!order || !order.partner_id) return;

  const buyerId = order.partner_id;
  // Supabase returns related table fields inside an object array for one-to-many, 
  // but here it's many-to-one so it's a single object if joined properly.
  // @ts-ignore
  const referrerId = order.doctor_registrations?.referred_by_partner_id || null;

  // 2. Fetch Order Items to calculate points
  const { data: items } = await supabase
    .from("shop_order_items")
    .select("name, quantity")
    .eq("order_id", orderId);

  if (!items || items.length === 0) return;

  let totalPoints = 0;
  for (const item of items) {
    const name = item.name.toLowerCase();
    if (name.includes("retail")) totalPoints += 1 * item.quantity;
    else if (name.includes("start")) totalPoints += 3 * item.quantity;
    else if (name.includes("grow")) totalPoints += 9 * item.quantity;
    else if (name.includes("peak")) totalPoints += 33 * item.quantity;
  }

  if (totalPoints === 0) return;

  // 3. Credit Points
  let targetPartnerId = buyerId;
  let targetDepth = 0;

  if (referrerId) {
    // Pass-Up Rule: If buyer has a referrer, referrer gets 100% of points, buyer gets 0.
    targetPartnerId = referrerId;
    targetDepth = 1;
  }

  const { error: insertError } = await supabase
    .from("partner_points")
    .insert({
      order_id: orderId,
      partner_id: targetPartnerId,
      points: totalPoints,
      depth: targetDepth,
    });
    
  // Ignores unique constraint violations (idempotency)
  if (insertError && !insertError.message.includes("unique constraint")) {
    throw insertError;
  }

  // 4. Check Milestones
  await checkMilestones(supabase, targetPartnerId);
}

async function checkMilestones(supabase: ShopAdminClient, partnerId: string) {
  const { data } = await supabase
    .from("partner_points")
    .select("points")
    .eq("partner_id", partnerId);

  if (!data) return;

  const totalPoints = data.reduce((sum, row) => sum + row.points, 0);
  const completedCycles = Math.floor(totalPoints / 1500);
  const currentCycle = completedCycles + 1;
  const pointsInCurrentCycle = totalPoints % 1500;

  const milestones = [
    { pts: 300, rebate: 18000 },
    { pts: 750, rebate: 70000 },
    { pts: 1500, rebate: 150000 },
  ];

  for (let cycle = 1; cycle <= currentCycle; cycle++) {
    const cyclePts = cycle < currentCycle ? 1500 : pointsInCurrentCycle;

    for (const ms of milestones) {
      if (cyclePts >= ms.pts) {
        try {
          await supabase
            .from("milestone_unlocks")
            .insert({
              partner_id: partnerId,
              cycle_number: cycle,
              milestone_pts: ms.pts,
              rebate_amount: ms.rebate,
              status: "unlocked",
            });
        } catch {
          // Catch unique constraint errors quietly
        }
      }
    }
  }
}
