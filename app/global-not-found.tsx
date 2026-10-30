import type { Metadata } from "next";
import Link from "next/link";
import "@/styles/globals.css";

// The site and the admin each have their own root layout, so a URL that matches no route
// has no layout to render in. Next serves this whole document instead.
export const metadata: Metadata = {
  title: "Page not found | Gutguard",
  robots: { index: false, follow: false },
};

export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body>
        <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 24, lineHeight: 1.3, maxWidth: "none", margin: 0 }}>404 | This page could not be found.</h1>
          <Link href="/" style={{ textDecoration: "underline" }}>Go to the homepage</Link>
        </main>
      </body>
    </html>
  );
}
