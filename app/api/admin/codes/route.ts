import { adminErrorMessage, adminErrorStatus } from "@/lib/admin-error";
import { getAdminPasswordFromSession } from "@/lib/admin-session";
import { serverAdminCreatePendingPartner, serverUpdatePartnerCodeFields } from "@/lib/admin-server-api";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const adminPassword = await getAdminPasswordFromSession("codes");
  if (!adminPassword) {
    return NextResponse.json({ error: "Unauthorized: admin session expired, or this login can't open this section." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

  try {
    const partner = await serverAdminCreatePendingPartner(
      adminPassword,
      text(body.note, 200),
      text(body.source, 120),
      text(body.label, 40),
    );
    return NextResponse.json({ partner });
  } catch (error) {
    return NextResponse.json(
      { error: adminErrorMessage(error, "Failed to create a partner code.") },
      { status: adminErrorStatus(error) },
    );
  }
}

/** Edit a code's label, description and where-used: { id, label, note, source }. */
export async function PATCH(request: Request) {
  const adminPassword = await getAdminPasswordFromSession("codes");
  if (!adminPassword) {
    return NextResponse.json({ error: "Unauthorized: admin session expired, or this login can't open this section." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  if (typeof body.id !== "string" || !body.id) {
    return NextResponse.json({ error: "Expected { id, label, note, source }." }, { status: 400 });
  }
  const text = (value: unknown) => (typeof value === "string" ? value : "");

  try {
    const saved = await serverUpdatePartnerCodeFields({
      id: body.id,
      code_label: text(body.label),
      code_note: text(body.note),
      code_source: text(body.source),
    });
    return NextResponse.json({ partner: saved });
  } catch (error) {
    return NextResponse.json(
      { error: adminErrorMessage(error, "Failed to save the partner code.") },
      { status: adminErrorStatus(error) },
    );
  }
}
