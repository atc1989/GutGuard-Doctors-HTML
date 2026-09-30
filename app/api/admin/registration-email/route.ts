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
      { error: error instanceof Error ? error.message : "Failed to load registration email settings." },
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
    if (body.action === "test") {
      const result = await serverSendRegistrationEmailTest(adminPassword, body.testEmail);
      return NextResponse.json(result);
    }

    const settings = await serverSaveRegistrationEmailSettings(adminPassword, body.settings);
    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save registration email settings." },
      { status: 500 },
    );
  }
}
