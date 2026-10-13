import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShopOrderItem } from "@/lib/api";

export type ProductKind = "protocol" | "trial";
export type ProductStatus = "active" | "hidden" | "archived";

/** A row of the `products` table. `id` never changes - orders and promos reference it. */
export type Product = {
  id: string;
  kind: ProductKind;
  name: string;
  phase: string; // "30-day"; protocol tiers only
  days: number;
  caps: number;
  price: number; // the exact amount charged, whole pesos
  perCap: number; // typed in by admin, display only - never price / caps
  tag: string;
  image: string; // trials only
  sortOrder: number;
  status: ProductStatus;
  dosage: string; // "1–2 capsules a day"
  includes: string[]; // "What's included" on the package card
  includesNote: string; // line under the included list
};

/**
 * Used when the products table cannot be read. Shop and checkout both fall back to it,
 * so they always agree on prices. Matches the seed in the shop_products migration.
 */
export const DEFAULT_PRODUCTS: Product[] = [
  { id: "start", kind: "protocol", name: "Start", phase: "30-day", days: 30, caps: 30, price: 3999, perCap: 133, tag: "", image: "", sortOrder: 1, status: "active", dosage: "1–2 capsules a day", includes: [], includesNote: "" },
  { id: "grow", kind: "protocol", name: "Grow", phase: "60-day", days: 60, caps: 90, price: 10999, perCap: 122, tag: "Popular", image: "", sortOrder: 2, status: "active", dosage: "2–4 capsules a day", includes: [], includesNote: "" },
  { id: "peak", kind: "protocol", name: "Peak", phase: "90-day", days: 90, caps: 330, price: 29999, perCap: 90, tag: "Best rate", image: "", sortOrder: 3, status: "active", dosage: "4–6 capsules a day", includes: [], includesNote: "" },
  { id: "trial-blister", kind: "trial", name: "Blister Trial", phase: "", days: 0, caps: 10, price: 1499, perCap: 150, tag: "", image: "/shop/blister.png", sortOrder: 1, status: "active", dosage: "", includes: [], includesNote: "" },
  { id: "trial-bottle", kind: "trial", name: "Bottle Trial", phase: "", days: 0, caps: 30, price: 4299, perCap: 143, tag: "", image: "/shop/bottle.png", sortOrder: 2, status: "active", dosage: "", includes: [], includesNote: "" },
];

export const PRODUCT_STATUSES: ProductStatus[] = ["active", "hidden", "archived"];
/** Product images that exist in public/shop. Uploads come with "Add product" later. */
export const SHOP_IMAGES = ["/shop/blister.png", "/shop/bottle.png"];
export const PRODUCT_COLUMNS =
  "id, kind, name, phase, days, caps, price, per_cap_price, tag, image, sort_order, status, dosage, includes, includes_note";

