import type { NextConfig } from "next";

// One Vercel project serves two hosts:
//   shop.gutguard.ph     - the shop and Maya checkout
//   partners.gutguard.ph - registration, partner area, /dr/<slug> QR links
// The app's own "/" is the registration page, which is the right front door for
// partners but the wrong one for shoppers, so the shop host redirects it to /shop.
const SHOP_HOST = process.env.NEXT_PUBLIC_SHOP_HOST ?? "shop.gutguard.ph";

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
    ];
  },
};

export default nextConfig;
