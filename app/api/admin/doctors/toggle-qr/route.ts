import { adminErrorMessage } from "@/lib/admin-error";
import { getAdminPasswordFromSession } from "@/lib/admin-session";
import { serverAdminToggleReferralQr } from "@/lib/admin-server-api";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const adminPassword = await getAdminPasswordFromSession();
  if (!adminPassword) {
    return NextResponse.json({ error: "Unauthorized: Admin session expired." }, { status: 401 });
  }

  try {
    const { partnerId, enabled } = await req.json();
    if (!partnerId || typeof enabled !== "boolean") {
      return NextResponse.json({ error: "Missing partnerId or enabled boolean." }, { status: 400 });
    }

    const result = await serverAdminToggleReferralQr(adminPassword, partnerId, enabled);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: adminErrorMessage(error, "Failed to toggle Referral QR.") },
      { status: 500 },
    );
  }
}
