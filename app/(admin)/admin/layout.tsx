import type { Viewport } from "next";
import { Suspense } from "react";
import { Fraunces, Inter } from "next/font/google";
import AdminShell from "@/components/admin/AdminShell";
// Tailwind + shadcn theme, with the site's globals.css layered underneath for the admin pages
// that haven't been restyled yet (see the header of styles/admin.css).
import "@/styles/admin.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

// ponytail: only the un-restyled pages still use the serif; drop with the legacy import.
const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  display: "swap",
});

export const metadata = {
  title: "Admin Operations CRM | GutGuard",
  description: "Operations, partner management, and commerce console for GutGuard.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0608A9",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body>
        <Suspense fallback={null}>
          <AdminShell>{children}</AdminShell>
        </Suspense>
      </body>
    </html>
  );
}
