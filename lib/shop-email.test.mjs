import assert from "node:assert/strict";
import { test } from "node:test";
import { registerHooks } from "node:module";

globalThis.Deno = { env: { get: name => ({ RESEND_API_KEY: "test-key", SUPABASE_URL: "https://db.example", SUPABASE_SERVICE_ROLE_KEY: "test-service-key" })[name] } };
registerHooks({ resolve(specifier, context, next) {
  let source;
  if (specifier.startsWith("https://esm.sh/@supabase/")) source = "export const createClient = () => globalThis.emailTest.db;";
  if (specifier === "../_shared/cors.ts") source = "export const serveWithCors = handler => { globalThis.emailHandler = handler; };";
  return source ? { url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true } : next(specifier, context);
} });
await import("../supabase/functions/send-shop-order-email/index.ts");
function fixture() {
  const f = { calls: [], sent: [], lookupError: false, insertError: false, paymentStatus: "paid", deliveries: new Set() };
  f.db = { schema: () => ({ from: table => {
    const q = { select: () => q, eq: () => q,
      single: async () => ({ data: { id: "order-1", order_code: "GG-1", email: "buyer@example.com", payment_method: "maya", payment_status: f.paymentStatus }, error: null }),
      limit: async () => ({ data: f.sent, error: f.lookupError ? { message: "db unavailable" } : null }),
      insert: async row => { if (!f.insertError && row.status === "sent") f.sent.push(row); return { error: f.insertError ? { message: "db unavailable" } : null }; },
    };
    assert.ok(["shop_orders", "shop_order_email_sends"].includes(table)); return q;
  } }) };
  globalThis.emailTest = f;
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://api.resend.com/emails");
    f.calls.push(init);
    const key = new Headers(init.headers).get("Idempotency-Key");
    f.deliveries.add(key ?? String(f.calls.length));
    return Response.json({ id: "email-1" });
  };
  return f;
}
const request = () => new Request("https://functions.example/send-shop-order-email", { method: "POST", headers: { Authorization: "Bearer test-service-key" }, body: JSON.stringify({ orderId: "order-1", kind: "paid", schema: "sandbox" }) });
test("overlapping paid receipts use one provider idempotency key", async () => {
  const f = fixture();
  await Promise.all([globalThis.emailHandler(request()), globalThis.emailHandler(request())]);
  assert.equal(f.deliveries.size, 1);
  assert.equal(new Headers(f.calls[0].headers).get("Idempotency-Key"), "shop-order/sandbox/order-1/paid");
});
test("a failed sent-log lookup never sends an unverified duplicate", async () => {
  const f = fixture(); f.lookupError = true;
  assert.ok((await globalThis.emailHandler(request())).status >= 400);
  assert.equal(f.calls.length, 0);
});
test("failed sent-log writes propagate and a retry reuses the provider key", async () => {
  const f = fixture(); f.insertError = true;
  assert.ok((await globalThis.emailHandler(request())).status >= 400);
  f.insertError = false;
  assert.equal((await globalThis.emailHandler(request())).status, 200);
  assert.equal(f.deliveries.size, 1);
});
test("paid receipt cannot be sent for an unpaid order", async () => {
  const f = fixture(); f.paymentStatus = "pending";
  assert.equal((await globalThis.emailHandler(request())).status, 409);
  assert.equal(f.calls.length, 0);
});
