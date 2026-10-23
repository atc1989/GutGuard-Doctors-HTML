import { NextRequest, NextResponse } from "next/server";
import { shopReferralRedirect } from "@/lib/shop-referral";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SHOP_ORIGIN = (process.env.NEXT_PUBLIC_SHOP_URL ?? "https://shop.gutguard.ph").replace(/\/$/, "");

/**
 * Shop link on partner posters: /s/<code>. Printed on www.gutguard.ph so it is easy to say,
 * but the referral cookie has to land on the shop's own host, so other hosts hop there first.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;

  const host = (request.headers.get("x-forwarded-host") || request.headers.get("host") || "").toLowerCase();
  const shopHost = new URL(SHOP_ORIGIN).host;
  // ponytail: localhost serves every host in dev, so it skips the hop.
  if (host !== shopHost && !host.startsWith("localhost")) {
    return NextResponse.redirect(new URL(request.nextUrl.pathname + request.nextUrl.search, SHOP_ORIGIN), 307);
  }

  const slug = supabase ? (await supabase.rpc("partner_slug_by_code", { p_code: code })).data : null;
  // Unknown code: the shop, same as an unknown /r/ link. Never fall back to the raw code -
  // partner_by_key would match it against old link keys, some of which are all digits.
  if (typeof slug !== "string" || !slug) return NextResponse.redirect(new URL("/shop", request.url), 302);

  return shopReferralRedirect(request, slug);
}
