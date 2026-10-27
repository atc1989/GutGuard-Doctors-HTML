// Runnable check for the order fulfilment sanitizer (admin-entered fields saved with the service role).
//   node --experimental-strip-types lib/order-fulfillment.test.mjs
import assert from "node:assert/strict";
import { cleanFulfillment, EMPTY_FULFILLMENT } from "./order-fulfillment.ts";

assert.deepEqual(cleanFulfillment(null), EMPTY_FULFILLMENT, "nothing in, all null out");
assert.deepEqual(
  cleanFulfillment({
    order_time: "2026-10-27T06:30:00.000Z",
    pof_time: "not a date",
    tracking_number: "  JT123  ",
    pickup_time: "",
    tracking_status: "in_transit",
    bot_message: "  ",
    salesperson: "Ana",
  }),
  {
    order_time: "2026-10-27T06:30:00.000Z",
    pof_time: null,
    tracking_number: "JT123",
    pickup_time: null,
    tracking_status: "in_transit",
    bot_message: null,
    salesperson: "Ana",
  },
);
assert.equal(cleanFulfillment({ tracking_status: "lost" }).tracking_status, null, "unknown status must not pass");
console.log("order fulfillment checks passed");
