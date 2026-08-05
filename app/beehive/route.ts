import { NextResponse } from "next/server";

const GRACE_REFERRAL_SLUG = "dr-grace-saraza";
const DEFAULT_SHOP_ORIGIN = "https://shop.gutguard.ph";

/**
 * Friendly, one-off referral alias for Dr. Grace Saraza.
 *
 * Always enter the existing referral flow on the shop origin. That handler validates
 * the doctor, sets the 30-day attribution cookie, and redirects the visitor to /shop.
 */
export function GET() {
  const shopOrigin = process.env.NEXT_PUBLIC_SHOP_URL?.trim() || DEFAULT_SHOP_ORIGIN;
  const referralUrl = new URL(`/r/${GRACE_REFERRAL_SLUG}`, shopOrigin);

  return NextResponse.redirect(referralUrl, { status: 302 });
}
