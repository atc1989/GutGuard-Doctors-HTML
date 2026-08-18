import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * Which Postgres schema holds the shop tables. Production uses `public`; the sandbox
 * mirror at sandbox.gutguard.ph sets this to `sandbox`, so the two run identical code
 * against separate data without duplicating a single function name.
 */
export const SHOP_SCHEMA = process.env.NEXT_PUBLIC_SHOP_DB_SCHEMA || "public";
export const isSandboxShop = SHOP_SCHEMA !== "public";

/** Default client - doctors, wheel, registration. Always `public`, shared by both. */
export const supabase = isSupabaseConfigured ? createClient(supabaseUrl!, supabaseAnonKey!) : null;

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
