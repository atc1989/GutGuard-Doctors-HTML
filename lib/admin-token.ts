import crypto from "node:crypto";

// Signed, expiring admin session token: `<jti>.<expMs>.<name>.<hmac>`. It carries no secret, only
// proof that the server issued it to `name` ("admin" = super admin, or a staff username), so a
// leaked cookie cannot reveal a password. Staff modules are read from the admin_staff table on
// every request, never from the token, so edits and removals take effect at once.

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
export type AdminAccess = { name: string; owner: boolean; modules: AdminModule[] };

/** The super admin's username; it logs in with ADMIN_PASSWORD and is never a staff row. */
export const OWNER = "admin";
const USERNAME = /^[a-z0-9_-]{3,32}$/;

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

/** Lower-cased staff username, or null when it can't be one (no dots: they split the token). */
export function cleanUsername(value: unknown): string | null {
  const name = typeof value === "string" ? value.trim().toLowerCase() : "";
  return USERNAME.test(name) && name !== OWNER ? name : null;
}

/** Keeps only known module keys, in menu order. */
export const cleanModules = (value: unknown): AdminModule[] =>
  Array.isArray(value) ? ADMIN_MODULES.filter((m) => value.includes(m)) : [];

// scrypt with a per-password salt: staff hashes live in the database, so they must resist offline guessing.
const scrypt = (password: string, salt: Buffer) =>
  new Promise<Buffer>((resolve, reject) =>
    crypto.scrypt(password, salt, 32, (error, key) => (error ? reject(error) : resolve(key))),
  );

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  return `scrypt:${salt.toString("hex")}:${(await scrypt(password, salt)).toString("hex")}`;
}

/** Checks a password against hashPassword output. Always does the work, so a missing account takes as long. */
export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  const [kind, salt, hash] = (stored ?? "scrypt:00:00").split(":");
  const key = await scrypt(password, Buffer.from(salt, "hex"));
  const expected = Buffer.from(hash, "hex");
  return Boolean(stored) && kind === "scrypt" && expected.length === key.length && crypto.timingSafeEqual(key, expected);
}

/** Owner opens everything; staff need one of `modules`. No modules listed = owner only. */
export const allows = (access: AdminAccess, modules: readonly AdminModule[]) =>
  access.owner || modules.some((m) => access.modules.includes(m));
