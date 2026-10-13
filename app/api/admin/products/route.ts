import { NextRequest, NextResponse } from "next/server";
import { adminErrorMessage } from "@/lib/admin-error";
import { getAdminPasswordFromSession } from "@/lib/admin-session";
import { normalizeProduct, PRODUCT_COLUMNS, PRODUCT_STATUSES, SHOP_IMAGES } from "@/lib/catalog";
import { supabaseAdminShop } from "@/lib/supabase-admin";

// The admin session check below is the authorisation; the service role then writes the
// products table in the shop schema (doctors, or sandbox on the mirror). Edit only:
// products are never created or deleted here (see Obsidian "Future Changes/Add Product").

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

  // Read directly, not via loadCatalog: admin must see a failure, not the fallback list.
  const { data, error } = await supabaseAdminShop!
    .from("products")
    .select(`${PRODUCT_COLUMNS}, updated_at`)
    .order("kind")
    .order("sort_order");
  if (error) {
    return NextResponse.json({ error: adminErrorMessage(error, "Failed to load products.") }, { status: 500 });
  }
  return NextResponse.json({
    products: (data ?? []).map((row) => ({ ...normalizeProduct(row), updatedAt: String(row.updated_at ?? "") })),
  });
}

export async function POST(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Missing product id." }, { status: 400 });

  const row = validate(body);
  if (typeof row === "string") return NextResponse.json({ error: row }, { status: 400 });

  const { data, error } = await supabaseAdminShop!
    .from("products")
    .update({ ...row, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(`${PRODUCT_COLUMNS}, updated_at`)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: adminErrorMessage(error, "Failed to save product.") }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Product not found." }, { status: 404 });
  return NextResponse.json({ product: { ...normalizeProduct(data), updatedAt: String(data.updated_at ?? "") } });
}

const wholePesos = (value: unknown) => {
  const n = Number(value);
  return Number.isInteger(n) ? n : NaN;
};

/** Returns the columns to write, or an error message for the admin. id and kind never change. */
function validate(body: Record<string, unknown>) {
  const name = String(body.name ?? "").trim();
  const price = wholePesos(body.price);
  const perCap = wholePesos(body.perCap);
  const caps = wholePesos(body.caps);
  const days = wholePesos(body.days ?? 0);
  const sortOrder = wholePesos(body.sortOrder ?? 0);
  const image = String(body.image ?? "");
  const status = PRODUCT_STATUSES.find((value) => value === body.status);

  if (!name) return "Give the product a name.";
  if (!(price >= 1)) return "Price must be a whole peso amount of at least ₱1.";
  if (!(perCap >= 1)) return "Price per capsule must be a whole peso amount of at least ₱1.";
  if (!(caps >= 1)) return "Capsules must be a whole number of at least 1.";
  if (!(days >= 0)) return "Days must be a whole number.";
  if (Number.isNaN(sortOrder)) return "Display order must be a whole number.";
  if (image && !SHOP_IMAGES.includes(image)) return "Pick one of the listed images.";
  if (!status) return "Pick a status: active, hidden or archived.";

  const includes = Array.isArray(body.includes)
    ? body.includes.map((item) => String(item).trim()).filter(Boolean).slice(0, 10)
    : [];

  return {
    name,
    dosage: String(body.dosage ?? "").trim(),
    includes,
    includes_note: String(body.includesNote ?? "").trim(),
    phase: String(body.phase ?? "").trim(),
    days,
    caps,
    price,
    per_cap_price: perCap,
    tag: String(body.tag ?? "").trim(),
    image,
    sort_order: sortOrder,
    status,
  };
}