/** Active products of one kind, in display order. */
export function shopProducts(products: Product[], kind: ProductKind): Product[] {
  return products
    .filter((product) => product.kind === kind && product.status === "active")
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function normalizeProduct(row: Record<string, unknown>): Product {
  const status = PRODUCT_STATUSES.find((value) => value === row.status) ?? "hidden";
  return {
    id: String(row.id ?? ""),
    kind: row.kind === "trial" ? "trial" : "protocol",
    name: String(row.name ?? ""),
    phase: String(row.phase ?? ""),
    days: Number(row.days) || 0,
    caps: Number(row.caps) || 0,
    price: Number(row.price) || 0,
    perCap: Number(row.per_cap_price) || 0,
    tag: String(row.tag ?? ""),
    image: String(row.image ?? ""),
    sortOrder: Number(row.sort_order) || 0,
    status,
    dosage: String(row.dosage ?? ""),
    includes: Array.isArray(row.includes) ? row.includes.map(String).filter(Boolean) : [],
    includesNote: String(row.includes_note ?? ""),
  };
}

/**
 * Products + switched-on promos, read the same way by the shop (anon client: active products
 * only, via RLS) and checkout (service role: every product). A failed products read falls
 * back to DEFAULT_PRODUCTS and a failed promos read to no promos, on both sides, so the shop
 * never shows a price checkout would refuse.
 */
// Shop clients are built with a runtime schema name (doctors | sandbox), hence the string schema.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ShopClient = SupabaseClient<any, "public", string>;

export async function loadCatalog(client: ShopClient | null): Promise<{ products: Product[]; promos: Promo[] }> {
  if (!client) return { products: DEFAULT_PRODUCTS, promos: [] };
  const [products, promos] = await Promise.all([
    client.from("products").select(PRODUCT_COLUMNS),
    client.from("promos").select(PROMO_COLUMNS).eq("enabled", true),
  ]);
  return {
    products: products.error ? DEFAULT_PRODUCTS : (products.data ?? []).map((row) => normalizeProduct(row)),
    promos: promos.error ? [] : (promos.data ?? []).map((row) => normalizePromo(row)),
  };
}

export const MAX_QTY_PER_LINE = 20;

/**
 * Recomputes the order subtotal from the server-side catalog instead of trusting
 * the prices the browser wrote into the row. Returns null when any line is unknown,
 * not for sale, mispriced, carries the wrong capsule count (it drives shipping), or is
 * out of range - the caller should refuse to create a payment.
 *
 * A line may carry the promo price live at any of `at` (checkout passes order time and
 * now, so an order placed before a promo ended can still be paid after it).
 */
export function recomputeSubtotal(
  items: ShopOrderItem[],
  products: Product[] = DEFAULT_PRODUCTS,
  promos: Promo[] = [],
  at: Date[] = [new Date()],
): number | null {
  if (!Array.isArray(items) || items.length === 0) return null;

  let subtotal = 0;
  for (const item of items) {
    const known = products.find((product) => product.id === item?.id && product.status === "active");
    if (!known) return null;
    if (Number(item.caps) !== known.caps) return null;

    const price = Number(item.price);
    const allowed = at.some((when) => promoPrice(item.id, known.price, promos, when).price === price);
    if (!allowed) return null;

    const qty = Number(item.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_LINE) return null;

    subtotal += price * qty;
  }

  return subtotal;
}

// ─── Promos ─────────────────────────────────────────────────────────────────
// Lives here, not in its own module, so the node test runner can load it without path aliases.

/**
 * A row of the `promos` table. `discounts` maps product id -> whole percent off;
 * `prices` maps product id -> the final price admin typed (charged; overrides the % maths);
 * `perCap` maps product id -> the promo per-capsule price admin typed (display only).
 */
export type Promo = {
  id: string;
  name: string;
  label: string;
  starts_on: string; // YYYY-MM-DD, Manila
  ends_on: string | null; // inclusive; null = no end date
  enabled: boolean;
  discounts: Record<string, number>;
  prices: Record<string, number>;
  perCap: Record<string, number>;
};

export type PromoPrice = {
  price: number;
  basePrice: number;
  percent: number;
  promo: Promo | null;
};

export const MAX_PROMO_PERCENT = 90;

/** Promo dates are Manila calendar days, whatever timezone the server or browser runs in. */
export function manilaDate(at: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(at);
}

export function isPromoLive(promo: Promo, at: Date): boolean {
  const day = manilaDate(at);
  return promo.enabled && promo.starts_on <= day && (!promo.ends_on || day <= promo.ends_on);
}

/** Rounded up to the next peso, as agreed. */
export function discountedPrice(basePrice: number, percent: number): number {
  return Math.ceil((basePrice * (100 - percent)) / 100);
}

/**
 * Overlapping promos never stack - the biggest live % for the product wins. The winner's
 * typed final price, when set, is the price; otherwise the % maths. `percent` stays the
 * entered % (the shop says "Save 40%" even when a typed ₱29,999 is really 39.4% off).
 */
export function promoPrice(productId: string, basePrice: number, promos: Promo[], at: Date): PromoPrice {
  let best: Promo | null = null;
  let percent = 0;
  for (const promo of promos) {
    const pct = Number(promo.discounts?.[productId]) || 0;
    if (pct > percent && pct <= MAX_PROMO_PERCENT && isPromoLive(promo, at)) {
      best = promo;
      percent = pct;
    }
  }
  if (!best) return { price: basePrice, basePrice, percent: 0, promo: null };
  // A typed price at or above the SRP (SRP lowered after the promo was saved) is ignored.
  const typed = best.prices[productId];
  const price = typed && typed < basePrice ? typed : discountedPrice(basePrice, percent);
  return { price, basePrice, percent, promo: best };
}

/** Name the shop shows for a promo: its customer-facing label, else its admin name. */
export const promoDisplayName = (promo: Promo) => promo.label || promo.name;

/** Per-capsule price to show: the promo's typed value, else the calculation, else the product's own. */
export function promoPerCap(product: Product, pricing: PromoPrice): number {
  if (!pricing.promo) return product.perCap;
  return pricing.promo.perCap[product.id] || discountedPrice(product.perCap, pricing.percent);
}

export function promoStatus(promo: Promo, at: Date): "Off" | "Scheduled" | "Ended" | "Live" {
  if (!promo.enabled) return "Off";
  const day = manilaDate(at);
  if (day < promo.starts_on) return "Scheduled";
  if (promo.ends_on && day > promo.ends_on) return "Ended";
  return "Live";
}

/** "Dec 31" from a YYYY-MM-DD date, without timezone drift. */
export function formatPromoDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

/** Normalises a row from Supabase; anything malformed is dropped by promoPrice anyway. */
export function normalizePromo(row: Record<string, unknown>): Promo {
  const discounts: Record<string, number> = {};
  const raw = (row.discounts ?? {}) as Record<string, unknown>;
  for (const [id, value] of Object.entries(raw)) {
    const pct = Math.round(Number(value));
    if (pct > 0 && pct <= MAX_PROMO_PERCENT) discounts[id] = pct;
  }
  // Typed values only count for products the promo discounts.
  const typed = (raw: unknown) => {
    const out: Record<string, number> = {};
    for (const [id, value] of Object.entries((raw ?? {}) as Record<string, unknown>)) {
      const pesos = Math.round(Number(value));
      if (pesos > 0 && discounts[id]) out[id] = pesos;
    }
    return out;
  };
  const perCap = typed(row.per_cap);
  const prices = typed(row.prices);
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    label: String(row.label ?? ""),
    starts_on: String(row.starts_on ?? ""),
    ends_on: row.ends_on ? String(row.ends_on) : null,
    enabled: row.enabled !== false,
    discounts,
    prices,
    perCap,
  };
}

export const PROMO_COLUMNS = "id, name, label, starts_on, ends_on, enabled, discounts, prices, per_cap";
