import { adminErrorMessage, adminErrorStatus } from "@/lib/admin-error";
import { getAdminPasswordFromSession } from "@/lib/admin-session";
import { serverAdminTransferStore } from "@/lib/admin-server-api";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const adminPassword = await getAdminPasswordFromSession();
  if (!adminPassword) {
    return NextResponse.json({ error: "Unauthorized: Admin session expired." }, { status: 401 });
  }

  try {
    const { partnerId, newUplineId, note } = await req.json();
    if (!partnerId || !newUplineId) {
      return NextResponse.json({ error: "Missing partnerId or newUplineId." }, { status: 400 });
    }

    const result = await serverAdminTransferStore(adminPassword, partnerId, newUplineId, note);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: adminErrorMessage(error, "Failed to transfer store.") },
      { status: adminErrorStatus(error) },
    );
  }
}
