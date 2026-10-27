import assert from "node:assert/strict";
import { test } from "node:test";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";

// Exercise the real route and payment writer with controlled network/database boundaries.
const root = new URL("../", import.meta.url);
globalThis.paymentTest = {};
const stubs = {
  "@/lib/supabase-admin": `export const SHOP_SCHEMA = 'sandbox'; export const isSupabaseAdminConfigured = true; export function getSupabaseAdmin() { return globalThis.paymentTest.db; }`,
  "@/lib/maya": `export const isMayaConfigured = true; export const toMayaAmount = n => n.toFixed(2);
    export class MayaApiError extends Error { constructor(message, status) { super(message); this.status = status; } }
    export const createMayaCheckout = p => globalThis.paymentTest.create(p);
    export const getMayaPayment = id => globalThis.paymentTest.get(id);
    export const getMayaPaymentsByReference = ref => globalThis.paymentTest.byReference(ref);`,
  "@/lib/catalog": `export async function loadCatalog() { return { products: [], promos: [] }; } export function verifyOrderAmounts() { return { subtotal: 1499, shippingFee: 110, total: 1609 }; }`,
  "@/lib/order-address": `export async function verifyOrderAddress() { return ''; }`,
  "@/lib/shipping": `export function expectedShippingFee() { return 110; }`,
};
registerHooks({ resolve(specifier, context, next) {
  if (stubs[specifier]) return { url: `data:text/javascript,${encodeURIComponent(stubs[specifier])}`, shortCircuit: true };
  if (specifier.startsWith("@/")) return next(new URL(specifier.slice(2) + ".ts", root).href, context);
  if (specifier === "next/server") return next(pathToFileURL(new URL("node_modules/next/server.js", root).pathname.replace(/^\/(\w:)/, "$1")).href, context);
  return next(specifier, context);
} });
const { POST: checkout } = await import("../app/api/maya/checkout/route.ts");
const { POST: reconcile } = await import("../app/api/maya/reconcile/route.ts");
const { POST: webhook } = await import("../app/api/maya/webhook/route.ts");
const { applyPaymentToOrder } = await import("./maya-orders.ts");
const { MayaApiError } = await import("@/lib/maya");

function fixture(overrides = {}) {
  const row = { id: "order-1", order_code: "GG-20261027-12345678", payment_method: "maya", status: "pending_payment", payment_status: "pending", payment_attempts: 0,
    maya_checkout_id: null, maya_checkout_url: null, maya_request_reference: null, maya_payment_id: null, maya_payment_status: null, paid_at: null,
    customer_name: "Test Buyer", first_name: "Test", last_name: "Buyer", email: "buyer@example.com", mobile: "09123456789", address: "Test street", city: "Makati", province: "Metro Manila", zip: "1200",
    items: [{ id: "trial-blister", name: "Trial", caps: 10, price: 1499, qty: 1 }], created_at: "2026-10-27T00:00:00Z", ...overrides };
  const state = { row, creates: 0, emails: 0, failSave: false, failEmail: false, failClaim: false, zeroSave: false };
  class Query {
    filters = []; values = null; returning = false;
    select() { this.returning = true; return this; }
    update(values) { this.values = values; return this; }
    eq(key, value) { this.filters.push(r => r[key] === value); return this; }
    is(key, value) { return this.eq(key, value); }
    neq(key, value) { this.filters.push(r => r[key] !== value); return this; }
    single() { return this.execute(); }
    maybeSingle() { return this.execute(); }
    then(resolve, reject) { return this.execute().then(resolve, reject); }
    async execute() {
      if (this.values?.maya_checkout_id && state.failSave) return { data: null, error: { message: "database unavailable" } };
      if (this.values?.maya_checkout_url && state.zeroSave) return { data: null, error: null };
      if (this.values?.payment_attempts && state.failClaim) return { data: null, error: { message: "database unavailable" } };
      if (!this.filters.every(f => f(row))) return { data: null, error: null };
      if (this.values) Object.assign(row, this.values);
      return { data: structuredClone(row), error: null };
    }
  }
  state.db = { from: () => new Query(), functions: { invoke: async () => {
    state.emails++;
    return { data: state.failEmail ? null : { sent: true }, error: state.failEmail ? { message: "email outage" } : null };
  } } };
  state.create = async () => { state.creates++; await new Promise(r => setImmediate(r)); return { checkoutId: "checkout-new", redirectUrl: "https://payments.maya.ph/test" }; };
  state.get = async id => ({ id, paymentStatus: "PAYMENT_SUCCESS" });
  state.byReference = async () => [];
  globalThis.paymentTest = state;
  return state;
}
const request = () => new Request("https://shop.example/api/maya/checkout", { method: "POST", body: JSON.stringify({ orderId: "order-1" }) });
const oldAttempt = { payment_attempts: 1, maya_request_reference: "GG-20261027-12345678", maya_checkout_id: "checkout-old", maya_checkout_url: "https://payments.maya.ph/old" };

