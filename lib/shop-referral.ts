import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseShop } from "@/lib/supabase";
import { REFERRAL_COOKIE, REFERRAL_MAX_AGE_SECONDS, REFERRAL_SHOP_NAME_COOKIE } from "@/lib/referral";

/**
 * Remembers the referrer, then sends the visitor to the shop. Shared by /r/<key> (old printed
 * links) and /s/<code>. Must run on the shop's own origin - a cookie set on another subdomain
 * is not readable there, and the attribution would silently vanish.
 */
export async function shopReferralRedirect(request: NextRequest, key: string) {
  const clean = key.trim().toLowerCase();

  // Shared links sell Try First only unless an admin turned Full Protocol on for this
  // partner. Partners live in `doctors` even on the sandbox shop, hence `supabase`.
  // Unknown slug or lookup error -> trial only, never the wider shop.
  const showsProtocol =
    clean && supabase
      ? (await supabase.rpc("shop_link_shows_protocol", { p_key: clean })).data === true
      : false;
  const shopUrl = new URL(showsProtocol ? "/shop" : "/shop?trial", request.url);
  const response = NextResponse.redirect(shopUrl, { status: 302 });

  if (!clean || !supabaseShop) return response;

  // Resolves the slug and records the click in one call - see track_referral_click.
  const { data, error } = await supabaseShop.rpc("track_referral_click", { p_slug: clean });
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

  response.cookies.set(REFERRAL_SHOP_NAME_COOKIE, getReferralShopName(matched, request), {
    maxAge: REFERRAL_MAX_AGE_SECONDS,
    path: "/",
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
