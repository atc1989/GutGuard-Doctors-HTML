import { NextRequest, NextResponse } from "next/server";
import { getAdminPasswordFromSession } from "@/lib/admin-session";
import { isSupabaseAdminConfigured as isSupabaseConfigured, supabaseAdmin as supabase } from "@/lib/supabase-admin";

function partnerAuthRedirectTo() {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://partners.gutguard.ph").replace(/\/$/, "");
  return `${site}/partner`;
}

export async function POST(req: NextRequest) {
  const adminPassword = await getAdminPasswordFromSession();
  if (!adminPassword) {
    return NextResponse.json({ error: "Unauthorized: Admin session expired." }, { status: 401 });
  }

  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "Email is required for impersonation." }, { status: 400 });
    }

    if (!isSupabaseConfigured || !supabase) {
      return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
    }

    const { data, error } = await supabase.functions.invoke("admin-impersonate", {
      body: { adminPassword, email, redirectTo: partnerAuthRedirectTo() },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Impersonation failed." },
      { status: 500 },
    );
  }
}
