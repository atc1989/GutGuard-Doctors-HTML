import { NextRequest, NextResponse } from "next/server";
import { getAdminPasswordFromSession } from "@/lib/admin-session";
import { adminListTestimonials, adminReviewTestimonial } from "@/lib/api";

export async function GET(req: NextRequest) {
  const adminPassword = await getAdminPasswordFromSession();
  if (!adminPassword) {
    return NextResponse.json({ error: "Unauthorized: Admin session expired." }, { status: 401 });
  }

  const status = req.nextUrl.searchParams.get("status");
  try {
    const stories = await adminListTestimonials(
      adminPassword,
      status ? (status as any) : undefined,
    );
    return NextResponse.json({ stories });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load testimonials." },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const adminPassword = await getAdminPasswordFromSession();
  if (!adminPassword) {
    return NextResponse.json({ error: "Unauthorized: Admin session expired." }, { status: 401 });
  }

  try {
    const input = await req.json();
    const saved = await adminReviewTestimonial(adminPassword, input);
    return NextResponse.json({ story: saved });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to review testimonial." },
      { status: 500 },
    );
  }
}
