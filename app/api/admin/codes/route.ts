import { adminErrorMessage, adminErrorStatus } from "@/lib/admin-error";
import { getAdminPasswordFromSession } from "@/lib/admin-session";
import { serverAdminCreatePendingPartner } from "@/lib/admin-server-api";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const adminPassword = await getAdminPasswordFromSession("codes");
  if (!adminPassword) {
    return NextResponse.json({ error: "Unauthorized: admin session expired, or this login can't open this section." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

  try {
    const partner = await serverAdminCreatePendingPartner(adminPassword, text(body.note, 200), text(body.source, 120));
    return NextResponse.json({ partner });
  } catch (error) {
    return NextResponse.json(
      { error: adminErrorMessage(error, "Failed to create a partner code.") },
      { status: adminErrorStatus(error) },
    );
  }
}