test("retry verifies a successful previous checkout before creating another", async () => {
  const f = fixture(oldAttempt);
  const response = await checkout(request());
  assert.equal(f.creates, 0);
  assert.equal((await response.json()).alreadyPaid, true);
  assert.equal(f.row.payment_status, "paid");
});
test("an active pending session is reused", async () => {
  const f = fixture(oldAttempt);
  f.get = async id => ({ id, paymentStatus: "PENDING_PAYMENT" });
  const response = await checkout(request());
  assert.equal(f.creates, 0);
  assert.equal((await response.json()).redirectUrl, oldAttempt.maya_checkout_url);
});
test("unknown payment and provider outages never authorize a new charge", async () => {
  for (const error of [new MayaApiError("not found", 404), new Error("timeout")]) {
    const f = fixture(oldAttempt); f.get = async () => { throw error; };
    const response = await checkout(request());
    assert.ok(response.status >= 400);
    assert.equal(f.creates, 0);
  }
});
test("overlapping requests reserve only one attempt", async () => {
  const f = fixture();
  await Promise.all([checkout(request()), checkout(request())]);
  assert.equal(f.creates, 1);
});
test("failed checkout persistence never returns a payment URL", async () => {
  const f = fixture(); f.failSave = true;
  const response = await checkout(request());
  assert.ok(response.status >= 400);
  assert.equal((await response.json()).redirectUrl, undefined);
  assert.equal(f.row.payment_attempts, 1, "reservation survives failure for recovery");
});
test("failed reservation never calls Maya", async () => {
  const f = fixture(); f.failClaim = true;
  assert.ok((await checkout(request())).status >= 400);
  assert.equal(f.creates, 0);
});
test("uncertain creation remains fenced and can reconcile by reference", async () => {
  const f = fixture(); f.create = async () => { f.creates++; throw new Error("connection lost after creation"); };
  await checkout(request());
  assert.equal(f.row.payment_attempts, 1);
  await checkout(request());
  assert.equal(f.creates, 1, "unknown first result must not be retried as another session");
  f.byReference = async () => [{ id: "checkout-recovered", paymentStatus: "PAYMENT_SUCCESS", requestReferenceNumber: f.row.order_code }];
  const response = await reconcile(new Request("https://shop.example/api/maya/reconcile", { method: "POST", body: JSON.stringify({ orderCode: f.row.order_code }) }));
  assert.equal((await response.json()).paymentStatus, "paid");
});
test("paid receipt failures propagate and duplicate success retries delivery", async () => {
  const f = fixture(); f.failEmail = true;
  const payment = { id: "payment-1", paymentStatus: "PAYMENT_SUCCESS" };
  await assert.rejects(() => applyPaymentToOrder(f.db, structuredClone(f.row), payment), /receipt/i);
  assert.equal(f.row.payment_status, "paid", "receipt error must not undo payment");
  f.failEmail = false;
  await applyPaymentToOrder(f.db, structuredClone(f.row), payment);
  assert.equal(f.emails, 2);
});
test("stale failed notification cannot overwrite a concurrently paid order", async () => {
  const f = fixture(); const stale = structuredClone(f.row);
  Object.assign(f.row, { payment_status: "paid", status: "fulfilled", maya_payment_id: "payment-new", maya_payment_status: "PAYMENT_SUCCESS", paid_at: "2026-10-27T01:00:00Z" });
  await applyPaymentToOrder(f.db, stale, { id: "payment-old", paymentStatus: "PAYMENT_FAILED" });
  assert.equal(f.row.payment_status, "paid");
  assert.equal(f.row.status, "fulfilled");
});
test("repeated success preserves fulfilment and original paid time", async () => {
  const f = fixture({ payment_status: "paid", status: "fulfilled", maya_payment_id: "payment-1", maya_payment_status: "PAYMENT_SUCCESS", paid_at: "2026-10-27T01:00:00Z" });
  await applyPaymentToOrder(f.db, structuredClone(f.row), { id: "payment-2", paymentStatus: "PAYMENT_SUCCESS" });
  assert.equal(f.row.status, "fulfilled");
  assert.equal(f.row.paid_at, "2026-10-27T01:00:00Z");
  assert.equal(f.row.maya_payment_id, "payment-1");
});
test("already-paid reconciliation retries a missing receipt", async () => {
  const f = fixture({ payment_status: "paid", status: "paid" });
  await reconcile(new Request("https://shop.example/api/maya/reconcile", { method: "POST", body: JSON.stringify({ orderCode: f.row.order_code }) }));
  assert.equal(f.emails, 1);
});

