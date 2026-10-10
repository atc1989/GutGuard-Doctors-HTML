import { adminErrorMessage } from "@/lib/admin-error";
import { NextRequest, NextResponse } from "next/server";
import { getAdminPasswordFromSession } from "@/lib/admin-session";
import {
  serverGetDoctorRegistrations,
  serverSetDoctorShopProtocol,
  serverUpdateDoctorRegistration,
} from "@/lib/admin-server-api";

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

export async function PATCH(req: NextRequest) {
  const adminPassword = await getAdminPasswordFromSession();
  if (!adminPassword) {
    return NextResponse.json({ error: "Unauthorized: Admin session expired." }, { status: 401 });
  }

  try {
    const { id, shop_show_protocol } = await req.json();
    if (typeof id !== "string" || typeof shop_show_protocol !== "boolean") {
      return NextResponse.json({ error: "Expected { id, shop_show_protocol }." }, { status: 400 });
    }
    const updated = await serverSetDoctorShopProtocol(adminPassword, id, shop_show_protocol);
    return NextResponse.json({ shop_show_protocol: updated });
  } catch (error) {
    return NextResponse.json(
      { error: adminErrorMessage(error, "Failed to update shop link setting.") },
      { status: 500 },
    );
  }
}
