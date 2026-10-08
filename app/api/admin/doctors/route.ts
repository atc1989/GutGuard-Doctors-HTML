import { adminErrorMessage } from "@/lib/admin-error";
import { NextRequest, NextResponse } from "next/server";
import { getAdminPasswordFromSession } from "@/lib/admin-session";
import { serverGetDoctorRegistrations, serverUpdateDoctorRegistration } from "@/lib/admin-server-api";

export async function GET() {
  const adminPassword = await getAdminPasswordFromSession();
  if (!adminPassword) {
    return NextResponse.json({ error: "Unauthorized: Admin session expired." }, { status: 401 });
  }

  try {
    const doctors = await serverGetDoctorRegistrations(adminPassword);
    return NextResponse.json({ doctors });
  } catch (error) {
    return NextResponse.json(
      { error: adminErrorMessage(error, "Failed to load doctor registrations.") },
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
    const doctor = await req.json();
    const updated = await serverUpdateDoctorRegistration(adminPassword, doctor);
    return NextResponse.json({ doctor: updated });
  } catch (error) {
    return NextResponse.json(
      { error: adminErrorMessage(error, "Failed to update doctor registration.") },
      { status: 500 },
    );
  }
}
