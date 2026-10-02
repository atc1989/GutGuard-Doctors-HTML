import type { getSupabaseAdmin } from "@/lib/supabase-admin";

type Admin = ReturnType<typeof getSupabaseAdmin>;

/** Most paid Watches one payer may buy for other people in 12 months. CSA to confirm (Addendum 05). */
export const WATCH_GIFT_LIMIT = 3;

/** Philippine mobile, written the way the shop stores it: 09XXXXXXXXX. Empty string when not valid. */
export function normalizeMobile(raw: string): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  const last10 = digits.length === 12 && digits.startsWith("63") ? digits.slice(2) : digits.length === 11 && digits.startsWith("0") ? digits.slice(1) : digits.length === 10 ? digits : "";
  return last10.startsWith("9") ? `0${last10}` : "";
}

/**
 * 5-Night Watch rule: new buyers, or no paid order in the last 12 months, checked on the
 * number of the person who takes the capsules. An unpaid Watch order from the last 24 hours
 * also counts, except `excludeOrderId` (the order being paid). Fails closed: if the check
 * cannot run, the Watch is refused and the shop offers the Blister instead.
 */
export async function isWatchEligible(supabase: Admin, mobile: string, excludeOrderId?: string): Promise<boolean> {
  const normalized = normalizeMobile(mobile);
  if (!normalized) return false;
  const { data, error } = await supabase.rpc("shop_watch_eligible", { p_mobile: normalized, p_exclude: excludeOrderId ?? null });
  if (error) {
    console.error("shop_watch_eligible failed", error.message);
    return false;
  }
  return data === true;
}

/** A buyer starting again replaces their own unpaid Watch order, so it does not block them. */
export async function cancelUnpaidWatch(supabase: Admin, mobile: string): Promise<void> {
  const normalized = normalizeMobile(mobile);
  if (!normalized) return;
  const { error } = await supabase.rpc("shop_cancel_unpaid_watch", { p_mobile: normalized });
  if (error) console.error("shop_cancel_unpaid_watch failed", error.message);
}

/** Paid Watches this payer bought for other people in the last 12 months. Fails closed. */
export async function watchGiftsBought(supabase: Admin, payerMobile: string): Promise<number> {
  const { data, error } = await supabase.rpc("shop_watch_gifts", { p_payer_mobile: normalizeMobile(payerMobile) });
  if (error) {
    console.error("shop_watch_gifts failed", error.message);
    return WATCH_GIFT_LIMIT;
  }
  return Number(data) || 0;
}
