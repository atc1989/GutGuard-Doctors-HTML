import { NextRequest, NextResponse } from "next/server";
import { getAdminPasswordFromSession } from "@/lib/admin-session";
import { serverSendSmsBlast } from "@/lib/admin-server-api";

export async function POST(req: NextRequest) {
  const adminPassword = await getAdminPasswordFromSession();
  if (!adminPassword) {
    return NextResponse.json({ error: "Unauthorized: Admin session expired." }, { status: 401 });
  }

  try {
    const { doctorIds, title, message } = await req.json();
    const result = await serverSendSmsBlast(adminPassword, doctorIds, title, message);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send SMS blast." },
      { status: 500 },
    );
  }
}
