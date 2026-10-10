import type { ShopOrderItem } from "@/lib/api";

export type CatalogTier = {
  id: string;
  name: string;
  phase: string;
  days: number;
  caps: number;
  perCap: number;
  price: number;
  tag?: string;
};

export type CatalogTrial = {
  id: string;
  name: string;
  caps: number;
  price: number;
  image: string;
};

export const TIERS: CatalogTier[] = [
  // price is the exact amount charged; perCap is a rounded display value.
  { id: "start", name: "Start", phase: "30-day", days: 30, caps: 30, perCap: 133, price: 3999 },
  { id: "grow", name: "Grow", phase: "60-day", days: 60, caps: 90, perCap: 122, price: 10999, tag: "Popular" },
  { id: "peak", name: "Peak", phase: "90-day", days: 90, caps: 330, perCap: 90, price: 29999, tag: "Best rate" },
];

export const TRIALS: CatalogTrial[] = [
  { id: "trial-blister", name: "Blister Trial", caps: 10, price: 1499, image: "/shop/blister.png" },
  { id: "trial-bottle", name: "Bottle Trial", caps: 30, price: 4299, image: "/shop/bottle.png" },
];

export const MAX_QTY_PER_LINE = 20;

const CATALOG = new Map<string, { price: number; caps: number }>(
  [...TIERS, ...TRIALS].map((item) => [item.id, { price: item.price, caps: item.caps }]),
);

/**
 * Recomputes the order subtotal from the server-side catalog instead of trusting
 * the prices the browser wrote into the row. Returns null when any line is unknown,
 * mispriced, or out of range - the caller should refuse to create a payment.
 *
 * A line may carry the promo price live at any of `at` (checkout passes order time and
 * now, so an order placed before a promo ended can still be paid after it).
 */
export function recomputeSubtotal(
  items: ShopOrderItem[],
  promos: Promo[] = [],
  at: Date[] = [new Date()],
): number | null {
  if (!Array.isArray(items) || items.length === 0) return null;

  let subtotal = 0;
  for (const item of items) {
    const known = CATALOG.get(item?.id);
    if (!known) return null;
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

/** A row of the `promos` table. `discounts` maps catalog product id -> whole percent off. */
export type Promo = {
  id: string;
  name: string;
  label: string;
  starts_on: string; // YYYY-MM-DD, Manila
  ends_on: string | null; // inclusive; null = no end date
  enabled: boolean;
  discounts: Record<string, number>;
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

/** Overlapping promos never stack - the biggest live discount for the product wins. */
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
  return { price: percent ? discountedPrice(basePrice, percent) : basePrice, basePrice, percent, promo: best };
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
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    label: String(row.label ?? ""),
    starts_on: String(row.starts_on ?? ""),
    ends_on: row.ends_on ? String(row.ends_on) : null,
    enabled: row.enabled !== false,
    discounts,
  };
}

export const PROMO_COLUMNS = "id, name, label, starts_on, ends_on, enabled, discounts";
