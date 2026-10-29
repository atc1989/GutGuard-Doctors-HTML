import { cookies } from "next/headers";
import { Redis } from "@upstash/redis";
import {
  ADMIN_SESSION_MS,
  ADMIN_MODULES,
  OWNER,
  allows,
  cleanModules,
  cleanUsername,
  issueAdminToken,
  passwordMatches,
  readAdminToken,
  verifyPassword,
  type AdminAccess,
  type AdminModule,
} from "@/lib/admin-token";
import { supabaseAdminShop } from "@/lib/supabase-admin";

export const ADMIN_SESSION_COOKIE = "gg_admin_session";
export const ADMIN_SESSION_MAX_AGE_S = ADMIN_SESSION_MS / 1000;

// ADMIN_PASSWORD is required: it is the super admin login (username "admin") and the value passed
// to the assert_wheel_admin RPCs. No fallback key - unset means locked out. Staff accounts live in
// <shop schema>.admin_staff (Admin -> Staff) and never learn it: the server still passes it to the
// RPCs once the module check passes.
const adminPassword = () => process.env.ADMIN_PASSWORD?.trim() || null;

type StaffRow = { password_hash: string; modules: string[]; active: boolean; password_changed_at: string };
async function staffRow(username: string): Promise<StaffRow | null> {
  if (!supabaseAdminShop) return null;
  const { data, error } = await supabaseAdminShop
    .from("admin_staff")
    .select("password_hash, modules, active, password_changed_at")
    .eq("username", username)
    .maybeSingle();
  if (error) console.error("admin_staff lookup failed:", error.message);
  return (data as StaffRow | null) ?? null;
}
// Cookie HMAC key. Set ADMIN_SESSION_SECRET (long random) so a leaked cookie cannot be used to
// brute-force the password offline; falls back to the password so existing deploys keep working.
const sessionKey = () => (adminPassword() ? process.env.ADMIN_SESSION_SECRET?.trim() || adminPassword() : null);

// ponytail: logout revocation needs a store; uses the Upstash Redis already used for rate
// limits. Without it a logged-out cookie stays valid until expiry (8h) or password rotation.
const redis = () =>
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN ? Redis.fromEnv() : null;
const revokedKey = (jti: string) => `admin-session-revoked:${jti}`;

/** Returns who is logging in ("admin" or a staff username). Fails closed when ADMIN_PASSWORD is unset. */
export async function matchAdminLogin(username: string, password: string): Promise<string | null> {
  const secret = adminPassword();
  if (!secret || !password.trim()) return null;
  const name = username.trim().toLowerCase();
  if (name === OWNER) return passwordMatches(password, secret) ? OWNER : null;
  const staffName = cleanUsername(name);
  const row = staffName ? await staffRow(staffName) : null;
  // verifyPassword runs even without a row, so a wrong username takes as long as a wrong password.
  const ok = await verifyPassword(password.trim(), row?.password_hash ?? null);
  return ok && row?.active ? staffName : null;
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
  if (session.name === OWNER) return { name: OWNER, owner: true, modules: [...ADMIN_MODULES] };

  // Staff: re-read the row so removing, disabling or a password reset ends the session at once.
  const row = await staffRow(session.name);
  const issuedAt = session.exp - ADMIN_SESSION_MS;
  if (!row?.active || Date.parse(row.password_changed_at) > issuedAt) return null;
  return { name: session.name, owner: false, modules: cleanModules(row.modules) };
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
