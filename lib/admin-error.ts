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
