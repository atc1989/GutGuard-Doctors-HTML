import assert from "node:assert/strict";
import { issueAdminToken, readAdminToken, passwordMatches, ADMIN_SESSION_MS } from "./admin-token.ts";

const now = 1_000_000;
const token = issueAdminToken("secret", now);
assert.ok(readAdminToken("secret", token, now + 1000), "valid token reads");
assert.equal(readAdminToken("other", token, now + 1000), null, "wrong secret rejected");
assert.equal(readAdminToken("secret", token, now + ADMIN_SESSION_MS + 1), null, "expired rejected");
const [jti, exp, mac] = token.split(".");
assert.equal(readAdminToken("secret", `${jti}.${Number(exp) + 999999}.${mac}`, now), null, "tampered expiry rejected");
assert.equal(readAdminToken("secret", "garbage", now), null);
assert.ok(!token.includes("secret"), "token holds no secret");
assert.ok(passwordMatches(" pw ", "pw") && !passwordMatches("pw2", "pw"));
console.log("admin token checks passed");
