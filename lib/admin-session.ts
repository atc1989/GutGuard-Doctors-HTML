import { cookies } from "next/headers";
import { Redis } from "@upstash/redis";
import { ADMIN_SESSION_MS, issueAdminToken, passwordMatches, readAdminToken } from "@/lib/admin-token";

export const ADMIN_SESSION_COOKIE = "gg_admin_session";
export const ADMIN_SESSION_MAX_AGE_S = ADMIN_SESSION_MS / 1000;

// ADMIN_PASSWORD is required: it is the login secret and the value passed to the
// assert_wheel_admin RPCs. No fallback key - unset means locked out.
const adminPassword = () => process.env.ADMIN_PASSWORD?.trim() || null;
// Cookie HMAC key. Set ADMIN_SESSION_SECRET (long random) so a leaked cookie cannot be used to
// brute-force the password offline; falls back to the password so existing deploys keep working.
const sessionKey = () => (adminPassword() ? process.env.ADMIN_SESSION_SECRET?.trim() || adminPassword() : null);

// ponytail: logout revocation needs a store; uses the Upstash Redis already used for rate
// limits. Without it a logged-out cookie stays valid until expiry (8h) or password rotation.
const redis = () =>
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN ? Redis.fromEnv() : null;
const revokedKey = (jti: string) => `admin-session-revoked:${jti}`;

/** Checks a login attempt against ADMIN_PASSWORD. Fails closed when it is not configured. */
export async function verifyAdminPassword(candidate: string): Promise<boolean> {
  const secret = adminPassword();
  return Boolean(secret) && Boolean(candidate.trim()) && passwordMatches(candidate, secret!);
}

export function createAdminSessionToken(): string | null {
  const key = sessionKey();
  return key ? issueAdminToken(key) : null;
}

/**
 * Validates the admin session cookie and returns the password the server routes pass to the
 * Supabase RPCs / edge functions. Returns null if the session is missing, expired or revoked.
 */
export async function getAdminPasswordFromSession(): Promise<string | null> {
  const secret = adminPassword();
  const key = sessionKey();
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!secret || !key || !token) return null;

  const session = readAdminToken(key, token);
  if (!session) return null;

  const store = redis();
  if (store) {
    try {
      if (await store.get(revokedKey(session.jti))) return null;
    } catch {
      return null; // can't confirm the session is live - fail closed
    }
  }
  return secret;
}

/** Marks the current session revoked so a copied cookie stops working at logout. */
export async function revokeAdminSession(): Promise<void> {
  const key = sessionKey();
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  const session = key && token ? readAdminToken(key, token) : null;
  const store = redis();
  if (!session || !store) return;
  const ttl = Math.max(1, Math.ceil((session.exp - Date.now()) / 1000));
  await store.set(revokedKey(session.jti), 1, { ex: ttl }).catch(() => undefined);
}
