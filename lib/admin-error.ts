// Supabase/PostgREST errors are plain objects, not Error instances, so `instanceof Error`
// silently replaced their message with a generic one. Admin routes are behind the session,
// so surfacing the real message to the admin is safe and makes failures diagnosable.
export function adminErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object") {
    const { message, details, hint } = error as { message?: unknown; details?: unknown; hint?: unknown };
    if (typeof message === "string" && message) {
      return [message, details, hint].filter((part) => typeof part === "string" && part).join(" - ");
    }
  }
  return fallback;
}

/** HTTP status for an admin route failure: caller mistakes are 4xx, everything else 500. */
export function adminErrorStatus(error: unknown): number {
  if (error instanceof SyntaxError) return 400; // malformed JSON body
  const code = error && typeof error === "object" ? (error as { code?: unknown }).code : undefined;
  if (code === "22023" || code === "23514" || code === "22P02") return 400;
  if (code === "P0002") return 404;
  if (code === "42501" || code === "28000") return 403;
  return 500;
}
