import type { MetadataRoute } from "next";

const marketingUrl = (process.env.NEXT_PUBLIC_MARKETING_URL ?? "https://gutguard.ph").replace(/\/$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${marketingUrl}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${marketingUrl}/science`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${marketingUrl}/system`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${marketingUrl}/physicians`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${marketingUrl}/physicians/register`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${marketingUrl}/shop`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
  ];
}
