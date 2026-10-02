import { NextResponse } from "next/server";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase-admin";
import { isWatchEligible, normalizeMobile } from "@/lib/shop-order";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/shop/first-buyer?mobile=09171234567 -> { eligible: boolean }
 * Lets checkout swap the 5-Night Watch for a Blister before the buyer pays.
 * /api/shop/order runs the same check again, so this answer is only for the screen.
 * Rate limited per IP in proxy.ts.
 */
export async function GET(request: Request) {
  const mobile = normalizeMobile(new URL(request.url).searchParams.get("mobile") ?? "");
  if (!mobile) return NextResponse.json({ error: "Enter an 11-digit mobile number." }, { status: 400 });
  if (!isSupabaseAdminConfigured) return NextResponse.json({ eligible: false, reason: "not_configured" });

  const eligible = await isWatchEligible(getSupabaseAdmin(), mobile);
  return NextResponse.json({ eligible }, { headers: { "Cache-Control": "no-store" } });
}
