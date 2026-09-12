export const REFERRAL_COOKIE = "gg_ref";
export const REFERRAL_SHOP_NAME_COOKIE = "gg_ref_shop";

/** Last-click attribution with a 30-day window: each /r/<slug> visit overwrites the cookie. */
export const REFERRAL_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/** Reads the referral slug in the browser. Returns "" when absent or not in a browser. */
export function readReferralSlug(): string {
  if (typeof document === "undefined") return "";

  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${REFERRAL_COOKIE}=([^;]*)`));
  if (!match) return "";

  try {
    return decodeURIComponent(match[1]).trim().toLowerCase();
  } catch {
    return "";
  }
}

/**
 * The only shops that greet visitors by name. Partner shops used to greet customers with
 * the partner's full name; cookies set before that was removed live for 30 days, so the
 * value is checked here rather than trusted.
 */
export const SHOP_FRONT_NAMES = ["Beehive", "Ginhawa"];

/** Reads the public shop name paired with the active referral. */
export function readReferralShopName(): string {
  if (typeof document === "undefined" || !readReferralSlug()) return "";

  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${REFERRAL_SHOP_NAME_COOKIE}=([^;]*)`));
  if (!match) return "";

  try {
    const name = decodeURIComponent(match[1]).trim();
    return SHOP_FRONT_NAMES.includes(name) ? name : "";
  } catch {
    return "";
  }
}

/**
 * What a partner's public links are keyed by: the last 5 characters of their id. Short
 * enough to read off a poster, and not their name. The tail, not the head - seeded rows
 * share a prefix. A unique index on the same 5 characters keeps it unambiguous, and
 * register_doctor only hands out ids whose key is free; partner_by_key resolves it.
 */
export function partnerLinkKey(partnerId: string) {
  return partnerId.slice(-5);
}
