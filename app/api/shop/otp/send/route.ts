import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, isSupabaseAdminConfigured, SHOP_SCHEMA } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Texts the buyer a checkout code for the order they just saved.
 *
 * Public by necessity - the buyer has no account - so it takes nothing but an order id and
 * returns nothing about the order. Every send is a real SMS credit, which is what the per-order
 * throttle in `proxy.ts` is for.
 */
export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured) {
    return NextResponse.json({ error: "Verification is not configured." }, { status: 500 });
  }

  let orderId = "";
  try {
    const body = await request.json();
    orderId = typeof body?.orderId === "string" ? body.orderId : "";
  } catch {
    return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
  }
  if (!orderId) return NextResponse.json({ error: "Missing orderId" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.functions.invoke("send-order-sms", {
    body: { orderId, kind: "otp", action: "send", schema: SHOP_SCHEMA },
  });

  if (error) {
    console.error("Checkout code send failed", orderId, error.message);
    return NextResponse.json({ error: "Could not send the code. Try again." }, { status: 502 });
  }
  return NextResponse.json({ sent: Boolean(data?.sent), skipped: Boolean(data?.skipped) });
}
