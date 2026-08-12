import type { MetadataRoute } from "next";

const marketingUrl = (process.env.NEXT_PUBLIC_MARKETING_URL ?? "https://gutguard.ph").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/", "/partner", "/shop/order/"],
    },
    sitemap: `${marketingUrl}/sitemap.xml`,
    host: marketingUrl,
  };
}
