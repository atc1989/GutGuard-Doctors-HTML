import { adminErrorMessage } from "@/lib/admin-error";
import { NextRequest, NextResponse } from "next/server";
import { getAdminPasswordFromSession } from "@/lib/admin-session";
import { serverSendNewsletter } from "@/lib/admin-server-api";

export async function POST(req: NextRequest) {
  const adminPassword = await getAdminPasswordFromSession("newsletter");
  if (!adminPassword) {
    return NextResponse.json({ error: "Unauthorized: admin session expired, or this login can't open this section." }, { status: 401 });
  }

  try {
    const { doctorIds, subject, html } = await req.json();
    const result = await serverSendNewsletter(adminPassword, doctorIds, subject, html);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: adminErrorMessage(error, "Failed to send newsletter.") },
      { status: 500 },
    );
  }
}
