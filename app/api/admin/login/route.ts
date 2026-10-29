import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_S,
  createAdminSessionToken,
  matchAdminLogin,
} from "@/lib/admin-session";

export async function POST(req: NextRequest) {
  let username = "";
  let password = "";
  try {
    const body = await req.json();
    username = typeof body?.username === "string" ? body.username : "";
    password = typeof body?.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!username || !password) {
    return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
  }

  const name = await matchAdminLogin(username, password);
  if (!name) {
    return NextResponse.json({ error: "Wrong username or password." }, { status: 401 });
  }

  const token = createAdminSessionToken(name);
  if (!token) return NextResponse.json({ error: "Admin login is not configured." }, { status: 503 });
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_S,
  });

  return NextResponse.json({ success: true });
}
