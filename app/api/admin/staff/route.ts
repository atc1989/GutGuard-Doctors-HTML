import { NextRequest, NextResponse } from "next/server";
import { adminErrorMessage } from "@/lib/admin-error";
import { getAdminPasswordFromSession } from "@/lib/admin-session";
import { cleanModules, cleanUsername, hashPassword } from "@/lib/admin-token";
import { supabaseAdminShop } from "@/lib/supabase-admin";

// Admin -> Staff: the super admin creates staff logins and ticks the sections each may open.
// Owner only (no module passed). Rows live in <shop schema>.admin_staff; hashes never leave here.
const COLUMNS = "id, username, modules, active, created_at";
const MIN_PASSWORD = 8;

async function guard() {
  if (!(await getAdminPasswordFromSession())) {
    return NextResponse.json({ error: "Only the super admin can manage staff." }, { status: 401 });
  }
  if (!supabaseAdminShop) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  return null;
}

const fail = (error: unknown, fallback: string) => {
  const duplicate = (error as { code?: string })?.code === "23505";
  return NextResponse.json(
    { error: duplicate ? "That username is already taken." : adminErrorMessage(error, fallback) },
    { status: duplicate ? 409 : 500 },
  );
};

const passwordProblem = (password: unknown) =>
  typeof password !== "string" || password.trim().length < MIN_PASSWORD
    ? `Password must be at least ${MIN_PASSWORD} characters.`
    : null;

export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  const { data, error } = await supabaseAdminShop!.from("admin_staff").select(COLUMNS).order("username");
  if (error) return fail(error, "Failed to load staff.");
  return NextResponse.json({ staff: data ?? [] });
}

export async function POST(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const username = cleanUsername(body.username);
  if (!username) {
    return NextResponse.json(
      { error: "Username: 3–32 lowercase letters, numbers, - or _ (not \"admin\")." },
      { status: 400 },
    );
  }
  const problem = passwordProblem(body.password);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const { data, error } = await supabaseAdminShop!
    .from("admin_staff")
    .insert({ username, password_hash: await hashPassword(body.password.trim()), modules: cleanModules(body.modules) })
    .select(COLUMNS)
    .single();
  if (error) return fail(error, "Failed to create the account.");
  return NextResponse.json({ member: data });
}

/** Edits sections, switches an account on/off, or resets its password (which signs it out). */
export async function PATCH(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  if (typeof body.id !== "string" || !body.id) return NextResponse.json({ error: "Missing account id." }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (body.modules !== undefined) update.modules = cleanModules(body.modules);
  if (typeof body.active === "boolean") update.active = body.active;
  if (body.password !== undefined) {
    const problem = passwordProblem(body.password);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });
    update.password_hash = await hashPassword(body.password.trim());
    update.password_changed_at = new Date().toISOString();
  }
  if (!Object.keys(update).length) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });

  const { data, error } = await supabaseAdminShop!
    .from("admin_staff")
    .update(update)
    .eq("id", body.id)
    .select(COLUMNS)
    .maybeSingle();
  if (error) return fail(error, "Failed to update the account.");
  if (!data) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  return NextResponse.json({ member: data });
}

export async function DELETE(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing account id." }, { status: 400 });
  const { error } = await supabaseAdminShop!.from("admin_staff").delete().eq("id", id);
  if (error) return fail(error, "Failed to delete the account.");
  return NextResponse.json({ success: true });
}
