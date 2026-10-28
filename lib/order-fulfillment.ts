// Fulfilment fields an admin keeps on every order (Maya included). No imports, so the browser,
// the server routes and the node test runner can all load it.

export const TRACKING_STATUSES = [
  "preparing",
  "ready_for_pickup",
  "picked_up",
  "in_transit",
  "delivered",
  "returned",
] as const;

export type TrackingStatus = (typeof TRACKING_STATUSES)[number];

/** Times are ISO strings (timestamptz); empty means not set. */
export type OrderFulfillment = {
  order_time: string | null;
  pof_time: string | null;
  tracking_number: string | null;
  pickup_time: string | null;
  tracking_status: TrackingStatus | null;
  bot_message: string | null;
  salesperson: string | null;
};

export const EMPTY_FULFILLMENT: OrderFulfillment = {
  order_time: null,
  pof_time: null,
  tracking_number: null,
  pickup_time: null,
  tracking_status: null,
  bot_message: null,
  salesperson: null,
};

/**
 * Turns whatever came in (a DB row or a request body) into clean column values: times must
 * parse, the status must be one of TRACKING_STATUSES, text is trimmed, and blanks become null.
 */
export function cleanFulfillment(raw: unknown): OrderFulfillment {
  const row = (raw ?? {}) as Record<string, unknown>;
  const text = (key: string) => {
    const value = typeof row[key] === "string" ? (row[key] as string).trim() : "";
    return value || null;
  };
  const time = (key: string) => {
    const value = text(key);
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  };
  const status = text("tracking_status");

  return {
    order_time: time("order_time"),
    pof_time: time("pof_time"),
    tracking_number: text("tracking_number"),
    pickup_time: time("pickup_time"),
    tracking_status: TRACKING_STATUSES.includes(status as TrackingStatus) ? (status as TrackingStatus) : null,
    bot_message: text("bot_message"),
    salesperson: text("salesperson"),
  };
}
