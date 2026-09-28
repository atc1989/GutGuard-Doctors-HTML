import { NextResponse } from "next/server";
import { getAdminPasswordFromSession } from "@/lib/admin-session";

export async function GET() {
  const password = await getAdminPasswordFromSession();
  return NextResponse.json({ authenticated: Boolean(password) });
}
