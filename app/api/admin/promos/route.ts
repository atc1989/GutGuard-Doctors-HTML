import { NextRequest, NextResponse } from "next/server";
import { adminErrorMessage } from "@/lib/admin-error";
import { getAdminPasswordFromSession } from "@/lib/admin-session";
import { MAX_PROMO_PERCENT, normalizePromo, PROMO_COLUMNS, TIERS, TRIALS } from "@/lib/catalog";
import { supabaseAdminShop } from "@/lib/supabase-admin";

// The admin session check below is the authorisation; the service role then writes the
// promos table in the shop schema (doctors, or sandbox on the mirror).
const PRODUCT_IDS = new Set([...TIERS, ...TRIALS].map((item) => item.id));
const DAY = /^\d{4}-\d{2}-\d{2}$/;

async function guard() {
  if (!(await getAdminPasswordFromSession())) {
    return NextResponse.json({ error: "Unauthorized: Admin session expired." }, { status: 401 });
  }
  if (!supabaseAdminShop) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  return null;
}

export async function GET() {
  const denied = await guard();
  if (denied) return denied;

  const { data, error } = await supabaseAdminShop!
    .from("promos")
    .select(PROMO_COLUMNS)
    .order("starts_on", { ascending: false });
  if (error) {
    return NextResponse.json({ error: adminErrorMessage(error, "Failed to load promos.") }, { status: 500 });
  }
  return NextResponse.json({ promos: (data ?? []).map((row) => normalizePromo(row as Record<string, unknown>)) });
}

export async function POST(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const row = validate(body);
  if (typeof row === "string") return NextResponse.json({ error: row }, { status: 400 });

  const id = typeof body.id === "string" && body.id ? body.id : null;
  const query = id
    ? supabaseAdminShop!.from("promos").update({ ...row, updated_at: new Date().toISOString() }).eq("id", id)
    : supabaseAdminShop!.from("promos").insert(row);
  const { data, error } = await query.select(PROMO_COLUMNS).single();
  if (error) {
    return NextResponse.json({ error: adminErrorMessage(error, "Failed to save promo.") }, { status: 500 });
  }
  return NextResponse.json({ promo: normalizePromo(data as Record<string, unknown>) });
}

export async function DELETE(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing promo id." }, { status: 400 });

  const { error } = await supabaseAdminShop!.from("promos").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: adminErrorMessage(error, "Failed to delete promo.") }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/** Returns the row to write, or an error message for the admin. */
function validate(body: Record<string, unknown>) {
  const name = String(body.name ?? "").trim();
  const label = String(body.label ?? "").trim();
  const startsOn = String(body.starts_on ?? "");
  const endsOn = body.ends_on ? String(body.ends_on) : null;

  if (!name) return "Give the promo a name.";
  if (!DAY.test(startsOn)) return "Pick a start date.";
  if (endsOn && !DAY.test(endsOn)) return "End date is not a valid date.";
  if (endsOn && endsOn < startsOn) return "End date cannot be before the start date.";

  const discounts: Record<string, number> = {};
  for (const [id, value] of Object.entries((body.discounts ?? {}) as Record<string, unknown>)) {
    const pct = Number(value);
    if (!PRODUCT_IDS.has(id)) return `Unknown product: ${id}.`;
    if (!Number.isInteger(pct) || pct < 1 || pct > MAX_PROMO_PERCENT) {
      return `Discount must be a whole number from 1 to ${MAX_PROMO_PERCENT}%.`;
    }
    discounts[id] = pct;
  }
  if (Object.keys(discounts).length === 0) return "Choose at least one product.";

  return { name, label, starts_on: startsOn, ends_on: endsOn, enabled: body.enabled !== false, discounts };
}
