// Server-only Maya Checkout client. Never import this from a "use client" module.
// Docs: https://developers.maya.ph/reference/accept-one-time-payment-using-maya-checkout

const DEFAULT_BASE_URL = "https://pg-sandbox.paymaya.com";

export const mayaBaseUrl = process.env.MAYA_API_BASE ?? DEFAULT_BASE_URL;
export const isMayaConfigured = Boolean(process.env.MAYA_PUBLIC_KEY && process.env.MAYA_SECRET_KEY);

export type MayaAmount = { value: string; currency: "PHP" };

export type MayaAddress = {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  /** ISO 3166 alpha-2. Required by the Kount address spec. */
  countryCode: string;
};

export type MayaCheckoutRequest = {
  totalAmount: {
    value: string;
    currency: "PHP";
    details?: { subtotal?: string; shippingFee?: string };
  };
  // Kount Buyer spec (required when the merchant has fraud protection enabled).
  // Under Basic Buyer every field here is optional, so this shape satisfies both.
  buyer?: {
    firstName: string;
    lastName: string;
    middleName?: string;
    contact: { phone?: string; email?: string };
    billingAddress: MayaAddress;
    shippingAddress: MayaAddress & {
      firstName?: string;
      lastName?: string;
      phone?: string;
      email?: string;
      shippingType?: "ST" | "SD";
    };
  };
  items?: Array<{
    name: string;
    quantity: string;
    code?: string;
    amount: MayaAmount;
    totalAmount: MayaAmount;
  }>;
  redirectUrl: { success: string; failure: string; cancel: string };
  requestReferenceNumber: string;
  metadata?: Record<string, unknown>;
};

export type MayaCheckoutResponse = { checkoutId: string; redirectUrl: string };

/** Maya's payment lifecycle statuses. PAYMENT_SUCCESS is the only terminal "money moved" state. */
export type MayaPaymentStatus =
  | "PENDING_TOKEN"
  | "PENDING_PAYMENT"
  | "FOR_AUTHENTICATION"
  | "AUTHENTICATING"
  | "AUTH_SUCCESS"
  | "AUTH_FAILED"
  | "AUTHORIZED"
  | "PAYMENT_SUCCESS"
  | "PAYMENT_FAILED"
  | "PAYMENT_EXPIRED"
  | "PAYMENT_CANCELLED"
  | "VOIDED"
  | "REFUNDED";

export type MayaPayment = {
  id: string;
  status: MayaPaymentStatus | string;
  paymentStatus?: MayaPaymentStatus | string;
  requestReferenceNumber?: string;
  receiptNumber?: string;
  amount?: string | number;
  currency?: string;
  fundSource?: { type?: string; description?: string };
  receipt?: { transactionId?: string; receiptNo?: string };
};

/** Amounts are PHP with 2 decimals; Maya rejects floats formatted any other way. */
export function toMayaAmount(value: number): string {
  return value.toFixed(2);
}

function basicAuth(key: string) {
  return `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
}

async function mayaFetch(path: string, key: string, init?: RequestInit) {
  const response = await fetch(`${mayaBaseUrl}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: basicAuth(key),
      ...init?.headers,
    },
    cache: "no-store",
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      (body && typeof body === "object" && "message" in body && String((body as { message: unknown }).message)) ||
      `Maya request failed (${response.status})`;
    throw new Error(message);
  }

  return body;
}

/** Create Checkout uses the PUBLIC key. Returns the Maya-hosted page to redirect to. */
export async function createMayaCheckout(payload: MayaCheckoutRequest): Promise<MayaCheckoutResponse> {
  const publicKey = process.env.MAYA_PUBLIC_KEY;
  if (!publicKey) throw new Error("MAYA_PUBLIC_KEY is not set.");

  const body = (await mayaFetch("/checkout/v1/checkouts", publicKey, {
    method: "POST",
    body: JSON.stringify(payload),
  })) as MayaCheckoutResponse;

  if (!body?.redirectUrl) throw new Error("Maya did not return a checkout URL.");
  return body;
}

/**
 * Retrieve Payment uses the SECRET key. The webhook handler calls this instead of
 * trusting the posted body, so a spoofed webhook cannot mark an order paid.
 */
export async function getMayaPayment(paymentId: string): Promise<MayaPayment> {
  const secretKey = process.env.MAYA_SECRET_KEY;
  if (!secretKey) throw new Error("MAYA_SECRET_KEY is not set.");

  return (await mayaFetch(`/payments/v1/payments/${encodeURIComponent(paymentId)}`, secretKey)) as MayaPayment;
}
