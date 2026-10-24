import { adminErrorMessage } from "@/lib/admin-error";
import { NextRequest, NextResponse } from "next/server";
import { getAdminPasswordFromSession } from "@/lib/admin-session";
import {
  serverAdminGetShopOrder,
  serverAdminListShopOrders,
  serverAdminUpdateShopOrder,
} from "@/lib/admin-server-api";
import type { ShopOrderAdminUpdate } from "@/lib/api";
import { loadCatalog, verifyOrderAmounts } from "@/lib/catalog";
import { expectedShippingFee } from "@/lib/shipping";
import { getSupabaseAdmin, isSupabaseAdminConfigured, SHOP_SCHEMA } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const adminPassword = await getAdminPasswordFromSession();
  if (!adminPassword) {
    return NextResponse.json({ error: "Unauthorized: Admin session expired." }, { status: 401 });
  }

  const orderId = req.nextUrl.searchParams.get("orderId");
  try {
    if (orderId) {
      const order = await serverAdminGetShopOrder(adminPassword, orderId);
      return NextResponse.json({ order });
    }

    const orders = await serverAdminListShopOrders(adminPassword);
    return NextResponse.json({ orders });
  } catch (error) {
    return NextResponse.json(
      { error: adminErrorMessage(error, "Failed to load shop orders.") },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const adminPassword = await getAdminPasswordFromSession();
  if (!adminPassword) {
    return NextResponse.json({ error: "Unauthorized: Admin session expired." }, { status: 401 });
  }

  try {
    const update = (await req.json()) as ShopOrderAdminUpdate;

    // Consignment/cash orders become paid only here, so check them like the Maya route checks
    // a charge: the browser wrote the totals, and a paid order credits partner points.
    let approvedOffline = false;
    if (update.paymentStatus === "paid") {
      const current = await serverAdminGetShopOrder(adminPassword, update.id);
      if (current.payment_method !== "maya" && current.payment_status !== "paid") {
        if (!isSupabaseAdminConfigured) {
          return NextResponse.json({ error: "Approvals are not configured on this environment." }, { status: 503 });
        }
        if (!update.mayaReference?.trim()) {
          return NextResponse.json({ error: "Enter the payment reference number before approving." }, { status: 400 });
        }
        const { products, promos } = await loadCatalog(getSupabaseAdmin());
        const shippingFee = expectedShippingFee(current.items, { provinceCode: current.province_code });
        if (!verifyOrderAmounts(current, shippingFee, products, promos)) {
          return NextResponse.json(
            { error: "This order's totals do not match the catalog. Check the items and amount before approving." },
            { status: 409 },
          );
        }
        approvedOffline = true;
      }
    }

    const saved = await serverAdminUpdateShopOrder(adminPassword, update);

    if (approvedOffline) {
      // Same receipt the Maya webhook sends; best-effort, the approval already stands.
      try {
        const { error: emailError } = await getSupabaseAdmin().functions.invoke("send-shop-order-email", {
          body: { orderId: saved.id, kind: "paid", schema: SHOP_SCHEMA },
        });
        if (emailError) console.error("Paid receipt email failed", saved.id, emailError.message);
      } catch (emailError) {
        console.error("Paid receipt email failed", saved.id, emailError);
      }
    }

    return NextResponse.json({ order: saved });
  } catch (error) {
    return NextResponse.json(
      { error: adminErrorMessage(error, "Failed to update shop order.") },
      { status: 500 },
    );
  }
}
