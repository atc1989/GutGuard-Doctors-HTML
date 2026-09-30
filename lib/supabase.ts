import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * Which Postgres schema holds the shop tables. LifeStyle production uses `doctors`;
 * the sandbox mirror at sandbox.gutguard.ph sets this to `sandbox`.
 */
export const SHOP_SCHEMA = process.env.NEXT_PUBLIC_SHOP_DB_SCHEMA || "doctors";
export const isSandboxShop = SHOP_SCHEMA === "sandbox";

/** Doctors, wheel, registration. LifeStyle keeps these in `doctors`, not `public`. */
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, { db: { schema: "doctors" } })
  : null;

/**
 * Shop client, scoped to SHOP_SCHEMA. Deliberately separate from `supabase` above:
 * scoping the default client would send the doctor and wheel RPCs to the sandbox
 * schema too, where they do not exist.
 */
export const supabaseShop = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      db: { schema: SHOP_SCHEMA },
      auth: { persistSession: false, autoRefreshToken: false, storageKey: "gg-shop" },
    })
  : null;
