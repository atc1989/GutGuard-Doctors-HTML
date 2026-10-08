import { adminErrorMessage } from "@/lib/admin-error";
import { NextRequest, NextResponse } from "next/server";
import { getAdminPasswordFromSession } from "@/lib/admin-session";
import { serverAdminListTestimonials, serverAdminReviewTestimonial } from "@/lib/admin-server-api";

export async function GET(req: NextRequest) {
  const adminPassword = await getAdminPasswordFromSession();
  if (!adminPassword) {
    return NextResponse.json({ error: "Unauthorized: Admin session expired." }, { status: 401 });
  }

  const status = req.nextUrl.searchParams.get("status");
  try {
    const stories = await serverAdminListTestimonials(
      adminPassword,
      status ? (status as any) : undefined,
    );
    return NextResponse.json({ stories });
  } catch (error) {
    return NextResponse.json(
      { error: adminErrorMessage(error, "Failed to load testimonials.") },
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
    const saved = await serverAdminReviewTestimonial(adminPassword, input);
    return NextResponse.json({ story: saved });
  } catch (error) {
    return NextResponse.json(
      { error: adminErrorMessage(error, "Failed to review testimonial.") },
      { status: 500 },
    );
  }
}
