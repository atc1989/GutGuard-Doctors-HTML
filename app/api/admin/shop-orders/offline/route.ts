import { adminErrorMessage } from "@/lib/admin-error";
import { NextRequest, NextResponse } from "next/server";
import { getAdminPasswordFromSession } from "@/lib/admin-session";
import { serverAdminUpdateShopOrder } from "@/lib/admin-server-api";
import type { AdminOfflineOrderInput } from "@/lib/api";
import { loadCatalog, priceOrderLines } from "@/lib/catalog";
import { getSupabaseAdmin, isSupabaseAdminConfigured, SHOP_SCHEMA } from "@/lib/supabase-admin";

/**
 * Admin records a sale by hand (Maya, consignment or cash; "store" channel). It goes through the
 * same create_shop_order as the shop (order code, referral credit, self-referral check), then is
 * marked paid with the admin's reference - which fires partner points like a checkout payment -
 * and gets its fulfilment fields. No shipping: the address is free text and the total is the
 * catalog price of the items.
 */
export async function POST(req: NextRequest) {
  const adminPassword = await getAdminPasswordFromSession();
  if (!adminPassword) {
    return NextResponse.json({ error: "Unauthorized: Admin session expired." }, { status: 401 });
  }
  if (!isSupabaseAdminConfigured) {
    return NextResponse.json({ error: "Orders cannot be added on this environment." }, { status: 503 });
  }

  let input: AdminOfflineOrderInput;
  try {
    input = (await req.json()) as AdminOfflineOrderInput;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const text = (value: unknown) => String(value ?? "").trim();
  if (!["maya", "consignment", "cash"].includes(input.paymentMethod)) {
    return NextResponse.json({ error: "Choose Maya, Consignment or Cash." }, { status: 400 });
  }
  const missing = [
    !text(input.firstName) && "first name",
    !text(input.lastName) && "last name",
    !text(input.mobile) && "mobile",
    !text(input.address) && "address",
    !text(input.reference) && "reference number",
  ].filter(Boolean);
  if (missing.length) {
    return NextResponse.json({ error: `Enter the ${missing.join(", ")}.` }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { products, promos } = await loadCatalog(supabase);
    const items = priceOrderLines(input.items, products, promos);
    if (!items) {
      return NextResponse.json({ error: "Add at least one product with a quantity from 1 to 20." }, { status: 400 });
    }
    const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);

    const { data, error } = await supabase.rpc("create_shop_order", {
      p_first_name: text(input.firstName),
      p_last_name: text(input.lastName),
      p_email: text(input.email),
      p_mobile: text(input.mobile).replace(/\s/g, ""),
      p_address: text(input.address),
      p_city: "",
      p_province: "",
      p_barangay: "",
      p_zip: "",
      p_province_code: null,
      p_city_municipality_code: null,
      p_barangay_code: null,
      p_shipping_region: null,
      p_shipping_fee: 0,
      p_shipping_weight_grams: 0,
      p_total_amount: subtotal,
      p_items: items,
      p_subtotal: subtotal,
      p_payment_method: input.paymentMethod,
      p_referral_slug: text(input.referralSlug) || null,
    });
    if (error) throw error;
    const created = (Array.isArray(data) ? data[0] : data) as { id?: string } | null;
    if (!created?.id) throw new Error("The order was not created.");

    const saved = await serverAdminUpdateShopOrder(adminPassword, {
      id: created.id,
      status: "paid",
      paymentStatus: "paid",
      mayaReference: text(input.reference),
      adminNotes: text(input.adminNotes),
      fulfillment: input.fulfillment,
      salesChannel: "store",
    });

    if (saved.email) {
      // Same receipt the Maya webhook sends; best-effort, the order already stands.
      try {
        const { error: emailError } = await supabase.functions.invoke("send-shop-order-email", {
          body: { orderId: saved.id, kind: "paid", schema: SHOP_SCHEMA },
        });
        if (emailError) console.error("Paid receipt email failed", saved.id, emailError.message);
      } catch (emailError) {
        console.error("Paid receipt email failed", saved.id, emailError);
      }
    }

    return NextResponse.json({ order: saved });
  } catch (error) {
    return NextResponse.json({ error: adminErrorMessage(error, "Failed to save the order.") }, { status: 500 });
  }
}
