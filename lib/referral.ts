export const REFERRAL_COOKIE = "gg_ref";

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
