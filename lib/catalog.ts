import type { ShopOrderItem } from "@/lib/api";

/*
 * One price list for the website shop (Addendum 05, decision 2: the prototype prices).
 * The browser only displays these. Every amount is re-derived here before Maya is called.
 *
 *   kind "watch" - the 5-Night Watch. First order only (see /api/shop/first-buyer). Ships free.
 *   kind "once"  - one-time packs. Any order that has one pays the flat shipping fee.
 *   kind "plan"  - Gutguard Daily. Delivery is free.
 */

export type ProductKind = "watch" | "once" | "plan";

export type CatalogProduct = {
  id: string;
  name: string;
  caps: number;
  price: number;
  kind: ProductKind;
};

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

/** Gutguard Daily: price per blister (10 capsules). */
export const PLAN_PRICE = { monthly: 989, quarterly: 890 } as const;

/** Blisters per month for each goal. Quarterly = 3 months in one delivery. */
export const PLAN_GOALS = [
  { id: "keep", name: "Keep healthy", blistersPerMonth: 6 },
  { id: "better", name: "Feel better", blistersPerMonth: 12 },
  { id: "full", name: "Full recovery", blistersPerMonth: 18 },
] as const;

export type PlanGoal = (typeof PLAN_GOALS)[number]["id"];
export type PlanCadence = keyof typeof PLAN_PRICE;

export const planId = (goal: PlanGoal, cadence: PlanCadence = "monthly") => `plan-${goal}-${cadence}`;

export const TIERS: CatalogTier[] = [
  // price is the exact amount charged; perCap is a rounded display value.
  { id: "start", name: "Start", phase: "15-day", days: 15, caps: 30, perCap: 133, price: 3999 },
  { id: "grow", name: "Grow", phase: "45-day", days: 45, caps: 90, perCap: 122, price: 10999, tag: "Popular" },
  { id: "peak", name: "Peak", phase: "90-day", days: 90, caps: 330, perCap: 89, price: 29369, tag: "Best rate" },
];

export const TRIALS: CatalogTrial[] = [
  { id: "blister", name: "Blister", caps: 10, price: 1499, image: "/shop/blister.png" },
  { id: "bottle", name: "Bottle", caps: 30, price: 3799, image: "/shop/bottle.png" },
];

export const WATCH: CatalogProduct = { id: "watch", name: "5-Night Watch", caps: 10, price: 499, kind: "watch" };

const PLANS: CatalogProduct[] = PLAN_GOALS.flatMap((goal) =>
  (Object.keys(PLAN_PRICE) as PlanCadence[]).map((cadence) => {
    const blisters = goal.blistersPerMonth * (cadence === "quarterly" ? 3 : 1);
    return {
      id: planId(goal.id, cadence),
      name: `Gutguard Daily · ${goal.name} · ${cadence === "monthly" ? "Monthly" : "Every 3 months"}`,
      caps: blisters * 10,
      price: blisters * PLAN_PRICE[cadence],
      kind: "plan" as const,
    };
  }),
);

export const PRODUCTS: CatalogProduct[] = [
  WATCH,
  ...TRIALS.map((t) => ({ id: t.id, name: `SynBIOTIC+ · ${t.name}`, caps: t.caps, price: t.price, kind: "once" as const })),
  ...TIERS.map((t) => ({ id: t.id, name: `SynBIOTIC+ · ${t.name}`, caps: t.caps, price: t.price, kind: "once" as const })),
  ...PLANS,
];

export const MAX_QTY_PER_LINE = 20;

const CATALOG = new Map<string, CatalogProduct>(PRODUCTS.map((item) => [item.id, item]));

export function getProduct(id: string): CatalogProduct | undefined {
  return CATALOG.get(id);
}

/**
 * Builds order lines from ids and quantities only. Names, capsules and prices always
 * come from this file, never from the browser. Returns an error string for a basket
 * the shop must refuse.
 */
export function buildOrderItems(input: Array<{ id: string; qty: number }>): { items: ShopOrderItem[] } | { error: string } {
  if (!Array.isArray(input) || input.length === 0) return { error: "Your order is empty." };

  const items: ShopOrderItem[] = [];
  for (const line of input) {
    const product = CATALOG.get(String(line?.id));
    if (!product) return { error: "An item in your order is no longer sold." };
    const qty = Number(line.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_LINE) return { error: "Check the quantities in your order." };
    if (product.kind !== "once" && qty !== 1) return { error: `${product.name} is one per order.` };
    if (items.some((x) => x.id === product.id)) return { error: "An item appears twice in your order." };
    items.push({ id: product.id, name: product.name, caps: product.caps, qty, price: product.price });
  }

  const kinds = items.map((x) => CATALOG.get(x.id)!.kind);
  if (kinds.filter((k) => k === "plan").length > 1) return { error: "One Gutguard Daily plan per order." };
  if (kinds.includes("watch") && kinds.includes("plan")) return { error: "The 5-Night Watch and a plan cannot be in the same order." };

  return { items };
}

export const hasKind = (items: ShopOrderItem[], kind: ProductKind) => items.some((x) => CATALOG.get(x.id)?.kind === kind);

/**
 * Flat shipping (Addendum 05, decision 3). One fee per order when it has any one-time pack.
 * The 5-Night Watch alone and Gutguard Daily ship free. A Watch that shares a box with
 * one-time packs pays the one fee, once.
 */
export const FLAT_SHIPPING_FEE = 150;

export function flatShippingFee(items: ShopOrderItem[]): number {
  return hasKind(items, "once") ? FLAT_SHIPPING_FEE : 0;
}

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
