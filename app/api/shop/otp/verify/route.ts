import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, isSupabaseAdminConfigured, SHOP_SCHEMA } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Checks the code the buyer typed. The attempt cap lives in the edge function with the stored
 * hash, so guessing is bounded even though this route is public.
 */
export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured) {
    return NextResponse.json({ error: "Verification is not configured." }, { status: 500 });
  }

  let orderId = "";
  let code = "";
  try {
    const body = await request.json();
    orderId = typeof body?.orderId === "string" ? body.orderId : "";
    code = typeof body?.code === "string" ? body.code : "";
  } catch {
    return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
  }
  if (!orderId) return NextResponse.json({ error: "Missing orderId" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.functions.invoke("send-order-sms", {
    body: { orderId, kind: "otp", action: "verify", code, schema: SHOP_SCHEMA },
  });

  // A wrong or expired code comes back as a non-2xx from the function, which the client library
  // reports as an error; the buyer still needs to be told which it was.
  if (error) {
    const message = await readFunctionError(error);
    return NextResponse.json({ verified: false, error: message }, { status: 400 });
  }
  if (!data?.verified) {
    return NextResponse.json({ verified: false, error: data?.error ?? "That code does not match" }, { status: 400 });
  }
  return NextResponse.json({ verified: true });
}

async function readFunctionError(error: unknown) {
  const fallback = "That code does not match. Ask for a new one.";
  const context = (error as { context?: Response })?.context;
  if (!context || typeof context.json !== "function") return fallback;
  try {
    const body = await context.json();
    return typeof body?.error === "string" && body.error ? body.error : fallback;
  } catch {
    return fallback;
  }
}
