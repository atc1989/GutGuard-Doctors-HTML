import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const PARTNER_REDIRECT_ORIGIN = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://partners.gutguard.ph"
).replace(/\/$/, "");

export async function POST(req: NextRequest) {
  let email: string;
  try {
    const body = await req.json();
    email = (typeof body?.email === "string" ? body.email : "").trim().toLowerCase();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "A valid email address is required." },
      { status: 400 },
    );
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: "Auth is not configured on this server." },
      { status: 503 },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    db: { schema: "doctors" },
    auth: { persistSession: false },
  });

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${PARTNER_REDIRECT_ORIGIN}/partner`,
    },
  });

  if (error) {
    // Propagate Supabase's own 429 so the client error handlers can detect it.
    const status = error.status === 429 ? 429 : 502;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ sent: true });
}
