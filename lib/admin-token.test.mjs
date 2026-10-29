import assert from "node:assert/strict";
import {
  issueAdminToken,
  readAdminToken,
  passwordMatches,
  ADMIN_SESSION_MS,
  cleanUsername,
  cleanModules,
  hashPassword,
  verifyPassword,
  allows,
} from "./admin-token.ts";

const now = 1_000_000;
const token = issueAdminToken("secret", "admin", now);
assert.equal(readAdminToken("secret", token, now + 1000)?.name, "admin", "valid token reads with its name");
assert.equal(readAdminToken("other", token, now + 1000), null, "wrong secret rejected");
assert.equal(readAdminToken("secret", token, now + ADMIN_SESSION_MS + 1), null, "expired rejected");
const [jti, exp, name, mac] = token.split(".");
assert.equal(readAdminToken("secret", `${jti}.${Number(exp) + 999999}.${name}.${mac}`, now), null, "tampered expiry rejected");
assert.equal(readAdminToken("secret", `${jti}.${exp}.ana.${mac}`, now), null, "tampered name rejected");
assert.equal(readAdminToken("secret", `${jti}.${exp}.${mac}`, now), null, "old 3-part token rejected");
assert.equal(readAdminToken("secret", "garbage", now), null);
assert.ok(!token.includes("secret"), "token holds no secret");
assert.ok(passwordMatches(" pw ", "pw") && !passwordMatches("pw2", "pw"));

// Staff usernames and modules from the Staff page.
assert.equal(cleanUsername(" Ana_1 "), "ana_1");
assert.equal(cleanUsername("admin"), null, "super admin name is reserved");
assert.equal(cleanUsername("a.b"), null, "dots would split the token");
assert.equal(cleanUsername("ab"), null, "too short");
assert.deepEqual(cleanModules(["products", "orders", "staff", "impersonate"]), ["orders", "products"], "known keys only, menu order");
assert.deepEqual(cleanModules("orders"), []);

const stored = await hashPassword("correct horse");
assert.ok(stored.startsWith("scrypt:") && !stored.includes("correct"), "salted hash, no plain text");
assert.notEqual(stored, await hashPassword("correct horse"), "salt differs per hash");
assert.ok(await verifyPassword("correct horse", stored));
assert.ok(!(await verifyPassword("wrong", stored)));
assert.ok(!(await verifyPassword("correct horse", null)), "missing account never matches");

const owner = { name: "admin", owner: true, modules: [] };
const ana = { name: "ana", owner: false, modules: ["orders", "products"] };
assert.ok(allows(owner, []) && allows(owner, ["withdrawals"]), "owner opens everything");
assert.ok(allows(ana, ["orders"]) && allows(ana, ["doctors", "products"]), "staff opens own modules");
assert.ok(!allows(ana, ["withdrawals"]), "staff blocked from other modules");
assert.ok(!allows(ana, []), "no modules listed = owner only");
console.log("admin token checks passed");
