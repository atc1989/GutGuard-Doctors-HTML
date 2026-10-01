import { adminErrorMessage } from "@/lib/admin-error";
import { NextRequest, NextResponse } from "next/server";
import { getAdminPasswordFromSession } from "@/lib/admin-session";
import {
  serverGetRegistrationEmailSettings,
  serverSaveRegistrationEmailSettings,
  serverSendRegistrationEmailTest,
} from "@/lib/admin-server-api";

export async function GET() {
  const adminPassword = await getAdminPasswordFromSession();
  if (!adminPassword) {
    return NextResponse.json({ error: "Unauthorized: Admin session expired." }, { status: 401 });
  }

  try {
    const settings = await serverGetRegistrationEmailSettings(adminPassword);
    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json(
      { error: adminErrorMessage(error, "Failed to load registration email settings.") },
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
    const body = await req.json();
    const templateKind = body.templateKind === "partner-referral" ? "partner-referral" : "registration";
    if (body.action === "get") {
      return NextResponse.json({ settings: await serverGetRegistrationEmailSettings(adminPassword, templateKind) });
    }
    if (body.action === "test") {
      const result = await serverSendRegistrationEmailTest(adminPassword, body.testEmail, templateKind);
      return NextResponse.json(result);
    }

    const settings = await serverSaveRegistrationEmailSettings(adminPassword, body.settings, templateKind);
    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json(
      { error: adminErrorMessage(error, "Failed to save registration email settings.") },
      { status: 500 },
    );
  }
}
