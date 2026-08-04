// Runnable check for the two pure functions the payment path depends on.
//   node --experimental-strip-types lib/catalog.test.mjs   (Node 22+)
// or: npx tsx lib/catalog.test.mjs
import assert from "node:assert/strict";
import { recomputeSubtotal } from "./catalog.ts";
import { isValidShippingFee } from "./shipping.ts";

const line = (over = {}) => ({ id: "peak", name: "SynBIOTIC+ Peak", caps: 400, price: 39999, qty: 1, ...over });

// Honest baskets price correctly.
assert.equal(recomputeSubtotal([line()]), 39999);
assert.equal(recomputeSubtotal([line({ qty: 2 })]), 79998);
assert.equal(recomputeSubtotal([line(), line({ id: "trial-bottle", price: 3799, caps: 30 })]), 43798);

// Tampering is rejected, which is the whole point of recomputing server-side.
assert.equal(recomputeSubtotal([line({ price: 1 })]), null, "a rewritten price must not pass");
assert.equal(recomputeSubtotal([line({ id: "free-stuff" })]), null, "an unknown product must not pass");
assert.equal(recomputeSubtotal([line({ qty: 0 })]), null, "qty below 1 must not pass");
assert.equal(recomputeSubtotal([line({ qty: 999 })]), null, "qty above the per-line cap must not pass");
assert.equal(recomputeSubtotal([line({ qty: 1.5 })]), null, "fractional qty must not pass");
assert.equal(recomputeSubtotal([]), null, "empty basket must not pass");

// Shipping fees must come from the published rate table.
assert.equal(isValidShippingFee(0), true, "0 means manual review / no address yet");
assert.equal(isValidShippingFee(90), true);
assert.equal(isValidShippingFee(565), true);
assert.equal(isValidShippingFee(-500), false, "a negative fee must not offset the subtotal");
assert.equal(isValidShippingFee(1), false);

console.log("catalog + shipping checks passed");

// Region code is derived from the PSGC province code, since psgc.cloud dropped region_code.
// Davao del Sur -> Mindanao rates, not the Luzon default.
import { quoteShipping } from "./shipping.ts";
const oneBlister = [{ id: "trial-blister", name: "Blister", caps: 10, price: 1299, qty: 1 }];
assert.equal(quoteShipping(oneBlister, { province: "Davao del Sur", regionCode: "110000000", manualAddress: false }).area, "mindanao");
assert.equal(quoteShipping(oneBlister, { province: "Cebu", regionCode: "070000000", manualAddress: false }).area, "visayas");
assert.equal(quoteShipping(oneBlister, { province: "Batangas", regionCode: "040000000", manualAddress: false }).area, "luzon");
assert.equal(quoteShipping(oneBlister, { province: "Palawan", regionCode: "170000000", manualAddress: false }).area, "island");
console.log("shipping area checks passed");
