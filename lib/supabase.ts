import { createClient } from "@supabase/supabase-js";
import { DOCTORS_SCHEMA, SHOP_SCHEMA, isSandboxShop } from "@/lib/db-schemas";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export { DOCTORS_SCHEMA, SHOP_SCHEMA, isSandboxShop };

/**
 * Default client — doctors, wheel, registration RPCs.
 * GutGuard Doctors (current live) keeps these in `public`.
 * GutGuard Life Style (intended production) keeps them in `doctors`.
 */
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, { db: { schema: DOCTORS_SCHEMA } })
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
