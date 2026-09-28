import { NextRequest, NextResponse } from "next/server";
import { getAdminPasswordFromSession } from "@/lib/admin-session";
import {
  getRegistrationEmailSettings,
  saveRegistrationEmailSettings,
  sendRegistrationEmailTest,
} from "@/lib/api";

export async function GET() {
  const adminPassword = await getAdminPasswordFromSession();
  if (!adminPassword) {
    return NextResponse.json({ error: "Unauthorized: Admin session expired." }, { status: 401 });
  }

  try {
    const settings = await getRegistrationEmailSettings(adminPassword);
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
      const result = await sendRegistrationEmailTest(adminPassword, body.testEmail);
      return NextResponse.json(result);
    }

    const saved = await saveRegistrationEmailSettings(adminPassword, body.settings);
    return NextResponse.json({ settings: saved });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Registration email action failed." },
      { status: 500 },
    );
  }
}
