// Runnable check for the two pure functions the payment path depends on.
//   node --experimental-strip-types lib/catalog.test.mjs   (Node 22+)
// or: npx tsx lib/catalog.test.mjs
import assert from "node:assert/strict";
import { recomputeSubtotal } from "./catalog.ts";
import { expectedShippingFee, quoteShipping } from "./shipping.ts";

const line = (over = {}) => ({ id: "peak", name: "SynBIOTIC+ Peak", caps: 330, price: 29999, qty: 1, ...over });

// Honest baskets price correctly.
assert.equal(recomputeSubtotal([line()]), 29999);
assert.equal(recomputeSubtotal([line({ qty: 2 })]), 59998);
assert.equal(recomputeSubtotal([line(), line({ id: "trial-bottle", price: 4299, caps: 30 })]), 34298);

// Tampering is rejected, which is the whole point of recomputing server-side.
assert.equal(recomputeSubtotal([line({ price: 1 })]), null, "a rewritten price must not pass");
assert.equal(recomputeSubtotal([line({ id: "free-stuff" })]), null, "an unknown product must not pass");
assert.equal(recomputeSubtotal([line({ qty: 0 })]), null, "qty below 1 must not pass");
assert.equal(recomputeSubtotal([line({ qty: 999 })]), null, "qty above the per-line cap must not pass");
assert.equal(recomputeSubtotal([line({ qty: 1.5 })]), null, "fractional qty must not pass");
assert.equal(recomputeSubtotal([]), null, "empty basket must not pass");

// Shipping is J&T's public rate from Davao for the province's J&T zone, plus ₱50 handling.
// The server re-quotes it from the stored province code; the browser's fee is ignored.
const bottle = [line({ id: "trial-bottle", price: 4299, caps: 30 })]; // 150g
const peak = [line()]; // 11 bottles, 650g
const fee = (items, provinceCode) => expectedShippingFee(items, { provinceCode });
assert.equal(fee(bottle, "1102400000"), 135, "Davao del Sur: Mindanao 85 + 50");
assert.equal(fee(bottle, "0702200000"), 155, "Cebu: Visayas 105 + 50");
assert.equal(fee(bottle, "1300000000"), 155, "Metro Manila: Luzon 105 + 50");
assert.equal(fee(bottle, "1401100000"), 155, "Benguet is Luzon, not Mindanao");
assert.equal(fee(bottle, "0200900000"), 165, "Batanes: Island 115 + 50");
assert.equal(fee(peak, "1300000000"), 245, "650g is the 1kg bracket: 195 + 50");
assert.equal(fee(peak, "1102400000"), 205);
assert.equal(fee([line({ qty: 4 })], "0402100000"), 265, "Cavite, 2.3kg: 215 + 50");
assert.equal(fee([line({ qty: 10 })], "0402100000"), 485, "Cavite, 5.6kg: 435 + 50");

// J&T's zones, not the old region guesses.
assert.equal(fee(bottle, "1705300000"), 155, "Palawan is Visayas for J&T, not island");
assert.equal(fee(bottle, "1705100000"), 155, "Occidental Mindoro is Luzon for J&T");
assert.equal(fee(bottle, "1705900000"), 165, "Romblon is island for J&T");
assert.equal(fee(bottle, "0607900000"), 165, "Guimaras is island for J&T");
assert.equal(fee(bottle, "1408100000"), 165, "Apayao is island for J&T");

// Nothing payable without a known province, or above 6kg.
assert.equal(fee(bottle, null), null, "no province code, no price - never a free ride");
assert.equal(fee(bottle, "garbage"), null);
assert.equal(fee(bottle, "9999999999"), null, "unknown province");
assert.equal(fee([line({ qty: 11 })], "0402100000"), null, "over 6kg is not payable online");
assert.equal(quoteShipping(bottle, { provinceCode: "" }).fee, 0, "no province chosen yet");
assert.equal(quoteShipping(bottle, { provinceCode: "" }).error, "", "and no error until one is");
assert.notEqual(quoteShipping(bottle, { provinceCode: "9999999999" }).error, "", "an unpriceable province blocks checkout");
assert.equal(quoteShipping(bottle, { provinceCode: "1300000000" }).label, "Luzon / Metro Manila");

console.log("catalog + shipping checks passed");

// Product pricing. These are money values that the server re-derives at checkout,
// so a typo here silently rejects every protocol order - assert them explicitly.
import { DEFAULT_PRODUCTS, shopProducts } from "./catalog.ts";
const tier = (id) => DEFAULT_PRODUCTS.find((t) => t.id === id);
assert.equal(tier("start").caps, 30);
assert.equal(tier("start").perCap, 133);
assert.equal(tier("start").price, 3999);
assert.equal(tier("grow").caps, 90);
assert.equal(tier("grow").perCap, 122);
assert.equal(tier("grow").price, 10999);
assert.equal(tier("peak").caps, 330);
assert.equal(tier("peak").perCap, 90);
assert.equal(tier("peak").price, 29999);
assert.deepEqual(shopProducts(DEFAULT_PRODUCTS, "protocol").map((p) => p.id), ["start", "grow", "peak"]);
assert.deepEqual(shopProducts(DEFAULT_PRODUCTS, "trial").map((p) => p.id), ["trial-blister", "trial-bottle"]);

