import { NextResponse } from "next/server";
import { buildOrderItems, flatShippingFee, hasKind, recomputeSubtotal } from "@/lib/catalog";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase-admin";
import { isWatchEligible, normalizeMobile } from "@/lib/shop-order";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  firstName?: string;
  lastName?: string;
  email?: string;
  mobile?: string;
  street?: string;
  barangay?: string;
  city?: string;
  province?: string;
  zip?: string;
  items?: Array<{ id: string; qty: number }>;
  forOther?: boolean;
  recipient?: { name?: string; mobile?: string };
  referral?: string;
  planAgree?: boolean;
};

const text = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);

/**
 * POST /api/shop/order -> { id, orderCode }
 *
 * Creates the order for the website shop (the prototype checkout). The browser sends ids,
 * quantities and contact details only. Names, prices, shipping and totals are built here,
 * then the order goes through the existing create_shop_order RPC so referral attribution
 * stays in one place. The client then calls /api/maya/checkout with the id, as before.
 */
export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return NextResponse.json({ error: "Orders are not configured on this environment." }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const firstName = text(body.firstName, 80);
  const lastName = text(body.lastName, 80);
  const email = text(body.email, 160).toLowerCase();
  const mobile = normalizeMobile(text(body.mobile, 20));
  const street = text(body.street);
  const barangay = text(body.barangay, 120);
  const city = text(body.city, 120);
  const province = text(body.province, 120);
  const zip = text(body.zip, 4);
  const forOther = body.forOther === true;
  const recipientName = forOther ? text(body.recipient?.name, 160) : "";
  const recipientMobile = forOther ? normalizeMobile(text(body.recipient?.mobile, 20)) : "";

  const missing =
    !firstName || !lastName ? "Add your first and last name."
    : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "Add a valid email address."
    : !mobile ? "Add an 11-digit mobile number."
    : !street || !barangay || !city || !province ? "Add your delivery address."
    : !/^\d{4}$/.test(zip) ? "Add your 4-digit ZIP code."
    : forOther && (recipientName.length < 2 || !recipientMobile) ? "Add their full name and mobile number."
    : forOther && recipientMobile === mobile ? "This is your own number. Choose Me instead."
    : "";
  if (missing) return NextResponse.json({ error: missing }, { status: 400 });

  const built = buildOrderItems(body.items ?? []);
  if ("error" in built) return NextResponse.json({ error: built.error }, { status: 400 });
  const items = built.items;

  if (hasKind(items, "plan") && body.planAgree !== true) {
    return NextResponse.json({ error: "Tick the renewal box to start your plan." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // The Watch checks the person who takes the capsules.
  if (hasKind(items, "watch") && !(await isWatchEligible(supabase, forOther ? recipientMobile : mobile))) {
    return NextResponse.json(
      { error: "This number has a recent order with us. The 5-Night Watch is for new buyers.", code: "watch_not_eligible" },
      { status: 409 },
    );
  }

  const subtotal = recomputeSubtotal(items);
  if (subtotal === null) return NextResponse.json({ error: "Your order could not be priced." }, { status: 400 });
  const shippingFee = flatShippingFee(items);

  const { data, error } = await supabase.rpc("create_shop_order", {
    p_first_name: firstName,
    p_last_name: lastName,
    p_email: email,
    p_mobile: mobile,
    p_address: street,
    p_city: city,
    p_province: province,
    p_barangay: barangay,
    p_zip: zip,
    p_province_code: "",
    p_city_municipality_code: "",
    p_barangay_code: "",
    p_shipping_region: "Flat rate",
    p_shipping_fee: shippingFee,
    p_shipping_weight_grams: 0,
    p_total_amount: subtotal + shippingFee,
    p_items: items,
    p_subtotal: subtotal,
    p_payment_method: "maya",
    p_referral_slug: text(body.referral, 60).toLowerCase(),
  });

  const row = (Array.isArray(data) ? data[0] : data) as { id?: string; order_code?: string } | null;
  if (error || !row?.id) {
    return NextResponse.json({ error: "Your order could not be saved. Please try again." }, { status: 500 });
  }

  if (forOther) {
    const { error: rcpError } = await supabase
      .from("shop_orders")
      .update({ for_other: true, recipient_name: recipientName, recipient_mobile: recipientMobile })
      .eq("id", row.id);
    if (rcpError) console.error("shop order recipient update failed", rcpError.message);
  }

  return NextResponse.json({ id: row.id, orderCode: row.order_code });
}
