import { NextRequest, NextResponse } from "next/server";
import { supabaseShop } from "@/lib/supabase";
import { REFERRAL_COOKIE, REFERRAL_MAX_AGE_SECONDS, REFERRAL_SHOP_NAME_COOKIE } from "@/lib/referral";

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

  if (!slug || !supabaseShop) return response;

  const clean = decodeURIComponent(slug).trim().toLowerCase();
  if (!clean) return response;

  // Resolves the slug and records the click in one call - see track_referral_click.
  const { data, error } = await supabaseShop.rpc("track_referral_click", { p_slug: clean });
  const matched = typeof data === "string" ? data : Array.isArray(data) ? data[0] : null;

  // Unknown or unreachable slug: still deliver the visitor to the shop, but leave any
  // existing cookie intact. A typo'd link must not wipe out a real prior referral.
  if (error || !matched) return response;

  const domain = sharedCookieDomain(request);
  response.cookies.set(REFERRAL_COOKIE, matched, {
    maxAge: REFERRAL_MAX_AGE_SECONDS,
    path: "/",
    domain,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    // Not httpOnly on purpose: the checkout form reads this in the browser to attach it
    // to the order. It is a public partner slug, not a credential.
    httpOnly: false,
  });

  response.cookies.set(REFERRAL_SHOP_NAME_COOKIE, getReferralShopName(matched, request), {
    maxAge: REFERRAL_MAX_AGE_SECONDS,
    path: "/",
    domain,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: false,
  });

  return response;
}

/**
 * Named shop fronts only. A partner's own name is deliberately NOT derived from the slug
 * any more - the shop greeted every visitor with the referrer's full name.
 */
function getReferralShopName(slug: string, request: NextRequest) {
  const requestedShop = request.nextUrl.searchParams.get("shop")?.trim().toLowerCase();
  if (slug === "dr-grace-saraza" && requestedShop === "beehive") return "Beehive";
  if (slug === "ginhawa") return "Ginhawa";

  return "";
}

/**
 * Addendum 05-A: gutguard.ph/shop and shop.gutguard.ph are one Shop. A referral remembered on one
 * address must be there on the other, so on these production hosts the cookie is shared by the
 * parent domain. Every other host (sandbox, previews, localhost) keeps its own cookie, as before.
 */
const SHARED_SHOP_HOSTS = ["gutguard.ph", "www.gutguard.ph", "shop.gutguard.ph"];
function sharedCookieDomain(request: NextRequest) {
  const host = (request.headers.get("x-forwarded-host") || request.headers.get("host") || "").split(":")[0].toLowerCase();
  return SHARED_SHOP_HOSTS.includes(host) ? ".gutguard.ph" : undefined;
}
