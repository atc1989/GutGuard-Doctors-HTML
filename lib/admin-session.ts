import crypto from "node:crypto";
import { cookies } from "next/headers";
import { isSupabaseAdminConfigured as isSupabaseConfigured, supabaseAdmin as supabase } from "@/lib/supabase-admin";

export const ADMIN_SESSION_COOKIE = "gg_admin_session";
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

function getSecretKey(): Buffer {
  const secret =
    process.env.ADMIN_PASSWORD ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "gutguard-admin-secret-key-32bytes-fallback!";
  return crypto.scryptSync(secret, "gg-admin-salt-v1", 32);
}

export function encryptAdminSession(password: string): string {
  const key = getSecretKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const payload = JSON.stringify({
    pwd: password,
    exp: Date.now() + SESSION_DURATION_MS,
  });
  const encrypted = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptAdminSession(token: string): { password?: string; isValid: boolean } {
  try {
    const parts = token.split(":");
    if (parts.length !== 3) return { isValid: false };
    const [ivHex, tagHex, encryptedHex] = parts;
    const key = getSecretKey();
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const encrypted = Buffer.from(encryptedHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
    const data = JSON.parse(decrypted) as { pwd?: string; exp?: number };
    if (!data.exp || Date.now() > data.exp || !data.pwd) {
      return { isValid: false };
    }
    return { password: data.pwd, isValid: true };
  } catch {
    return { isValid: false };
  }
}

/**
 * Validates the admin session from cookies and returns the admin password to use for Supabase calls.
 * Returns null if the session is invalid or expired.
 */
export async function getAdminPasswordFromSession(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return null;

  const { password, isValid } = decryptAdminSession(token);
  if (!isValid || !password) return null;

  return process.env.ADMIN_PASSWORD || password;
}

/**
 * Verifies a candidate admin password against env or Supabase RPC.
 */
export async function verifyAdminPassword(candidate: string): Promise<boolean> {
  const trimmed = candidate.trim();
  if (!trimmed) return false;

  if (process.env.ADMIN_PASSWORD && trimmed === process.env.ADMIN_PASSWORD.trim()) {
    return true;
  }

  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.rpc("admin_list_wheel_prizes", {
      p_admin_password: trimmed,
    });
    if (!error) return true;
  }

  return false;
}
