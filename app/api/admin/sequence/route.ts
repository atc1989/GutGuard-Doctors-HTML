import { NextRequest, NextResponse } from "next/server";
import { getAdminPasswordFromSession } from "@/lib/admin-session";
import {
  deleteSequenceStep,
  getSequenceProgress,
  getSequenceSteps,
  reorderSequenceSteps,
  upsertSequenceStep,
} from "@/lib/api";

export async function GET(req: NextRequest) {
  const adminPassword = await getAdminPasswordFromSession();
  if (!adminPassword) {
    return NextResponse.json({ error: "Unauthorized: Admin session expired." }, { status: 401 });
  }

  const type = req.nextUrl.searchParams.get("type");
  try {
    if (type === "progress") {
      const progressData = await getSequenceProgress(adminPassword);
      return NextResponse.json(progressData);
    }

    const steps = await getSequenceSteps(adminPassword);
    return NextResponse.json({ steps });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load sequence data." },
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
    const action = body.action;

    if (action === "upsert") {
      const step = await upsertSequenceStep(adminPassword, body.step);
      return NextResponse.json({ step });
    }

    if (action === "delete") {
      await deleteSequenceStep(adminPassword, body.stepId);
      return NextResponse.json({ success: true });
    }

    if (action === "reorder") {
      await reorderSequenceSteps(adminPassword, body.stepIds);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid sequence action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sequence operation failed." },
      { status: 500 },
    );
  }
}
