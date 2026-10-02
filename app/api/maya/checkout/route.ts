import { NextResponse } from "next/server";
import { buildOrderItems, flatShippingFee, hasKind, recomputeSubtotal } from "@/lib/catalog";
import { isWatchEligible } from "@/lib/shop-order";
import { createMayaCheckout, isMayaConfigured, toMayaAmount } from "@/lib/maya";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase-admin";
import type { ShopOrderItem } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OrderRow = {
  id: string;
  order_code: string;
  status: string;
  payment_status: string;
  customer_name: string;
  first_name: string | null;
  for_other: boolean | null;
  recipient_mobile: string | null;
  last_name: string | null;
  email: string;
  mobile: string;
  address: string;
  city: string;
  province: string;
  zip: string;
  shipping_fee: number | string;
  subtotal: number | string;
  total_amount: number | string;
  items: ShopOrderItem[];
  payment_attempts: number | null;
};

export async function POST(request: Request) {
  if (!isMayaConfigured || !isSupabaseAdminConfigured) {
    return NextResponse.json({ error: "Payments are not configured on this environment." }, { status: 503 });
  }

  let orderId = "";
  try {
    const body = (await request.json()) as { orderId?: string };
    orderId = body.orderId ?? "";
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!orderId) return NextResponse.json({ error: "Missing orderId." }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("shop_orders")
    .select(
      "id, order_code, status, payment_status, customer_name, first_name, last_name, email, mobile, address, city, province, zip, shipping_fee, subtotal, total_amount, items, payment_attempts, for_other, recipient_mobile",
    )
    .eq("id", orderId)
    .single();

  if (error || !data) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  const order = data as OrderRow;
  const orderUrl = `${getSiteUrl(request)}/shop/order/${encodeURIComponent(order.order_code)}`;
  // Return the buyer to the origin they paid from (gutguard.ph or shop.gutguard.ph), so the
  // basket and order summary kept in that origin's browser storage are still there.
  const shopUrl = `${getReturnOrigin(request)}/shop`;

  // Already settled - send them to the receipt instead of charging twice.
  if (order.payment_status === "paid") {
    return NextResponse.json({ alreadyPaid: true, orderUrl });
  }

  if (order.status === "cancelled") {
    return NextResponse.json({ error: "This order was replaced by a newer one. Please check out again." }, { status: 409 });
  }

  const amounts = verifyAmounts(order);
  if (!amounts) {
    return NextResponse.json(
      { error: "Order totals could not be verified. Please rebuild your basket or contact support." },
      { status: 409 },
    );
  }

  // The Watch rule again, just before payment: another order for the same number may have been
  // paid since this one was created.
  if (hasKind(order.items, "watch") && !(await isWatchEligible(supabase, order.for_other ? order.recipient_mobile ?? "" : order.mobile, order.id))) {
    return NextResponse.json(
      { error: "This number has a recent order with us. The 5-Night Watch is for new buyers.", code: "watch_not_eligible" },
      { status: 409 },
    );
  }

  // Maya wants a unique reference per transaction, so retries get a suffix while
  // the order code (and therefore reconciliation) stays one-to-one with the order.
  const attempt = (Number(order.payment_attempts) || 0) + 1;
  const requestReferenceNumber = attempt === 1 ? order.order_code : `${order.order_code}-${attempt}`;

  try {
    const checkout = await createMayaCheckout({
      totalAmount: {
        value: toMayaAmount(amounts.total),
        currency: "PHP",
        details: {
          subtotal: toMayaAmount(amounts.subtotal),
          shippingFee: toMayaAmount(amounts.shippingFee),
        },
      },
      // This merchant runs Checkout with Kount, so the Kount Buyer spec applies:
      // firstName, lastName, contact, billingAddress and shippingAddress are all required,
      // and each address needs countryCode. Only one address is collected at checkout,
      // so billing mirrors shipping.
      buyer: {
        ...buyerName(order),
        contact: { phone: order.mobile, email: order.email },
        billingAddress: buildAddress(order),
        shippingAddress: {
          ...buildAddress(order),
          ...buyerName(order),
          phone: order.mobile,
          email: order.email,
          shippingType: "ST",
        },
      },
      items: order.items.map((item) => ({
        name: item.name,
        code: item.id,
        quantity: String(item.qty),
        amount: { value: toMayaAmount(item.price), currency: "PHP" },
        totalAmount: { value: toMayaAmount(item.price * item.qty), currency: "PHP" },
      })),
      // Back to the shop, which shows the prototype's Done screen (or its retry screen).
      // The receipt page at /shop/order/<code> stays for email links.
      redirectUrl: {
        success: `${shopUrl}?order=${encodeURIComponent(order.order_code)}&p=success`,
        failure: `${shopUrl}?order=${encodeURIComponent(order.order_code)}&p=failure`,
        cancel: `${shopUrl}?order=${encodeURIComponent(order.order_code)}&p=cancel`,
      },
      requestReferenceNumber,
      metadata: {},
    });

    await supabase
      .from("shop_orders")
      .update({
        maya_checkout_id: checkout.checkoutId,
        maya_request_reference: requestReferenceNumber,
        maya_payment_status: "PENDING_PAYMENT",
        payment_attempts: attempt,
      })
      .eq("id", order.id);

    return NextResponse.json({ redirectUrl: checkout.redirectUrl, orderUrl });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Maya checkout could not be started.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

/**
 * The browser wrote subtotal/shipping/total into the row, so none of it is trusted here.
 * Line prices are re-derived from the server catalog and the shipping fee must equal the
 * flat fee for these items before any amount is sent to Maya.
 */
function verifyAmounts(order: OrderRow) {
  // The order rules (one Watch, one plan, no Watch with a plan, quantities) must hold for the
  // stored lines too, not only for orders made through /api/shop/order.
  const rules = buildOrderItems((order.items ?? []).map((item) => ({ id: item.id, qty: Number(item.qty) })));
  if ("error" in rules) return null;

  const subtotal = recomputeSubtotal(order.items);
  if (subtotal === null) return null;

  // Flat shipping (Addendum 05): the fee is derived from the items, never taken from the row.
  const shippingFee = Number(order.shipping_fee) || 0;
  if (shippingFee !== flatShippingFee(order.items)) return null;

  const total = subtotal + shippingFee;
  if (total <= 0) return null;

  // Stored total must agree with the recomputed one; a mismatch means tampering or a stale row.
  if (Math.round(Number(order.total_amount) * 100) !== Math.round(total * 100)) return null;

  return { subtotal, shippingFee, total };
}

function buildAddress(order: OrderRow) {
  return {
    line1: order.address,
    city: order.city,
    state: order.province,
    zipCode: order.zip,
    countryCode: "PH",
  };
}

/**
 * Kount requires both names. New orders store them separately because splitting a single
 * field guesses wrong on compound surnames ("Juan dela Cruz" -> "Juan dela" / "Cruz").
 * The split is kept only as a fallback for rows created before those columns existed.
 */
function buyerName(order: OrderRow) {
  const first = (order.first_name ?? "").trim();
  const last = (order.last_name ?? "").trim();
  if (first && last) return { firstName: first, lastName: last };

  const parts = (order.customer_name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "Customer", lastName: "Customer" };
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
}

/**
 * The shop's own origin - NOT NEXT_PUBLIC_SITE_URL, which points at the partner/doctors
 * host that QR codes are generated against. Maya has to redirect a paying customer back
 * to the shop, so these must stay separate once the two live on different subdomains.
 * Falling back to the request origin keeps this correct even if the var is unset.
 */
function getSiteUrl(request: Request) {
  const configured = process.env.NEXT_PUBLIC_SHOP_URL;
  if (configured) return configured.replace(/\/$/, "");
  return new URL(request.url).origin;
}

/** The request's own origin when it is one of ours, else the configured shop origin. */
function getReturnOrigin(request: Request) {
  const origin = new URL(request.url).origin;
  const allowed = [process.env.NEXT_PUBLIC_SHOP_URL, process.env.NEXT_PUBLIC_MARKETING_URL]
    .filter(Boolean)
    .map((u) => String(u).replace(/\/$/, ""));
  if (process.env.NODE_ENV !== "production" && /^http:\/\/localhost:\d+$/.test(origin)) return origin;
  return allowed.includes(origin) ? origin : getSiteUrl(request);
}
