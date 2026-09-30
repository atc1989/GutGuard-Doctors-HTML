import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  encryptAdminSession,
  verifyAdminPassword,
} from "@/lib/admin-session";

export async function POST(req: NextRequest) {
  let password = "";
  try {
    const body = await req.json();
    password = typeof body?.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!password) {
    return NextResponse.json({ error: "Admin password is required." }, { status: 400 });
  }

  const isValid = await verifyAdminPassword(password);
  if (!isValid) {
    return NextResponse.json({ error: "Invalid admin password." }, { status: 401 });
  }

  const token = encryptAdminSession(password);
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 86400, // 24 hours
  });

  return NextResponse.json({ success: true });
}