// The new prices must survive server-side re-derivation.
const tierLine = (id, qty = 1) => ({ id, name: id, caps: tier(id).caps, price: tier(id).price, qty });
assert.equal(recomputeSubtotal([tierLine("start")]), 3999);
assert.equal(recomputeSubtotal([tierLine("grow")]), 10999);
assert.equal(recomputeSubtotal([tierLine("peak", 2)]), 59998);
// An old-price basket must be refused, not silently charged at the old rate.
// The exact superseded price, which is what a stale browser tab would actually send.
assert.equal(recomputeSubtotal([{ id: "start", name: "Start", caps: 40, price: 4999, qty: 1 }]), null);
assert.equal(recomputeSubtotal([{ id: "trial-blister", name: "Blister", caps: 10, price: 1299, qty: 1 }]), null);
console.log("catalog pricing checks passed");

// Admin-edited products. Checkout prices come from the products table, not the code.
const edited = DEFAULT_PRODUCTS.map((p) => (p.id === "start" ? { ...p, price: 4500, perCap: 150 } : p));
assert.equal(recomputeSubtotal([tierLine("start")], edited), null, "the pre-edit price is stale");
assert.equal(recomputeSubtotal([{ ...tierLine("start"), price: 4500 }], edited), 4500, "the edited price passes");
assert.equal(recomputeSubtotal([line({ caps: 30 })]), null, "a faked capsule count (it lowers shipping) must not pass");
const hidden = DEFAULT_PRODUCTS.map((p) => (p.id === "peak" ? { ...p, status: "hidden" } : p));
assert.equal(recomputeSubtotal([line()], hidden), null, "a hidden product cannot be bought");
const archived = DEFAULT_PRODUCTS.map((p) => (p.id === "peak" ? { ...p, status: "archived" } : p));
assert.equal(recomputeSubtotal([line()], archived), null, "an archived product cannot be bought");
console.log("editable product checks passed");

// Promos. Biggest live discount wins, prices round UP to the peso, dates are Manila days.
import { discountedPrice, promoPerCap, promoPrice, promoStatus } from "./catalog.ts";
const standard = { id: "s", name: "Standard", label: "", starts_on: "2026-01-01", ends_on: null, enabled: true, discounts: { start: 7, grow: 10, peak: 15 }, prices: {}, perCap: {} };
const holiday = { id: "h", name: "Holiday", label: "", starts_on: "2026-10-01", ends_on: "2026-12-31", enabled: true, discounts: { start: 10, grow: 20, peak: 40 }, prices: {}, perCap: {} };
const promos = [standard, holiday];
const nov = new Date("2026-11-15T04:00:00Z");
// 23:59 Dec 31 Manila is 15:59 UTC; 00:00 Jan 1 Manila is 16:00 UTC Dec 31.
const lastMinute = new Date("2026-12-31T15:59:00Z");
const newYear = new Date("2026-12-31T16:00:00Z");

assert.equal(discountedPrice(3999, 7), 3720, "3719.07 rounds up");
assert.equal(discountedPrice(29999, 40), 18000, "17999.4 rounds up");
assert.equal(promoPrice("peak", 29999, promos, nov).price, 18000, "holiday 40% beats standard 15%");
assert.equal(promoPrice("peak", 29999, promos, lastMinute).percent, 40, "promo runs to 23:59 Manila on its end date");
assert.equal(promoPrice("peak", 29999, promos, newYear).percent, 15, "falls back to standard after the promo");
assert.equal(promoPrice("trial-blister", 1499, promos, nov).price, 1499, "products not in any promo stay full price");
assert.equal(promoPrice("peak", 29999, [{ ...holiday, enabled: false }], nov).price, 29999, "a switched-off promo does nothing");
assert.equal(promoStatus(holiday, new Date("2026-09-30T15:00:00Z")), "Scheduled");
assert.equal(promoStatus(holiday, newYear), "Ended");

