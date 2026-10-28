import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  issueAdminToken,
  readAdminToken,
  passwordMatches,
  ADMIN_SESSION_MS,
  parseStaff,
  matchLogin,
  accessFor,
  allows,
} from "./admin-token.ts";

const now = 1_000_000;
const token = issueAdminToken("secret", "owner", now);
assert.equal(readAdminToken("secret", token, now + 1000)?.name, "owner", "valid token reads with its name");
assert.equal(readAdminToken("other", token, now + 1000), null, "wrong secret rejected");
assert.equal(readAdminToken("secret", token, now + ADMIN_SESSION_MS + 1), null, "expired rejected");
const [jti, exp, name, mac] = token.split(".");
assert.equal(readAdminToken("secret", `${jti}.${Number(exp) + 999999}.${name}.${mac}`, now), null, "tampered expiry rejected");
assert.equal(readAdminToken("secret", `${jti}.${exp}.ana.${mac}`, now), null, "tampered name rejected");
assert.equal(readAdminToken("secret", `${jti}.${exp}.${mac}`, now), null, "old 3-part token rejected");
assert.equal(readAdminToken("secret", "garbage", now), null);
assert.ok(!token.includes("secret"), "token holds no secret");
assert.ok(passwordMatches(" pw ", "pw") && !passwordMatches("pw2", "pw"));

// Staff list: bad entries, unknown modules, repeats and the reserved "owner" name are dropped.
const hash = (pw) => crypto.createHash("sha256").update(pw).digest("hex");
const staff = parseStaff(
  JSON.stringify([
    { name: "ana", sha256: hash("ana-pw"), modules: ["orders", "products", "impersonate"] },
    { name: "ana", sha256: hash("other"), modules: ["withdrawals"] },
    { name: "owner", sha256: hash("x"), modules: ["orders"] },
    { name: "bad.name", sha256: hash("y"), modules: ["orders"] },
    { name: "ben", sha256: "nothex", modules: ["orders"] },
  ]),
);
assert.deepEqual(staff, [{ name: "ana", sha256: hash("ana-pw"), modules: ["orders", "products"] }]);
assert.deepEqual(parseStaff("not json"), []);
assert.deepEqual(parseStaff(undefined), []);

assert.equal(matchLogin("ownerpw", "ownerpw", staff), "owner");
assert.equal(matchLogin(" ana-pw ", "ownerpw", staff), "ana");
assert.equal(matchLogin("other", "ownerpw", staff), null, "dropped duplicate can't log in");
assert.equal(matchLogin("", "ownerpw", staff), null);

const owner = accessFor("owner", staff);
const ana = accessFor("ana", staff);
assert.ok(owner && allows(owner, []) && allows(owner, ["withdrawals"]), "owner opens everything");
assert.ok(ana && allows(ana, ["orders"]) && allows(ana, ["doctors", "products"]), "staff opens own modules");
assert.ok(!allows(ana, ["withdrawals"]), "staff blocked from other modules");
assert.ok(!allows(ana, []), "no modules listed = owner only");
assert.equal(accessFor("removed", staff), null, "removed staff loses the session");
console.log("admin token checks passed");
