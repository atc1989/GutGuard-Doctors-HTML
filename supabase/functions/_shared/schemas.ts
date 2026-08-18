/**
 * Schema allowlists for Edge Functions.
 *
 * Set the function secret DOCTORS_DB_SCHEMA=doctors on GutGuard Life Style.
 * Leave it unset (or public) on the GutGuard Doctors project.
 * Shop callers may pass schema in the JSON body: public | doctors | sandbox.
 */

export type DoctorsSchema = "public" | "doctors";
export type ShopSchema = "public" | "doctors" | "sandbox";

export function doctorsDbSchema(): DoctorsSchema {
  return Deno.env.get("DOCTORS_DB_SCHEMA")?.trim() === "doctors" ? "doctors" : "public";
}

export function shopDbSchema(requested?: string | null): ShopSchema {
  if (requested === "doctors" || requested === "sandbox") return requested;
  return "public";
}
