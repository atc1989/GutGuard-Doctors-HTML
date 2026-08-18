import assert from "node:assert/strict";
import { resolveDoctorsSchema, resolveShopSchema } from "./db-schemas.ts";

assert.equal(resolveDoctorsSchema(undefined), "public");
assert.equal(resolveDoctorsSchema(""), "public");
assert.equal(resolveDoctorsSchema("public"), "public");
assert.equal(resolveDoctorsSchema("doctors"), "doctors");
assert.equal(resolveDoctorsSchema(" sandbox "), "public", "doctors client never uses the shop sandbox schema");
assert.equal(resolveDoctorsSchema("gema"), "public", "unknown values must not select an arbitrary schema");

assert.equal(resolveShopSchema(undefined), "public");
assert.equal(resolveShopSchema("public"), "public");
assert.equal(resolveShopSchema("doctors"), "doctors");
assert.equal(resolveShopSchema("sandbox"), "sandbox");
assert.equal(resolveShopSchema("gema"), "public");

console.log("db-schemas checks passed");
