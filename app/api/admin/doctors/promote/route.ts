import { adminErrorMessage, adminErrorStatus } from "@/lib/admin-error";
import { getAdminPasswordFromSession } from "@/lib/admin-session";
import { serverAdminPromotePartner } from "@/lib/admin-server-api";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const adminPassword = await getAdminPasswordFromSession("doctors");
  if (!adminPassword) {
    return NextResponse.json({ error: "Unauthorized: admin session expired, or this login can't open this section." }, { status: 401 });
  }

  try {
    const { partnerId, note } = await req.json();
    if (!partnerId) {
      return NextResponse.json({ error: "Missing partnerId." }, { status: 400 });
    }

    const result = await serverAdminPromotePartner(adminPassword, partnerId, note);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: adminErrorMessage(error, "Failed to promote partner to Lifestyle.") },
      { status: adminErrorStatus(error) },
    );
  }
}
