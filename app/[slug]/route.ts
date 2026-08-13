import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const RESERVED = new Set(["admin", "api", "beehive", "dr", "partner", "physicians", "r", "science", "shop", "system"]);
const COOKIE = "gg_partner_ref";
const MAX_AGE = 30 * 24 * 60 * 60;

function invalidInvitation(destination: URL) {
  destination.searchParams.set("invitation", "invalid");
  const response = NextResponse.redirect(destination, 307);
  response.cookies.delete(COOKIE);
  return response;
}

export async function GET(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await context.params;
  const slug = rawSlug.trim().toLowerCase();
  const destination = new URL("/physicians/register", request.url);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || RESERVED.has(slug)) {
    return invalidInvitation(destination);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return NextResponse.redirect(destination, 307);
  const db = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data, error } = await db.rpc("get_partner_invitation", { p_slug: slug });
  const invitation = Array.isArray(data) ? data[0] : data;
  if (error || !invitation?.routing_slug) {
    return invalidInvitation(destination);
  }

  destination.searchParams.set("ref", invitation.routing_slug);
  const response = NextResponse.redirect(destination, 307);
  response.cookies.set(COOKIE, invitation.routing_slug, { httpOnly: true, secure: true, sameSite: "lax", maxAge: MAX_AGE, path: "/physicians/register" });
  return response;
}
