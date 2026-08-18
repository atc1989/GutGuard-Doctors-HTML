/**
 * GutGuard product data lives in Postgres schemas, not separate Supabase projects.
 *
 *   gema     — GEMA / Lifestyle / Academy (Lifestyle project only)
 *   doctors  — this app on GutGuard Life Style (production)
 *   public   — this app on GutGuard Doctors (current live / future staging)
 *   sandbox  — sandbox.gutguard.ph shop mirror
 *
 * Defaults stay `public` so today's Vercel production (Doctors project) keeps working.
 * Pointing this app at Lifestyle requires both env vars set to `doctors`.
 */

export const DOCTORS_SCHEMAS = ["public", "doctors"] as const;
export const SHOP_SCHEMAS = ["public", "doctors", "sandbox"] as const;

export type DoctorsSchema = (typeof DOCTORS_SCHEMAS)[number];
export type ShopSchema = (typeof SHOP_SCHEMAS)[number];

export function resolveDoctorsSchema(value: string | undefined | null): DoctorsSchema {
  return value?.trim() === "doctors" ? "doctors" : "public";
}

export function resolveShopSchema(value: string | undefined | null): ShopSchema {
  const normalized = value?.trim();
  if (normalized === "doctors" || normalized === "sandbox") return normalized;
  return "public";
}

export const DOCTORS_SCHEMA = resolveDoctorsSchema(process.env.NEXT_PUBLIC_DOCTORS_DB_SCHEMA);
export const SHOP_SCHEMA = resolveShopSchema(process.env.NEXT_PUBLIC_SHOP_DB_SCHEMA);
export const isSandboxShop = SHOP_SCHEMA === "sandbox";
