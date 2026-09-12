"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/GutguardSite";

/**
 * The marketing masthead for pages that live outside GutguardSite's client router.
 *
 * Reuses the `shop-site-*` classes Shoplet already styles, so this adds no CSS. Shoplet
 * keeps its own copy on purpose - its nav carries the basket and drawer state, and
 * folding that in here would couple the shop's checkout to a marketing component.
 */

const LINKS: Array<[label: string, href: string]> = [
  ["Why GutGuard", "/#why-now"],
  ["How It Works", "/system"],
  ["Science", "/science"],
  ["Stories", "/testimonials"],
  ["Shop", "/shop"],
  ["For Physicians", "/physicians"],
];

export default function SiteNav({ current }: { current?: string }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header className="shop-site-header">
        <nav className="shop-site-nav-inner" aria-label="Primary">
          <Link className="shop-site-brand" href="/" aria-label="GutGuard home">
            <Logo h={29} />
          </Link>
          <div className="shop-site-links">
            {LINKS.map(([label, href]) => (
              <Link key={href} href={href} aria-current={href === current ? "page" : undefined}>
                {label}
              </Link>
            ))}
          </div>
          <div className="shop-site-actions">
            <Link className="shop-site-login" href="/partner">
              Log in
            </Link>
          </div>
          <button
            className="shop-site-menu-button"
            type="button"
            aria-label="Open menu"
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            aria-controls="site-mobile-menu"
            onClick={() => setMenuOpen(true)}
          >
            <Menu size={20} />
          </button>
        </nav>
      </header>

      <div
        id="site-mobile-menu"
        className={"shop-site-menu" + (menuOpen ? " open" : "")}
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
      >
        <button
          className="shop-site-menu-close"
          type="button"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        >
          <X size={22} />
        </button>
        {LINKS.map(([label, href]) => (
          <Link
            key={href}
            href={href}
            aria-current={href === current ? "page" : undefined}
            onClick={() => setMenuOpen(false)}
          >
            {label}
          </Link>
        ))}
        <Link className="shop-site-menu-login" href="/partner" onClick={() => setMenuOpen(false)}>
          Log in
        </Link>
      </div>
    </>
  );
}
