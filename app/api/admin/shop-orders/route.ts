import { NextRequest, NextResponse } from "next/server";
import { getAdminPasswordFromSession } from "@/lib/admin-session";
import { adminGetShopOrder, adminListShopOrders, adminUpdateShopOrder } from "@/lib/api";

export async function GET(req: NextRequest) {
  const adminPassword = await getAdminPasswordFromSession();
  if (!adminPassword) {
    return NextResponse.json({ error: "Unauthorized: Admin session expired." }, { status: 401 });
  }

  const orderId = req.nextUrl.searchParams.get("orderId");
  try {
    if (orderId) {
      const order = await adminGetShopOrder(adminPassword, orderId);
      return NextResponse.json({ order });
    }

    const orders = await adminListShopOrders(adminPassword);
    return NextResponse.json({ orders });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load shop orders." },
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
    const saved = await adminUpdateShopOrder(adminPassword, update);
    return NextResponse.json({ order: saved });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update shop order." },
      { status: 500 },
    );
  }
}
