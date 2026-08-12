import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";

const marketingUrl = process.env.NEXT_PUBLIC_MARKETING_URL ?? "https://gutguard.ph";

export const metadata: Metadata = {
  metadataBase: new URL(marketingUrl),
  title: {
    default: "GutGuard | Measure your inflammation. Change your trajectory.",
    template: "%s | GutGuard",
  },
  description: "The measured 90-day protocol for gut health, inflammation and healthy aging.",
  openGraph: {
    type: "website",
    siteName: "GutGuard",
    title: "GutGuard | Measure your inflammation. Change your trajectory.",
    description: "The measured 90-day protocol for gut health, inflammation and healthy aging.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0608A9",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
