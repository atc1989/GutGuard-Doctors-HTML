import { NextRequest } from "next/server";
import { shopReferralRedirect } from "@/lib/shop-referral";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = { params: Promise<{ slug: string }> };

/**
 * Partner referral link: /r/<key> -> remembers the referrer, then sends the visitor to the
 * shop. <key> is a link key or routing slug. New posters print /s/<code> instead; this stays
 * for the links already in circulation.
 *
 * Distinct from /dr/<slug>, which is the doctor's TikTok profile link and is baked
 * into QR codes already in circulation. Do not merge them.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { slug } = await context.params;
  return shopReferralRedirect(request, decodeURIComponent(slug ?? ""));
}
