import { adminErrorMessage, adminErrorStatus } from "@/lib/admin-error";
import { getAdminPasswordFromSession } from "@/lib/admin-session";
import { serverAdminListWithdrawals, serverAdminProcessWithdrawal } from "@/lib/admin-server-api";
import { NextResponse } from "next/server";

export async function GET() {
  const adminPassword = await getAdminPasswordFromSession("withdrawals");
  if (!adminPassword) {
    return NextResponse.json({ error: "Unauthorized: admin session expired, or this login can't open this section." }, { status: 401 });
  }

  try {
    const withdrawals = await serverAdminListWithdrawals(adminPassword);
    return NextResponse.json({ withdrawals });
  } catch (error) {
    return NextResponse.json(
      { error: adminErrorMessage(error, "Failed to load withdrawals.") },
      { status: adminErrorStatus(error) },
    );
  }
}

export async function POST(request: Request) {
  const adminPassword = await getAdminPasswordFromSession("withdrawals");
  if (!adminPassword) {
    return NextResponse.json({ error: "Unauthorized: admin session expired, or this login can't open this section." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");
  const id = text(body.id, 64);
  const status = body.status;
  if (!id || (status !== "approved" && status !== "rejected")) {
    return NextResponse.json({ error: "Missing request id or status." }, { status: 400 });
  }

  try {
    const withdrawal = await serverAdminProcessWithdrawal(adminPassword, id, status, text(body.reference, 120), text(body.note, 500));
    return NextResponse.json({ withdrawal });
  } catch (error) {
    return NextResponse.json(
      { error: adminErrorMessage(error, "Failed to update the withdrawal.") },
      { status: adminErrorStatus(error) },
    );
  }
}
