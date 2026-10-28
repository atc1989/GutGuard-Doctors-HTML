import type { Viewport } from "next";
import { Suspense } from "react";
import { Fraunces } from "next/font/google";
import AdminShell from "@/components/admin/AdminShell";
// ponytail: the admin is its own root layout (no site chrome) but still borrows the site's
// stylesheet until the Tailwind restyle replaces it page by page. Drop this import last.
import "@/styles/globals.css";

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
    <html lang="en" className={fraunces.variable}>
      <body>
        <Suspense fallback={null}>
          <AdminShell>{children}</AdminShell>
        </Suspense>
      </body>
    </html>
  );
}
