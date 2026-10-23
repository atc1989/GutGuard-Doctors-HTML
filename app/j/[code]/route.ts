import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const COOKIE = "gg_partner_ref";
const MAX_AGE = 30 * 24 * 60 * 60;

/**
 * Join link on partner posters: /j/<code> -> the registration form. Like the old /<KEY> links
 * (app/[slug]/route.ts), the referrer travels in a cookie the register page reads, so the
 * partner's name stays out of the address bar.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  const destination = new URL("/physicians/register", request.url);

  const slug = supabase ? (await supabase.rpc("partner_slug_by_code", { p_code: code })).data : null;
  if (typeof slug !== "string" || !slug) {
    destination.searchParams.set("invitation", "invalid");
    const response = NextResponse.redirect(destination, 307);
    response.cookies.delete(COOKIE);
    return response;
  }

  const response = NextResponse.redirect(destination, 307);
  response.cookies.set(COOKIE, slug, { httpOnly: true, secure: true, sameSite: "lax", maxAge: MAX_AGE, path: "/physicians/register" });
  return response;
}
