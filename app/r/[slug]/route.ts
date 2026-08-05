import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { REFERRAL_COOKIE, REFERRAL_MAX_AGE_SECONDS } from "@/lib/referral";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = { params: Promise<{ slug: string }> };

/**
 * Partner referral link: /r/<slug> -> remembers the referrer, then sends the visitor
 * to the shop. Deliberately lives on the shop's own origin - a link on another
 * subdomain could not set a cookie this origin can read, and the attribution would
 * silently vanish.
 *
 * Distinct from /dr/<slug>, which is the doctor's TikTok profile link and is baked
 * into QR codes already in circulation. Do not merge them.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { slug } = await context.params;
  const shopUrl = new URL("/shop", request.url);
  const response = NextResponse.redirect(shopUrl, { status: 302 });

  if (!slug || !supabase) return response;

  const clean = decodeURIComponent(slug).trim().toLowerCase();
  if (!clean) return response;

  const { data, error } = await supabase.rpc("get_referral_partner", { p_slug: clean });
  const matched = typeof data === "string" ? data : Array.isArray(data) ? data[0] : null;

  // Unknown or unreachable slug: still deliver the visitor to the shop, but leave any
  // existing cookie intact. A typo'd link must not wipe out a real prior referral.
  if (error || !matched) return response;

  response.cookies.set(REFERRAL_COOKIE, matched, {
    maxAge: REFERRAL_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    // Not httpOnly on purpose: the checkout form reads this in the browser to attach it
    // to the order. It is a public partner slug, not a credential.
    httpOnly: false,
  });

  return response;
}
