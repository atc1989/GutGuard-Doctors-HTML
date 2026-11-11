import assert from "node:assert/strict";
import test from "node:test";

import { normalizeSmsMobile, orderSmsMessages, otpMessage, smsProviderEnvVar, textsCustomer, type SmsKind, type SmsOrder } from "./sms.ts";

const SITE = "https://gutguard.ph";
/** The longest origin the function is given in practice; the sandbox shop is 8 characters longer. */
const LONGEST_SITE = "https://sandbox.gutguard.ph";
/** What `generate_shop_order_code()` really returns: "GG-" + 8 date digits + "-" + 8 hex. */
const REAL_CODE = "GG-20261019-A3F91C2D";

const order = (over: Partial<SmsOrder> = {}): SmsOrder => ({
  order_code: REAL_CODE,
  mobile: "09171234567",
  ...over,
});

const KINDS: SmsKind[] = ["paid", "shipped"];

/*
 * The one check that matters: a message over 160 characters costs two credits instead of one,
 * and a single non-GSM character (a peso sign, a curly quote, an en dash) halves the limit to
 * 70. Both are silent at send time - the bill is where you find out.
 */
test("every message fits one GSM-7 segment and uses no non-GSM characters", () => {
  const messages = [
    ...KINDS.flatMap((kind) => [SITE, LONGEST_SITE].flatMap((site) => orderSmsMessages(order(), kind, site))),
    { audience: "otp", message: otpMessage("123456", 10) },
  ];

  for (const sms of messages) {
    assert.ok(sms.message.length <= 160, `${sms.audience} is ${sms.message.length} characters: ${sms.message}`);
    assert.match(sms.message, /^[\x20-\x7E]+$/, `${sms.audience} has a non-GSM character: ${sms.message}`);
    assert.ok(!sms.message.includes("₱"), `${sms.audience} uses the peso sign`);
  }
});

test("no message carries an http(s):// prefix - Smart blocks links", () => {
  for (const site of [SITE, LONGEST_SITE]) {
    for (const kind of KINDS) {
      for (const sms of orderSmsMessages(order(), kind, site)) {
        assert.ok(!/https?:\/\//i.test(sms.message), `${kind} still has a scheme: ${sms.message}`);
        assert.match(sms.message, /gutguard\.ph\/shop\/order\//, `${kind} lost its link: ${sms.message}`);
      }
    }
  }
});

test("paid: the buyer is told the payment cleared and where to track it", () => {
  const [buyer, ...rest] = orderSmsMessages(order(), "paid", SITE);
  assert.equal(buyer.audience, "buyer");
  assert.equal(buyer.to, "09171234567");
  assert.equal(
    buyer.message,
    `Gutguard: Payment confirmed. Track order ${REAL_CODE}: gutguard.ph/shop/order/${REAL_CODE}`,
  );
  assert.deepEqual(rest, [], "one order, one text");
});

test("shipped: the courier wording, same tracking link", () => {
  const [buyer] = orderSmsMessages(order(), "shipped", SITE);
  assert.equal(
    buyer.message,
    `Gutguard: Order ${REAL_CODE} is with the courier. Track it: gutguard.ph/shop/order/${REAL_CODE}`,
  );
});

test("no mobile, no text: an order without a number sends nothing", () => {
  assert.deepEqual(orderSmsMessages(order({ mobile: null }), "paid", SITE), []);
  assert.deepEqual(orderSmsMessages(order({ mobile: "  " }), "paid", SITE), []);
  assert.deepEqual(orderSmsMessages(order({ mobile: "0917" }), "paid", SITE), []);
});

test("a trailing slash on the site URL does not double up in the link", () => {
  const [sms] = orderSmsMessages(order(), "paid", SITE + "/");
  assert.ok(!sms.message.includes("ph//shop"), sms.message);
});

test("the number is normalised to what Semaphore wants", () => {
  assert.equal(normalizeSmsMobile("0917 123 4567"), "09171234567");
  assert.equal(normalizeSmsMobile("+639171234567"), "09171234567");
  assert.equal(normalizeSmsMobile("9171234567"), "09171234567");
  assert.equal(normalizeSmsMobile("02 8123 4567"), "");
  assert.equal(normalizeSmsMobile(null), "");
  const [sms] = orderSmsMessages(order({ mobile: "+63 917 123 4567" }), "paid", SITE);
  assert.equal(sms.to, "09171234567", "the row is keyed on the normalised number");
});

test("the OTP text carries the code and no link", () => {
  const message = otpMessage("482913", 10);
  assert.match(message, /checkout code is 482913\./);
  assert.ok(!/gutguard\.ph/.test(message), "a code text needs no link at all");
});

test("textsCustomer: the email-only kinds never text", () => {
  for (const kind of KINDS) assert.equal(textsCustomer(kind), true, kind);
  for (const kind of ["saved", "delivered", "renewal_due", ""]) assert.equal(textsCustomer(kind), false, kind);
});

test("only the production schema reads the secret that sends for real", () => {
  assert.equal(smsProviderEnvVar("doctors"), "SMS_PROVIDER");
  for (const schema of ["sandbox", "public", ""]) {
    assert.equal(smsProviderEnvVar(schema), "SANDBOX_SMS_PROVIDER", schema);
  }
});
