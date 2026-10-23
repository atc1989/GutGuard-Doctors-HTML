import { adminErrorMessage, adminErrorStatus } from "@/lib/admin-error";
import { getAdminPasswordFromSession } from "@/lib/admin-session";
import { serverAdminCreatePendingPartner } from "@/lib/admin-server-api";
import { NextResponse } from "next/server";

export async function POST() {
  const adminPassword = await getAdminPasswordFromSession();
  if (!adminPassword) {
    return NextResponse.json({ error: "Unauthorized: Admin session expired." }, { status: 401 });
  }

  try {
    const partner = await serverAdminCreatePendingPartner(adminPassword);
    return NextResponse.json({ partner });
  } catch (error) {
    return NextResponse.json(
      { error: adminErrorMessage(error, "Failed to create a partner code.") },
      { status: adminErrorStatus(error) },
    );
  }
}
