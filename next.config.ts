import type { NextConfig } from "next";

// One Vercel project serves the public website and two operational hosts:
//   gutguard.ph          - marketing pages
//   shop.gutguard.ph     - the shop and Maya checkout
//   partners.gutguard.ph - registration, partner area, /dr/<slug> QR links
// The app's own "/" is now the consumer marketing page. Route only each operational
// subdomain's root to its intended front door; deeper paths remain available normally.
const SHOP_HOST = process.env.NEXT_PUBLIC_SHOP_HOST ?? "shop.gutguard.ph";
const PARTNERS_HOST = process.env.NEXT_PUBLIC_PARTNERS_HOST ?? "partners.gutguard.ph";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
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
