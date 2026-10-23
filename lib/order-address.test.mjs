// The payment route only charges an order whose address is one real PSGC place, so a faked
// (cheaper) province code cannot ride on a Metro Manila delivery address.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { checkOrderAddress, verifyOrderAddress } from "./order-address.ts";

const read = async (name) => JSON.parse(await readFile(new URL(`../public/psgc/${name}`, import.meta.url), "utf8"));
const provinces = await read("provinces.json");
const ncr = await read("1300000000.json");
const sarangani = await read("1208000000.json");
const cebu = await read("0702200000.json");

const locality = (file, name) => file.localities.find((item) => item.name === name);
const address = (provinceCode, provinceName, file, cityName, barangayIndex = 0) => {
  const city = locality(file, cityName);
  const barangay = city.barangays[barangayIndex];
  return {
    province: provinceName,
    province_code: provinceCode,
    city: city.name,
    city_municipality_code: city.code,
    barangay: barangay.name,
    barangay_code: barangay.code,
  };
};
const check = (order, file) => checkOrderAddress(order, provinces, file);

const pandacan = address("1300000000", "Metro Manila (NCR)", ncr, "City of Manila - Pandacan");
assert.equal(check(pandacan, ncr), "");
assert.equal(check(address("0702200000", "Cebu", cebu, "City of Cebu"), cebu), "", "independent cities stay valid");
assert.equal(check(address("1208000000", "Sarangani", sarangani, "Alabel"), sarangani), "");

// Orders placed before the snapshot carry psgc.cloud's raw names.
const lasPinas = address("1300000000", "Metro Manila (NCR)", ncr, "City of Las Piñas");
assert.equal(check({ ...lasPinas, city: "City of Las PiÃ±as" }, ncr), "", "double-encoded legacy name");
assert.equal(check({ ...pandacan, province: " metro manila (ncr) " }, ncr), "", "case and spaces");

// The attack: Mindanao code for a Manila address, with or without the province name changed.
assert.notEqual(check({ ...pandacan, province_code: "1208000000" }, sarangani), "", "Sarangani code, Metro Manila name");
assert.notEqual(check({ ...pandacan, province_code: "1208000000", province: "Sarangani" }, sarangani), "", "Manila city under Sarangani");
// The same shape as pre-#51 orders, when psgc.cloud listed Makati under Sarangani.
const makati = address("1300000000", "Metro Manila (NCR)", ncr, "City of Makati");
assert.notEqual(check({ ...makati, province: "Sarangani", province_code: "1208000000" }, sarangani), "");

// Names must belong to their codes, and codes must nest.
assert.notEqual(check({ ...pandacan, city: "City of Makati" }, ncr), "", "city name swapped");
assert.notEqual(check({ ...pandacan, barangay: "Somewhere Else" }, ncr), "", "barangay name swapped");
assert.notEqual(check({ ...pandacan, barangay_code: makati.barangay_code }, ncr), "", "barangay from another city");
assert.notEqual(check({ ...pandacan, province: "Cebu" }, ncr), "", "province name swapped");
assert.notEqual(check({ ...pandacan, city_municipality_code: null }, ncr), "");
assert.notEqual(check({ ...pandacan, barangay_code: null }, ncr), "");

// From disk, as the payment route runs it.
assert.equal(await verifyOrderAddress(pandacan), "");
assert.notEqual(await verifyOrderAddress({ ...pandacan, province_code: null }), "");
assert.notEqual(await verifyOrderAddress({ ...pandacan, province_code: "9999999999" }), "");
assert.notEqual(await verifyOrderAddress({ ...pandacan, province_code: "../../etc/x" }), "", "no path tricks");
assert.notEqual(await verifyOrderAddress({ ...pandacan, province_code: "1208000000", province: "Sarangani" }), "");

console.log("order address checks passed");
