import type { Metadata, Viewport } from "next";
import { Fraunces } from "next/font/google";
import "@/styles/globals.css";

/**
 * The design has always named Fraunces as --serif, but nothing ever loaded it, so every
 * visitor without it installed locally got Times New Roman. The variable cut carries the
 * whole 100-900 range in one file, which matters because the site uses 400 and 600 side
 * by side - a static 400-only load is what made bold headings fall back mid-sentence.
 */
const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  display: "swap",
});

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
    <html lang="en" className={fraunces.variable}>
      <body>{children}</body>
    </html>
  );
}
