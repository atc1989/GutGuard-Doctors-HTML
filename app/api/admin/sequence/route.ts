import { NextRequest, NextResponse } from "next/server";
import { getAdminPasswordFromSession } from "@/lib/admin-session";
import {
  serverDeleteSequenceStep,
  serverGetSequenceProgress,
  serverGetSequenceSteps,
  serverReorderSequenceSteps,
  serverResendSequenceStep,
  serverUpsertSequenceStep,
} from "@/lib/admin-server-api";

export async function GET(req: NextRequest) {
  const adminPassword = await getAdminPasswordFromSession();
  if (!adminPassword) {
    return NextResponse.json({ error: "Unauthorized: Admin session expired." }, { status: 401 });
  }

  const type = req.nextUrl.searchParams.get("type");
  try {
    if (type === "progress") {
      const data = await serverGetSequenceProgress(adminPassword);
      return NextResponse.json(data);
    }

    const steps = await serverGetSequenceSteps(adminPassword);
    return NextResponse.json({ steps });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load sequence." },
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
    const body = await req.json();
    if (body.action === "upsert") {
      const step = await serverUpsertSequenceStep(adminPassword, body.step);
      return NextResponse.json({ step });
    }
    if (body.action === "delete") {
      await serverDeleteSequenceStep(adminPassword, body.stepId);
      return NextResponse.json({ success: true });
    }
    if (body.action === "reorder") {
      await serverReorderSequenceSteps(adminPassword, body.stepIds);
      return NextResponse.json({ success: true });
    }
    if (body.action === "resend") {
      await serverResendSequenceStep(String(body.doctorId), Number(body.stepNumber));
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sequence operation failed." },
      { status: 500 },
    );
  }
}
