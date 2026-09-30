import crypto from "node:crypto";

// Signed, expiring admin session token: `<jti>.<expMs>.<hmac>`. It carries no secret, only
// proof that the server issued it, so a leaked cookie cannot reveal the admin password.
// The HMAC key is ADMIN_PASSWORD itself, so rotating the password revokes every session.

export const ADMIN_SESSION_MS = 8 * 60 * 60 * 1000;

const sign = (secret: string, payload: string) =>
  crypto.createHmac("sha256", secret).update(payload).digest("hex");

export function issueAdminToken(secret: string, now = Date.now()): string {
  const payload = `${crypto.randomUUID()}.${now + ADMIN_SESSION_MS}`;
  return `${payload}.${sign(secret, payload)}`;
}

export function readAdminToken(secret: string, token: string, now = Date.now()): { jti: string; exp: number } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [jti, expRaw, mac] = parts;
  const expected = Buffer.from(sign(secret, `${jti}.${expRaw}`));
  const given = Buffer.from(mac);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  const exp = Number(expRaw);
  return Number.isFinite(exp) && exp > now ? { jti, exp } : null;
}

export function passwordMatches(candidate: string, secret: string): boolean {
  const a = crypto.createHash("sha256").update(candidate.trim()).digest();
  const b = crypto.createHash("sha256").update(secret.trim()).digest();
  return crypto.timingSafeEqual(a, b);
}
