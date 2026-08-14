import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://gutguard.ph"),
  title: {
    default: "Gutguard | The Measured 90-Day Protocol for Healthy Aging",
    template: "%s | Gutguard",
  },
  description:
    "The measured 90-day protocol for gut health, inflammation, and healthy aging. " +
    "SynBIOTIC+ plus BioScan blood tracking at Day 30, 60, and 90. " +
    "FDA-registered. 19 branches nationwide.",
  openGraph: {
    title: "Gutguard | The Measured 90-Day Protocol for Healthy Aging",
    description:
      "The measured 90-day protocol for gut health, inflammation, and healthy aging. " +
      "SynBIOTIC+ plus BioScan blood tracking at Day 30, 60, and 90.",
    url: "https://gutguard.ph",
    siteName: "Gutguard",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Gutguard | The Measured 90-Day Protocol for Healthy Aging",
    description:
      "The measured 90-day protocol for gut health, inflammation, and healthy aging. " +
      "Tracked at Day 30, 60, and 90.",
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
