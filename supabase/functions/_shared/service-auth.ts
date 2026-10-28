// Is this request from our own server (service-role / secret key)?
//
// Comparing the Authorization header to the injected SUPABASE_SERVICE_ROLE_KEY broke when the
// platform started injecting a different key format than the one our server sends: both keys
// are valid, they are just different strings. Instead, accept any key that the Auth admin API
// accepts, which only a service-role JWT or an sb_secret_ key can do.
const verified = new Set<string>();

function jwtRole(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

export async function isServiceRoleRequest(req: Request): Promise<boolean> {
  const header = req.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return false;
  if (token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || verified.has(token)) return true;

  // Cheap rejections for browser callers (anon/user JWTs, publishable keys). The claim is
  // unverified here, so it only ever rules a token out; Auth below decides the rest.
  const isSecretKey = token.startsWith("sb_secret_");
  if (!isSecretKey && jwtRole(token) !== "service_role") return false;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) return false;
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1`, {
      headers: isSecretKey ? { apikey: token } : { apikey: token, Authorization: `Bearer ${token}` },
    });
    await res.body?.cancel();
    if (!res.ok) return false;
  } catch {
    return false;
  }
  verified.add(token);
  return true;
}
