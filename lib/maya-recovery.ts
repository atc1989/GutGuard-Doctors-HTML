import { getMayaPayment, getMayaPaymentsByReference, type MayaPayment } from "@/lib/maya";

export const mayaStatus = (payment: MayaPayment) => String(payment.paymentStatus ?? payment.status ?? "");

/** Only an explicit terminal unsuccessful result permits a replacement session. */
export const canReplaceCheckout = (status: string) =>
  ["PAYMENT_FAILED", "AUTH_FAILED", "PAYMENT_CANCELLED", "PAYMENT_EXPIRED"].includes(status);

export async function retrieveOrderPayment(order: { maya_checkout_id: string | null; maya_request_reference: string | null }) {
  if (order.maya_checkout_id) return getMayaPayment(order.maya_checkout_id);
  if (!order.maya_request_reference) return null;
  const payments = await getMayaPaymentsByReference(order.maya_request_reference);
  // Never guess which transaction to replace when the reference is ambiguous.
  if (payments.length > 1) throw new Error("Multiple payments need review. Please contact support before paying again.");
  const payment = payments[0] ?? null;
  if (payment && (!payment.id || payment.requestReferenceNumber !== order.maya_request_reference)) {
    throw new Error("Payment reference could not be verified.");
  }
  return payment;
}
