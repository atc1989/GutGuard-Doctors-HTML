import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-session";

export async function GET() {
  const access = await getAdminSession();
  return NextResponse.json(access ? { authenticated: true, ...access } : { authenticated: false });
}
