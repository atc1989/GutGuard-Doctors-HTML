import crypto from "node:crypto";

// Signed, expiring admin session token: `<jti>.<expMs>.<name>.<hmac>`. It carries no secret, only
// proof that the server issued it to `name` ("owner" or a staff name from ADMIN_STAFF), so a
// leaked cookie cannot reveal the admin password. Modules are looked up from ADMIN_STAFF on every
// request, never read from the token, so removing a staff member locks them out at once.

export const ADMIN_SESSION_MS = 8 * 60 * 60 * 1000;

/** One key per admin nav section. Staff get a subset; the owner gets all of them. */
export const ADMIN_MODULES = [
  "orders",
  "products",
  "promos",
  "referred-shops",
  "doctors",
  "codes",
  "withdrawals",
  "referral-email",
  "wheel",
  "newsletter",
  "sms",
  "sequence",
  "testimonials",
] as const;
export type AdminModule = (typeof ADMIN_MODULES)[number];
export type StaffMember = { name: string; sha256: string; modules: AdminModule[] };
export type AdminAccess = { name: string; owner: boolean; modules: AdminModule[] };

export const OWNER = "owner";
const NAME = /^[A-Za-z0-9_-]{1,32}$/;
const HEX64 = /^[0-9a-f]{64}$/i;

const sign = (secret: string, payload: string) =>
  crypto.createHmac("sha256", secret).update(payload).digest("hex");
const sha256 = (value: string) => crypto.createHash("sha256").update(value.trim()).digest();

export function issueAdminToken(secret: string, name: string, now = Date.now()): string {
  const payload = `${crypto.randomUUID()}.${now + ADMIN_SESSION_MS}.${name}`;
  return `${payload}.${sign(secret, payload)}`;
}

export function readAdminToken(
  secret: string,
  token: string,
  now = Date.now(),
): { jti: string; exp: number; name: string } | null {
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [jti, expRaw, name, mac] = parts;
  const expected = Buffer.from(sign(secret, `${jti}.${expRaw}.${name}`));
  const given = Buffer.from(mac);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  const exp = Number(expRaw);
  return Number.isFinite(exp) && exp > now ? { jti, exp, name } : null;
}

export function passwordMatches(candidate: string, secret: string): boolean {
  return crypto.timingSafeEqual(sha256(candidate), sha256(secret));
}

/**
 * Parses ADMIN_STAFF: `[{"name":"ana","sha256":"<hex of the password>","modules":["orders"]}]`.
 * Bad entries, unknown modules and repeated names are dropped, so a typo never widens access.
 */
export function parseStaff(raw: string | undefined): StaffMember[] {
  if (!raw?.trim()) return [];
  let list: unknown;
  try {
    list = JSON.parse(raw);
  } catch {
    console.error("ADMIN_STAFF is not valid JSON; staff logins are disabled.");
    return [];
  }
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>([OWNER]);
  const staff: StaffMember[] = [];
  for (const entry of list) {
    const { name, sha256: hash, modules } = (entry ?? {}) as Record<string, unknown>;
    if (typeof name !== "string" || !NAME.test(name) || seen.has(name.toLowerCase())) continue;
    if (typeof hash !== "string" || !HEX64.test(hash) || !Array.isArray(modules)) continue;
    seen.add(name.toLowerCase());
    staff.push({
      name,
      sha256: hash.toLowerCase(),
      modules: ADMIN_MODULES.filter((m) => modules.includes(m)),
    });
  }
  return staff;
}

/** Returns who a login password belongs to ("owner" or a staff name), or null. */
export function matchLogin(candidate: string, ownerSecret: string | null, staff: StaffMember[]): string | null {
  if (!candidate.trim()) return null;
  if (ownerSecret && passwordMatches(candidate, ownerSecret)) return OWNER;
  // ponytail: staff hashes are unsalted SHA-256; whoever can read ADMIN_STAFF can read
  // ADMIN_PASSWORD too, and logins are rate limited. Move to scrypt if the list leaves Vercel env.
  const given = sha256(candidate);
  return staff.find((s) => crypto.timingSafeEqual(given, Buffer.from(s.sha256, "hex")))?.name ?? null;
}

/** What a session name may open right now; null when the name is no longer on the list. */
export function accessFor(name: string, staff: StaffMember[]): AdminAccess | null {
  if (name === OWNER) return { name, owner: true, modules: [...ADMIN_MODULES] };
  const member = staff.find((s) => s.name === name);
  return member ? { name, owner: false, modules: member.modules } : null;
}

/** Owner opens everything; staff need one of `modules`. No modules listed = owner only. */
export const allows = (access: AdminAccess, modules: readonly AdminModule[]) =>
  access.owner || modules.some((m) => access.modules.includes(m));
