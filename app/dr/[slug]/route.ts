import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { slug } = await context.params;
  const fallbackUrl = new URL("/", request.url);

  if (!slug || !supabase) {
    return NextResponse.redirect(fallbackUrl, { status: 302 });
  }

  const { data, error } = await supabase.rpc("get_doctor_redirect", {
    p_routing_slug: decodeURIComponent(slug),
  });

  if (error) {
    console.error("Doctor redirect lookup failed:", error.message);
    return NextResponse.redirect(fallbackUrl, { status: 302 });
  }

  const redirectUrl = Array.isArray(data) ? data[0] : data;

  if (!isHttpUrl(redirectUrl)) {
    return NextResponse.redirect(fallbackUrl, { status: 302 });
  }

  return NextResponse.redirect(redirectUrl, { status: 302 });
}

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
