import { adminErrorMessage, adminErrorStatus } from "@/lib/admin-error";
import { getAdminPasswordFromSession } from "@/lib/admin-session";
import { serverAdminAssignUnclaimedPassup, serverAdminListUnclaimedPassup } from "@/lib/admin-server-api";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const adminPassword = await getAdminPasswordFromSession("doctors");
  if (!adminPassword) {
    return NextResponse.json({ error: "Unauthorized: admin session expired, or this login can't open this section." }, { status: 401 });
  }

  try {
    const stores = await serverAdminListUnclaimedPassup(adminPassword);
    return NextResponse.json({ stores });
  } catch (error) {
    return NextResponse.json(
      { error: adminErrorMessage(error, "Failed to load unclaimed points.") },
      { status: adminErrorStatus(error) },
    );
  }
}

export async function POST(req: NextRequest) {
  const adminPassword = await getAdminPasswordFromSession("doctors");
  if (!adminPassword) {
    return NextResponse.json({ error: "Unauthorized: admin session expired, or this login can't open this section." }, { status: 401 });
  }

  try {
    const { storeId, partnerId, note } = await req.json();
    if (!storeId || !partnerId) {
      return NextResponse.json({ error: "Missing storeId or partnerId." }, { status: 400 });
    }

    const result = await serverAdminAssignUnclaimedPassup(adminPassword, storeId, partnerId, note);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: adminErrorMessage(error, "Failed to give unclaimed points.") },
      { status: adminErrorStatus(error) },
    );
  }
}