test("processing and authorization states never start or resume checkout", async () => {
  for (const paymentStatus of ["PAYMENT_PROCESSING", "AUTHENTICATING", "AUTH_SUCCESS", "AUTHORIZED", "unexpected-status"]) {
    const f = fixture(oldAttempt); f.get = async id => ({ id, paymentStatus });
    const response = await checkout(request());
    assert.ok(response.status >= 400, paymentStatus);
    assert.equal(f.creates, 0);
  }
});
test("confirmed unsuccessful terminal results allow exactly one replacement", async () => {
  for (const paymentStatus of ["PAYMENT_FAILED", "PAYMENT_EXPIRED", "PAYMENT_CANCELLED", "AUTH_FAILED"]) {
    const f = fixture(oldAttempt); f.get = async id => ({ id, paymentStatus });
    const responses = await Promise.all([checkout(request()), checkout(request())]);
    assert.equal(f.creates, 1, paymentStatus);
    assert.equal(f.row.payment_attempts, 2);
    assert.ok(responses.some(r => r.status === 200));
  }
});
test("zero affected rows when saving checkout never redirects", async () => {
  const f = fixture(); f.zeroSave = true;
  const response = await checkout(request());
  assert.ok(response.status >= 400);
  assert.equal((await response.json()).redirectUrl, undefined);
});
test("lost response after a durable checkout save reuses the same session", async () => {
  const f = fixture(); await checkout(request());
  f.get = async id => ({ id, paymentStatus: "PENDING_PAYMENT" });
  const response = await checkout(request());
  assert.equal(f.creates, 1);
  assert.equal((await response.json()).redirectUrl, "https://payments.maya.ph/test");
});
test("a failed old attempt cannot replace a newer pending session", async () => {
  const f = fixture({ ...oldAttempt, maya_checkout_id: "checkout-new", maya_request_reference: "GG-20261027-12345678-2", payment_attempts: 2 });
  await applyPaymentToOrder(f.db, structuredClone(f.row), { id: "checkout-old", paymentStatus: "PAYMENT_EXPIRED", requestReferenceNumber: oldAttempt.maya_request_reference });
  assert.equal(f.row.payment_status, "pending");
  assert.equal(f.row.maya_payment_id, null);
});
test("a refund for the settled payment preserves the original paid timestamp", async () => {
  const f = fixture({ ...oldAttempt, payment_status: "paid", status: "fulfilled", maya_payment_id: "payment-1", maya_payment_status: "PAYMENT_SUCCESS", paid_at: "2026-10-27T01:00:00Z" });
  await applyPaymentToOrder(f.db, structuredClone(f.row), { id: "payment-1", paymentStatus: "REFUNDED" });
  assert.equal(f.row.payment_status, "refunded");
  assert.equal(f.row.paid_at, "2026-10-27T01:00:00Z");
  await applyPaymentToOrder(f.db, structuredClone(f.row), { id: "payment-1", paymentStatus: "PAYMENT_SUCCESS" });
  assert.equal(f.row.payment_status, "refunded");
});
test("receipt error makes webhook retry and replay succeeds without rewriting payment", async () => {
  const f = fixture(); f.failEmail = true;
  f.get = async id => ({ id, paymentStatus: "PAYMENT_SUCCESS", requestReferenceNumber: f.row.order_code });
  const event = () => new Request("https://shop.example/api/maya/webhook", { method: "POST", body: JSON.stringify({ id: "payment-1" }) });
  assert.equal((await webhook(event())).status, 500);
  assert.equal(f.row.payment_status, "paid");
  const paidAt = f.row.paid_at;
  f.failEmail = false;
  assert.equal((await webhook(event())).status, 200);
  assert.equal(f.row.paid_at, paidAt);
  assert.equal(f.emails, 2);
});
test("a payment settled during checkout creation returns the receipt, not another payment URL", async () => {
  const f = fixture();
  const create = f.create;
  f.create = async payload => {
    const checkout = await create(payload);
    Object.assign(f.row, { payment_status: "paid", status: "paid" });
    return checkout;
  };
  const response = await checkout(request());
  const body = await response.json();
  assert.equal(body.alreadyPaid, true);
  assert.equal(body.redirectUrl, undefined);
});