// Checkout re-derivation honours promos, and only the real promo price.
assert.equal(recomputeSubtotal([line({ price: 18000 })], DEFAULT_PRODUCTS, promos, [nov]), 18000);
assert.equal(recomputeSubtotal([line({ price: 29999 })], DEFAULT_PRODUCTS, promos, [nov]), null, "full price while a promo is live is stale");
assert.equal(recomputeSubtotal([line({ price: 17000 })], DEFAULT_PRODUCTS, promos, [nov]), null, "an invented discount must not pass");
assert.equal(recomputeSubtotal([line({ price: 18000 })], DEFAULT_PRODUCTS, promos, [newYear]), null, "promo price after the promo ended");
assert.equal(recomputeSubtotal([line({ price: 18000 })], DEFAULT_PRODUCTS, promos, [lastMinute, newYear]), 18000, "ordered in time, paid after");
// A promo on an admin-edited price discounts the edited price.
assert.equal(recomputeSubtotal([{ ...tierLine("start"), price: 4050 }], edited, [holiday], [nov]), 4050, "10% off the edited 4500");

// Promo per-capsule: typed value wins, otherwise the calculation (rounded up).
const start150 = { ...tier("start"), price: 4500, perCap: 150 };
const at = (p) => promoPrice("start", 4500, p, nov);
assert.equal(promoPerCap(start150, at([holiday])), 135, "150 less 10%, calculated");
assert.equal(promoPerCap(start150, at([{ ...holiday, perCap: { start: 133 } }])), 133, "admin typed 133");
assert.equal(promoPerCap(start150, at([])), 150, "no promo, the product's own per-capsule price");
console.log("promo checks passed");

// Typed final price (boss: Peak ₱49,500 at 40% must be ₱29,999, not ₱29,700).
const finals = { ...holiday, prices: { start: 3999, grow: 10999, peak: 29999 } };
const sandboxProducts = DEFAULT_PRODUCTS.map((p) =>
  ({ start: { ...p, price: 4500 }, grow: { ...p, price: 13500 }, peak: { ...p, price: 49500 } })[p.id] ?? p);
const peakFinal = promoPrice("peak", 49500, [standard, finals], nov);
assert.equal(peakFinal.price, 29999, "the typed final price, not the 40% maths (29700)");
assert.equal(peakFinal.percent, 40, "the shop still says Save 40%");
assert.equal(promoPrice("peak", 49500, [standard, holiday], nov).price, 29700, "blank final price = the calculation");
assert.equal(promoPrice("peak", 49500, [standard, finals], newYear).price, discountedPrice(49500, 15), "after the promo, Standard's maths");
const peakLine = { id: "peak", name: "Peak", caps: 330, qty: 1 };
assert.equal(recomputeSubtotal([{ ...peakLine, price: 29999 }], sandboxProducts, [standard, finals], [nov]), 29999, "checkout charges the typed price");
assert.equal(recomputeSubtotal([{ ...peakLine, price: 29700 }], sandboxProducts, [standard, finals], [nov]), null, "the calculated price no longer passes once a final price is typed");
console.log("promo final price checks passed");


// A typed final price at/above a lowered SRP must not produce a "discount" upward.
assert.equal(promoPrice("peak", 25000, [finals], nov).price, discountedPrice(25000, 40), "typed ₱29,999 ignored when SRP drops to ₱25,000");
assert.equal(promoPrice("peak", 29999, [finals], nov).price, discountedPrice(29999, 40), "typed price equal to SRP is ignored too");
console.log("typed price guard checks passed");

// Admin approval of consignment/cash orders and the Maya route both trust only this check.
import { verifyOrderAmounts } from "./catalog.ts";
const stored = { items: [line()], created_at: new Date().toISOString(), shipping_fee: 110, total_amount: 30109 };
assert.deepEqual(verifyOrderAmounts(stored, 110, DEFAULT_PRODUCTS, []), { subtotal: 29999, shippingFee: 110, total: 30109 });
assert.equal(verifyOrderAmounts({ ...stored, total_amount: 1 }, 110, DEFAULT_PRODUCTS, []), null, "a rewritten total must not pass");
assert.equal(verifyOrderAmounts({ ...stored, shipping_fee: 0, total_amount: 29999 }, 110, DEFAULT_PRODUCTS, []), null, "a rewritten shipping fee must not pass");
assert.equal(verifyOrderAmounts(stored, null, DEFAULT_PRODUCTS, []), null, "an unquotable address must not pass");
console.log("order amount checks passed");

// Admin consignment/cash orders: the server prices the lines; the admin only picks products and qty.
import { priceOrderLines } from "./catalog.ts";
assert.deepEqual(priceOrderLines([{ id: "peak", qty: 2 }], DEFAULT_PRODUCTS, []), [
  { id: "peak", name: "SynBIOTIC+ Peak", caps: 330, price: 29999, qty: 2 },
]);
assert.equal(priceOrderLines([{ id: "free-stuff", qty: 1 }], DEFAULT_PRODUCTS, []), null, "unknown product must not pass");
assert.equal(priceOrderLines([{ id: "peak", qty: 0 }], DEFAULT_PRODUCTS, []), null, "qty below 1 must not pass");
assert.equal(priceOrderLines([], DEFAULT_PRODUCTS, []), null, "empty order must not pass");
console.log("admin order pricing checks passed");
