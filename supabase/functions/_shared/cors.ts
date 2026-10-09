// Replaces the blanket `Access-Control-Allow-Origin: *` each function used to send.
// Only the site's own origins may call these from a browser; server-to-server callers
// (no Origin header) are unaffected. Override with the ALLOWED_ORIGINS secret (comma list).
const DEFAULT_ORIGINS = [
  "https://gutguard.ph",
  "https://www.gutguard.ph",
  "https://shop.gutguard.ph",
  "https://partners.gutguard.ph",
  "https://sandbox.gutguard.ph",
  "http://localhost:3000",
];

const allowed = (Deno.env.get("ALLOWED_ORIGINS") ?? DEFAULT_ORIGINS.join(","))
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

/** Drop-in for Deno.serve: rewrites the CORS origin header on every response. */
export function serveWithCors(handler: (req: Request) => Response | Promise<Response>) {
  return Deno.serve(async (req) => {
    const res = await handler(req);
    const origin = req.headers.get("Origin") ?? "";
    const headers = new Headers(res.headers);
    if (origin && allowed.includes(origin)) headers.set("Access-Control-Allow-Origin", origin);
    else headers.delete("Access-Control-Allow-Origin");
    headers.append("Vary", "Origin");
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  });
}
