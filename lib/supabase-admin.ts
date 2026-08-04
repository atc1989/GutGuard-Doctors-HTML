import { createClient } from "@supabase/supabase-js";

// Server-only. The service role key bypasses RLS, so this must never be imported
// from a "use client" module or a component that ships to the browser.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isSupabaseAdminConfigured = Boolean(url && serviceRoleKey);

export function getSupabaseAdmin() {
  if (!url || !serviceRoleKey) throw new Error("Supabase service role credentials are not configured.");
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}
