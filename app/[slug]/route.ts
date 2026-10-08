import { NextRequest, NextResponse } from "next/server";
import { PARTNER_SLUG_PATTERN, RESERVED_PARTNER_SLUGS } from "@/lib/referral";
import { supabase } from "@/lib/supabase";

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
  if (!PARTNER_SLUG_PATTERN.test(slug) || RESERVED_PARTNER_SLUGS.has(slug)) {
    return invalidInvitation(destination);
  }

  // Not configured is not an invalid invitation: send them to the form without the tag.
  if (!supabase) return NextResponse.redirect(destination, 307);

  const { data, error } = await supabase.rpc("get_partner_invitation", { p_slug: slug });
  const invitation = Array.isArray(data) ? data[0] : data;

  if (error || !invitation?.routing_slug) {
    return invalidInvitation(destination);
  }

  destination.searchParams.set("ref", invitation.routing_slug);
  const response = NextResponse.redirect(destination, 307);
  response.cookies.set(COOKIE, invitation.routing_slug, { httpOnly: true, secure: true, sameSite: "lax", maxAge: MAX_AGE, path: "/physicians/register" });
  return response;
}
