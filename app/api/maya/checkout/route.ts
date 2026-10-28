import { NextResponse } from "next/server";
import { loadCatalog, verifyOrderAmounts } from "@/lib/catalog";
import { createMayaCheckout, isMayaConfigured, toMayaAmount } from "@/lib/maya";
import { verifyOrderAddress } from "@/lib/order-address";
import { expectedShippingFee } from "@/lib/shipping";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase-admin";
import type { ShopOrderItem } from "@/lib/api";
import { applyPaymentToOrder } from "@/lib/maya-orders";
import { canReplaceCheckout, mayaStatus, retrieveOrderPayment } from "@/lib/maya-recovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OrderRow = {
  id: string;
  order_code: string;
  status: string;
  payment_status: string;
  payment_method: string;
  customer_name: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  mobile: string;
  address: string;
  city: string;
  province: string;
  province_code: string | null;
  city_municipality_code: string | null;
  barangay: string | null;
  barangay_code: string | null;
  zip: string;
  shipping_fee: number | string;
  subtotal: number | string;
  total_amount: number | string;
  items: ShopOrderItem[];
  payment_attempts: number | null;
  maya_checkout_id: string | null;
  maya_checkout_url: string | null;
  maya_request_reference: string | null;
  maya_payment_id: string | null;
  maya_payment_status: string | null;
  paid_at: string | null;
  created_at: string;
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
      "id, order_code, status, payment_status, payment_method, customer_name, first_name, last_name, email, mobile, address, city, province, province_code, city_municipality_code, barangay, barangay_code, zip, shipping_fee, subtotal, total_amount, items, payment_attempts, created_at, maya_checkout_id, maya_checkout_url, maya_request_reference, maya_payment_id, maya_payment_status, paid_at",
    )
    .eq("id", orderId)
    .single();

  if (error || !data) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  const order = data as OrderRow;
  const orderUrl = `${getSiteUrl(request)}/shop/order/${encodeURIComponent(order.order_code)}`;

  // Already settled - send them to the receipt instead of charging twice.
  if (order.payment_status === "paid") {
    return NextResponse.json({ alreadyPaid: true, orderUrl });
  }

  // Consignment/cash orders are settled offline and approved by an admin - never charge them on Maya.
  if (order.payment_method !== "maya") {
    return NextResponse.json({ error: "This order is not paid through Maya." }, { status: 409 });
  }

  if (order.payment_status === "refunded") {
    return NextResponse.json({ error: "This order was refunded. Please place a new order." }, { status: 409 });
  }

  // Local pending/failed is not proof that Maya did not take payment. Even a 404
  // or timeout is inconclusive and must not authorize a second checkout.
  if (order.maya_checkout_id || order.maya_request_reference || order.payment_attempts) {
    try {
      const payment = await retrieveOrderPayment(order);
      if (!payment) throw new Error("The previous payment attempt is still being verified. Please contact support before paying again.");
      const result = await applyPaymentToOrder(supabase, order, payment);
      if (result.paymentStatus === "paid") return NextResponse.json({ alreadyPaid: true, orderUrl });
      const status = mayaStatus(payment);
      if (["PENDING_PAYMENT", "PENDING_TOKEN"].includes(status) && order.maya_checkout_url) {
        return NextResponse.json({ redirectUrl: order.maya_checkout_url, orderUrl });
      }
      if (!canReplaceCheckout(status)) {
        throw new Error("Your previous payment is pending or needs review. Please contact support before paying again.");
      }
      // Payment application may have changed these fields. Use the fresh row for
      // the conditional reservation below, rather than a stale pre-lookup snapshot.
      const fresh = await supabase.from("shop_orders").select("*").eq("id", order.id).single();
      if (fresh.error || !fresh.data) throw new Error("Could not verify the latest order state.");
      if (fresh.data.payment_attempts !== order.payment_attempts || fresh.data.maya_request_reference !== order.maya_request_reference) {
        throw new Error("Another payment attempt is already being started.");
      }
      Object.assign(order, fresh.data);
      if (order.payment_status === "paid") return NextResponse.json({ alreadyPaid: true, orderUrl });
    } catch {
      return NextResponse.json({ error: "Your previous payment could not be cleared for a new attempt. Please check your order again or contact support before paying again." }, { status: 409 });
    }
  } else if (order.payment_status === "review") {
    return NextResponse.json({ error: "Your payment is being reviewed. Please contact support before paying again." }, { status: 409 });
  }

  // Same reads and fallbacks as the shop, so both agree on every price.
  const { products, promos } = await loadCatalog(supabase);

  // Shipping is priced from the province code, so the address must be that real place.
  const addressProblem = await verifyOrderAddress(order);
  if (addressProblem) {
    console.warn(`Order ${order.order_code} address rejected: ${addressProblem}`);
    return NextResponse.json(
      { error: "Your delivery address could not be verified. Please re-enter it and place the order again." },
      { status: 409 },
    );
  }

  const shippingFee = expectedShippingFee(order.items, { provinceCode: order.province_code });
  const amounts = verifyOrderAmounts(order, shippingFee, products, promos);
  if (!amounts) {
    return NextResponse.json(
      { error: "Order totals could not be verified. Please rebuild your basket or contact support." },
      { status: 409 },
    );
  }

  // Maya wants a unique reference per transaction, so retries get a suffix while
  // the order code (and therefore reconciliation) stays one-to-one with the order.
  const attempt = (Number(order.payment_attempts) || 0) + 1;
  const requestReferenceNumber = attempt === 1 ? order.order_code : `${order.order_code}-${attempt}`;

  try {
    // Reserve in Postgres BEFORE the external call. This is a cross-instance
    // compare-and-swap, not an in-memory lock. Never release an uncertain request:
    // its durable reference lets reconciliation find a lost Maya response.
    let claim = supabase.from("shop_orders").update({
      payment_attempts: attempt,
      maya_request_reference: requestReferenceNumber,
      maya_checkout_id: null,
      maya_checkout_url: null,
      maya_payment_status: "CHECKOUT_CREATING",
    }).eq("id", order.id).eq("payment_attempts", Number(order.payment_attempts) || 0)
      .eq("status", order.status).eq("payment_status", order.payment_status);
    claim = order.maya_payment_status === null
      ? claim.is("maya_payment_status", null) : claim.eq("maya_payment_status", order.maya_payment_status);
    const reservation = await claim.select("id").maybeSingle();
    if (reservation.error || !reservation.data) {
      return NextResponse.json({ error: "Payment is already being started or the order changed. Please check your order before trying again." }, { status: 409 });
    }

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
      redirectUrl: {
        success: `${orderUrl}?p=success`,
        failure: `${orderUrl}?p=failure`,
        cancel: `${orderUrl}?p=cancel`,
      },
      requestReferenceNumber,
      metadata: {},
    });

    const saved = await supabase
      .from("shop_orders")
      .update({
        maya_checkout_id: checkout.checkoutId,
        maya_checkout_url: checkout.redirectUrl,
      })
      .eq("id", order.id)
      .eq("payment_attempts", attempt)
      .eq("maya_request_reference", requestReferenceNumber)
      .select("id, payment_status").maybeSingle();
    if (saved.error || !saved.data) {
      throw new Error("Checkout details could not be saved. Please check your order or contact support before paying again.");
    }
    if (saved.data.payment_status === "paid") return NextResponse.json({ alreadyPaid: true, orderUrl });
    if (saved.data.payment_status === "refunded") {
      return NextResponse.json({ error: "This order was refunded. Please place a new order." }, { status: 409 });
    }

    return NextResponse.json({ redirectUrl: checkout.redirectUrl, orderUrl });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Maya checkout could not be started.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
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
