import type { getSupabaseAdmin } from "@/lib/supabase-admin";

/** Philippine mobile, written the way the shop stores it: 09XXXXXXXXX. Empty string when not valid. */
export function normalizeMobile(raw: string): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  const last10 = digits.length === 12 && digits.startsWith("63") ? digits.slice(2) : digits.length === 11 && digits.startsWith("0") ? digits.slice(1) : digits.length === 10 ? digits : "";
  return last10.startsWith("9") ? `0${last10}` : "";
}

/**
 * 5-Night Watch rule: new buyers, or no paid order in the last 12 months, checked on the
 * number of the person who takes the capsules. Fails closed: if the check cannot run, the
 * Watch is refused and the shop offers the Blister instead.
 */
export async function isWatchEligible(supabase: ReturnType<typeof getSupabaseAdmin>, mobile: string): Promise<boolean> {
  const normalized = normalizeMobile(mobile);
  if (!normalized) return false;
  const { data, error } = await supabase.rpc("shop_watch_eligible", { p_mobile: normalized });
  if (error) return false;
  return data === true;
}
