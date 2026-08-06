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
  // price is what gets charged; perCap is display only. Keep them consistent -
  // price must equal caps * perCap, or the card shows one number and Maya charges another.
  // (Peak is the deliberate exception: 39,999 instead of 40,000.)
  { id: "start", name: "Start", phase: "30-day", days: 30, caps: 40, perCap: 125, price: 5000 },
  { id: "grow", name: "Grow", phase: "60-day", days: 60, caps: 270, perCap: 116, price: 31320, tag: "Popular" },
  { id: "peak", name: "Peak", phase: "90-day", days: 90, caps: 400, perCap: 100, price: 39999, tag: "Best rate" },
];

export const TRIALS: CatalogTrial[] = [
  { id: "trial-blister", name: "Blister Trial", caps: 10, price: 1299, image: "/shop/blister.png" },
  { id: "trial-bottle", name: "Bottle Trial", caps: 30, price: 3799, image: "/shop/bottle.png" },
];

export const MAX_QTY_PER_LINE = 20;

const CATALOG = new Map<string, { price: number; caps: number }>(
  [...TIERS, ...TRIALS].map((item) => [item.id, { price: item.price, caps: item.caps }]),
);

/**
 * Recomputes the order subtotal from the server-side catalog instead of trusting
 * the prices the browser wrote into the row. Returns null when any line is unknown,
 * mispriced, or out of range - the caller should refuse to create a payment.
 */
export function recomputeSubtotal(items: ShopOrderItem[]): number | null {
  if (!Array.isArray(items) || items.length === 0) return null;

  let subtotal = 0;
  for (const item of items) {
    const known = CATALOG.get(item?.id);
    if (!known) return null;
    if (Number(item.price) !== known.price) return null;

    const qty = Number(item.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_LINE) return null;

    subtotal += known.price * qty;
  }

  return subtotal;
}
