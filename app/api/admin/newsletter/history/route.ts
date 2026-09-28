import { NextResponse } from "next/server";
import { getAdminPasswordFromSession } from "@/lib/admin-session";
import { getNewsletterSendHistory } from "@/lib/api";

export async function GET() {
  const adminPassword = await getAdminPasswordFromSession();
  if (!adminPassword) {
    return NextResponse.json({ error: "Unauthorized: Admin session expired." }, { status: 401 });
  }

  try {
    const history = await getNewsletterSendHistory(adminPassword);
    return NextResponse.json({ history });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load newsletter history." },
      { status: 500 },
    );
  }
}
