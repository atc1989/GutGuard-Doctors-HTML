import type { NextConfig } from "next";

// One Vercel project serves the public website and two operational hosts:
//   gutguard.ph          - marketing pages
//   shop.gutguard.ph     - the shop and Maya checkout
//   partners.gutguard.ph - registration, partner area, /dr/<slug> QR links
// The app's own "/" is now the consumer marketing page. Route only each operational
// subdomain's root to its intended front door; deeper paths remain available normally.
const SHOP_HOST = process.env.NEXT_PUBLIC_SHOP_HOST ?? "shop.gutguard.ph";
const PARTNERS_HOST = process.env.NEXT_PUBLIC_PARTNERS_HOST ?? "partners.gutguard.ph";

// Baseline hardening for every response. ponytail: no script-src CSP yet - the site relies on
// inline scripts, so a real CSP needs nonces (proxy.ts) and a report-only rollout first.
// These directives block clickjacking, <base>/<object> injection and cross-site form posts
// without touching what the pages load.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'; form-action 'self'" },
];

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    return [
      {
        source: "/",
        has: [{ type: "host", value: SHOP_HOST }],
        destination: "/shop",
        // Temporary: the shop host's front door may change while things settle, and a
        // permanent redirect would be cached in customers' browsers for a long time.
        permanent: false,
      },
      {
        // The orders admin is now a tab in the wheel admin. Bookmarks still land somewhere.
        source: "/admin/orders",
        destination: "/admin/wheel",
        permanent: false,
      },
      {
        source: "/",
        has: [{ type: "host", value: PARTNERS_HOST }],
        destination: "/physicians/register",
        // Keep this temporary while the domain architecture is settling so a future
        // partner front-door change is not pinned in browsers or intermediary caches.
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
