// Checks the address snapshot in public/psgc (built by scripts/build-psgc.mjs). Shipping is
// priced from these codes, so a bad re-run must fail here, not at checkout.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const dir = new URL("../public/psgc/", import.meta.url);
const read = async (name) => JSON.parse(await readFile(new URL(name, dir), "utf8"));

const { provinces, fetchedAt } = await read("provinces.json");
assert.match(fetchedAt, /^\d{4}-\d{2}-\d{2}$/);
assert.ok(provinces.length >= 80, "province list is incomplete");

const files = new Map();
for (const province of provinces) files.set(province.code, (await read(`${province.code}.json`)).localities);
const named = (name) => files.get(provinces.find((province) => province.name === name)?.code);

let barangays = 0;
for (const province of provinces) {
  const localities = files.get(province.code);
  assert.ok(localities.length > 0, `${province.name} has no cities`);
  for (const locality of localities) {
    // Region digits drive the shipping rate: a city filed under another region's province
    // (psgc.cloud lists Metro Manila under Sarangani) would be priced wrong.
    assert.equal(locality.code.slice(0, 2), province.code.slice(0, 2), `${locality.name} is outside ${province.name}'s region`);
    assert.ok(locality.barangays.length > 0, `${province.name}/${locality.name} has no barangays`);
    assert.match(locality.zipCode, /^(\d{4})?$/);
    barangays += locality.barangays.length;
    for (const item of [province, locality, ...locality.barangays]) {
      assert.equal(item.name, item.name.trim(), `untrimmed name "${item.name}"`);
      assert.doesNotMatch(item.name, /Ã|Â/, `garbled name "${item.name}"`);
      assert.match(item.code, /^\d{10}$/);
    }
  }
}
assert.ok(barangays >= 41000, "barangay list is incomplete");

// Metro Manila: present, every LGU, Manila split into districts that have barangays.
const ncr = files.get("1300000000");
assert.equal(provinces.find((province) => province.code === "1300000000")?.name, "Metro Manila (NCR)");
for (const city of ["Quezon City", "City of Makati", "City of Las Piñas", "City of Parañaque", "Pateros", "City of Manila - Tondo I/II"]) {
  assert.ok(ncr.some((locality) => locality.name === city), `NCR is missing ${city}`);
}
assert.ok(!ncr.some((locality) => locality.name === "City of Manila"), "City of Manila has no barangays of its own");
assert.ok(ncr.every((locality) => !locality.zipCode || Number(locality.zipCode) < 1900), "NCR ZIPs are 0400-1899");

// Independent cities stay under their province; Sarangani has only its own towns.
assert.ok(named("Cebu").some((locality) => locality.name === "City of Cebu"));
assert.ok(named("Davao del Sur").some((locality) => locality.name === "City of Davao"));
assert.ok(named("Sarangani").every((locality) => locality.code.startsWith("12")));

console.log(`psgc data checks passed (${provinces.length} provinces, ${barangays} barangays, fetched ${fetchedAt})`);
