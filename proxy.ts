import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let loginLimiter: Ratelimit | null = null;

// Lazily initialised so a missing Upstash env (local dev, CI) doesn't crash the build.
let ipLimiter: Ratelimit | null = null;
let emailLimiter: Ratelimit | null = null;

function getLimiters(): { ip: Ratelimit | null; em: Ratelimit | null } {
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    return { ip: null, em: null };
  }

  if (!ipLimiter) {
    const redis = Redis.fromEnv();
    // 50 OTP sends per IP per 10 minutes — supports high-volume booth / conference Wi-Fi registrations.
    ipLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(50, "10 m"),
      prefix: "rl:otp:ip",
      analytics: false,
    });
    // 2 OTP sends per email address per 5 minutes — stops targeting a single inbox.
    emailLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(2, "5 m"),
      prefix: "rl:otp:email",
      analytics: false,
    });
  }

  return { ip: ipLimiter, em: emailLimiter };
}

// 8 admin login attempts per IP per 15 minutes. The admin password also unlocks partner
// impersonation, so unthrottled guessing is the highest-value target on the site.
function getLoginLimiter(): Ratelimit | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  loginLimiter ??= new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(8, "15 m"),
    prefix: "rl:admin-login:ip",
    analytics: false,
  });
  return loginLimiter;
}

// One lazy limiter per prefix, so a new throttled route is a line rather than another copy of
// the boilerplate above. Null until the UPSTASH_* vars exist.
const limiters = new Map<string, Ratelimit>();
function slidingLimiter(prefix: string, count: number, window: `${number} ${"s" | "m" | "h"}`) {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  if (!limiters.has(prefix)) {
    limiters.set(
      prefix,
      new Ratelimit({ redis: Redis.fromEnv(), limiter: Ratelimit.slidingWindow(count, window), prefix, analytics: false }),
    );
  }
  return limiters.get(prefix) ?? null;
}

// Upstash unreachable: stay closed (as before) but answer with a readable 503, not a crash.
const limiterUnavailable = (what: string) =>
  NextResponse.json({ error: `${what} is temporarily unavailable. Try again shortly.` }, { status: 503 });

export async function proxy(req: NextRequest) {
  // 1. Canonical Host Redirect: Redirect any *.vercel.app request to custom domain
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").toLowerCase();
  if (host.endsWith(".vercel.app") && !host.includes("localhost")) {
    const targetOrigin = (process.env.NEXT_PUBLIC_SITE_URL || "https://partners.gutguard.ph").replace(/\/$/, "");
    const targetUrl = new URL(req.nextUrl.pathname + req.nextUrl.search, targetOrigin);
    return NextResponse.redirect(targetUrl, 308);
  }

  if (req.nextUrl.pathname === "/api/admin/login" && req.method === "POST") {
    const limiter = getLoginLimiter();
    // ponytail: fails open without Redis (local dev); production must set the UPSTASH_* vars.
    if (!limiter) return NextResponse.next();
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
    const result = await limiter.limit(clientIp).catch(() => null);
    if (!result) return limiterUnavailable("Admin login");
    if (!result.success) {
      return NextResponse.json(
        { error: "Too many login attempts. Try again in a few minutes." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((result.reset - Date.now()) / 1000)) } },
      );
    }
    return NextResponse.next();
  }

  // Every checkout code is a real SMS credit, so this one is throttled per order as well as per
  // network: 3 sends per order per 10 minutes covers a mistyped number and a resend, no more.
  if (req.nextUrl.pathname === "/api/shop/otp/send" && req.method === "POST") {
    const ipLimit = slidingLimiter("rl:shop-otp:ip", 20, "10 m");
    const orderLimit = slidingLimiter("rl:shop-otp:order", 3, "10 m");
    if (!ipLimit || !orderLimit) return NextResponse.next();

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
    let orderId = "";
    try {
      const body = await req.clone().json();
      orderId = typeof body?.orderId === "string" ? body.orderId : "";
    } catch {
      // Unparseable body: the IP limit below still applies and the route will reject it.
    }

    for (const [limiter, key] of [[ipLimit, clientIp], [orderLimit, orderId || clientIp]] as const) {
      const result = await limiter.limit(key).catch(() => null);
      if (!result) return limiterUnavailable("Mobile verification");
      if (!result.success) {
        return NextResponse.json(
          { error: "Too many code requests. Wait a few minutes and try again." },
          { status: 429, headers: { "Retry-After": String(Math.ceil((result.reset - Date.now()) / 1000)) } },
        );
      }
    }
    return NextResponse.next();
  }

  // Only gate the OTP proxy route; everything else passes through.
  if (req.nextUrl.pathname !== "/api/auth/send-otp") {
    return NextResponse.next();
  }

  const { ip, em } = getLimiters();

  // Graceful degradation: if Redis is not configured (e.g. local dev without
  // Upstash env vars), allow the request. Supabase GoTrue's own limits remain
  // as the last line of defence.
  if (!ip || !em) return NextResponse.next();

  // Derive the client IP from the proxy-forwarded header (Vercel sets this).
  const forwarded = req.headers.get("x-forwarded-for");
  const clientIp = forwarded ? forwarded.split(",")[0].trim() : "127.0.0.1";

  // Clone the request so we can read the body without consuming the original.
  let email = "";
  try {
    const clone = req.clone();
    const body = await clone.json();
    email = (typeof body?.email === "string" ? body.email : "").trim().toLowerCase();
  } catch {
    // Body parse failure → still apply the IP limit below; skip email limit.
  }

  // 1. Check the IP limit first (cheapest single-key lookup).
  const ipResult = await ip.limit(clientIp).catch(() => null);
  if (!ipResult) return limiterUnavailable("Sign-in");
  if (!ipResult.success) {
    const retryAfter = Math.ceil((ipResult.reset - Date.now()) / 1000);
    return NextResponse.json(
      {
        error:
          "Too many sign-in requests from your network. Please wait a few minutes and try again.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(ipResult.limit),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }

  // 2. Check the per-email limit.
  if (email) {
    const emailResult = await em.limit(email).catch(() => null);
    if (!emailResult) return limiterUnavailable("Sign-in");
    if (!emailResult.success) {
      const retryAfter = Math.ceil((emailResult.reset - Date.now()) / 1000);
      return NextResponse.json(
        {
          error:
            "Too many sign-in emails were sent to this address. Wait a few minutes and try again.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfter),
            "X-RateLimit-Limit": String(emailResult.limit),
            "X-RateLimit-Remaining": "0",
          },
        },
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
