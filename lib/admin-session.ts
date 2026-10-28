import { cookies } from "next/headers";
import { Redis } from "@upstash/redis";
import {
  ADMIN_SESSION_MS,
  accessFor,
  allows,
  issueAdminToken,
  matchLogin,
  parseStaff,
  readAdminToken,
  type AdminAccess,
  type AdminModule,
} from "@/lib/admin-token";

export const ADMIN_SESSION_COOKIE = "gg_admin_session";
export const ADMIN_SESSION_MAX_AGE_S = ADMIN_SESSION_MS / 1000;

// ADMIN_PASSWORD is required: it is the owner login and the value passed to the
// assert_wheel_admin RPCs. No fallback key - unset means locked out.
const adminPassword = () => process.env.ADMIN_PASSWORD?.trim() || null;
// Staff logins with their modules (see parseStaff). They never learn ADMIN_PASSWORD: the server
// still passes it to the RPCs once the module check passes.
const staff = () => parseStaff(process.env.ADMIN_STAFF);
// Cookie HMAC key. Set ADMIN_SESSION_SECRET (long random) so a leaked cookie cannot be used to
// brute-force the password offline; falls back to the password so existing deploys keep working.
const sessionKey = () => (adminPassword() ? process.env.ADMIN_SESSION_SECRET?.trim() || adminPassword() : null);

// ponytail: logout revocation needs a store; uses the Upstash Redis already used for rate
// limits. Without it a logged-out cookie stays valid until expiry (8h) or password rotation.
const redis = () =>
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN ? Redis.fromEnv() : null;
const revokedKey = (jti: string) => `admin-session-revoked:${jti}`;

/** Returns who is logging in ("owner" or a staff name). Fails closed when ADMIN_PASSWORD is unset. */
export async function matchAdminLogin(candidate: string): Promise<string | null> {
  const secret = adminPassword();
  return secret ? matchLogin(candidate, secret, staff()) : null;
}

export function createAdminSessionToken(name: string): string | null {
  const key = sessionKey();
  return key ? issueAdminToken(key, name) : null;
}

/** The logged-in admin and their modules, or null if the session is missing, expired or revoked. */
export async function getAdminSession(): Promise<AdminAccess | null> {
  const key = sessionKey();
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!key || !token) return null;

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
  return accessFor(session.name, staff());
}

/**
 * Returns the password the server routes pass to the Supabase RPCs / edge functions when the
 * session may open one of `modules`, else null. No modules listed = owner only.
 */
export async function getAdminPasswordFromSession(...modules: AdminModule[]): Promise<string | null> {
  const access = await getAdminSession();
  return access && allows(access, modules) ? adminPassword() : null;
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
