import { adminErrorMessage } from "@/lib/admin-error";
import { NextRequest, NextResponse } from "next/server";
import { getAdminPasswordFromSession } from "@/lib/admin-session";
import { serverCallTikTokAdminApi } from "@/lib/admin-server-api";
import type { TikTokAdminAction } from "@/lib/api";

export async function POST(req: NextRequest) {
  const adminPassword = await getAdminPasswordFromSession();
  if (!adminPassword) {
    return NextResponse.json({ error: "Unauthorized: Admin session expired." }, { status: 401 });
  }

  try {
    const { action, payload } = (await req.json()) as {
      action: TikTokAdminAction;
      payload: Record<string, unknown>;
    };

    const result = await serverCallTikTokAdminApi(adminPassword, action, payload);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: adminErrorMessage(error, "TikTok admin action failed.") },
      { status: 500 },
    );
  }
}
