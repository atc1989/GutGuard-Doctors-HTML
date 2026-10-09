import { adminErrorMessage } from "@/lib/admin-error";
import { NextRequest, NextResponse } from "next/server";
import { getAdminPasswordFromSession } from "@/lib/admin-session";
import {
  serverAdminGetShopOrder,
  serverAdminListShopOrders,
  serverAdminUpdateShopOrder,
} from "@/lib/admin-server-api";

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
    const update = await req.json();
    const saved = await serverAdminUpdateShopOrder(adminPassword, update);
    return NextResponse.json({ order: saved });
  } catch (error) {
    return NextResponse.json(
      { error: adminErrorMessage(error, "Failed to update shop order.") },
      { status: 500 },
    );
  }
}
