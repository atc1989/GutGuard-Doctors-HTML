// Runnable check for the two pure functions the payment path depends on.
//   node --experimental-strip-types lib/catalog.test.mjs   (Node 22+)
// or: npx tsx lib/catalog.test.mjs
import assert from "node:assert/strict";
import { recomputeSubtotal } from "./catalog.ts";
import { isValidShippingFee } from "./shipping.ts";

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

// Shipping fees must come from the published rate table.
assert.equal(isValidShippingFee(0), true, "legacy rows only");
assert.equal(isValidShippingFee(90), true);
assert.equal(isValidShippingFee(565), true);
assert.equal(isValidShippingFee(-500), false, "a negative fee must not offset the subtotal");
assert.equal(isValidShippingFee(1), false);

console.log("catalog + shipping checks passed");

// Region code is derived from the PSGC province code, since psgc.cloud dropped region_code.
// Davao del Sur -> Mindanao rates, not the Luzon default.
import { quoteShipping } from "./shipping.ts";
const oneBlister = [{ id: "trial-blister", name: "Blister", caps: 10, price: 1499, qty: 1 }];
assert.equal(quoteShipping(oneBlister, { province: "Davao del Sur", regionCode: "110000000" }).area, "mindanao");
assert.equal(quoteShipping(oneBlister, { province: "Cebu", regionCode: "070000000" }).area, "visayas");
assert.equal(quoteShipping(oneBlister, { province: "Batangas", regionCode: "040000000" }).area, "luzon");
assert.equal(quoteShipping(oneBlister, { province: "Palawan", regionCode: "170000000" }).area, "island");
console.log("shipping area checks passed");

// Manual address entry was removed: without a province there is no quote, and no
// silent zero-shipping order. Every priced order carries a real rate.
assert.equal(quoteShipping(oneBlister, { province: "", regionCode: "" }).fee, 0);
assert.equal(quoteShipping(oneBlister, { province: "", regionCode: "" }).error, "");
assert.equal(quoteShipping(oneBlister, { province: "Davao del Sur", regionCode: "110000000" }).fee, 90);
console.log("no-manual-address checks passed");

// Protocol tier pricing. These are money values that the server re-derives at checkout,
// so a typo here silently rejects every protocol order - assert them explicitly.
import { TIERS } from "./catalog.ts";
const tier = (id) => TIERS.find((t) => t.id === id);
assert.equal(tier("start").caps, 30);
assert.equal(tier("start").perCap, 133);
assert.equal(tier("start").price, 3999);
assert.equal(tier("grow").caps, 90);
assert.equal(tier("grow").perCap, 122);
assert.equal(tier("grow").price, 10999);
assert.equal(tier("peak").caps, 330);
assert.equal(tier("peak").perCap, 90);
assert.equal(tier("peak").price, 29999);

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
