import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

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
    // 5 OTP sends per IP per 10 minutes — stops scripted spray from one host.
    ipLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "10 m"),
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

export async function middleware(req: NextRequest) {
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
  const ipResult = await ip.limit(clientIp);
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
    const emailResult = await em.limit(email);
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

// Narrow the matcher so this file doesn't add overhead to any other route.
export const config = {
  matcher: "/api/auth/send-otp",
};
