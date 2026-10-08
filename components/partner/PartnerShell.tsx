"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, ChevronDown, Coins, Copy, LayoutDashboard, LogOut, Package, QrCode, Users } from "lucide-react";
import { Logo } from "@/components/GutguardSite";
import { getPartnerQrLink, useCopy, usePartner } from "./shared";

const LIFESTYLE_NAV = [
  { href: "/partner", label: "Overview", short: "Overview", icon: LayoutDashboard },
  { href: "/partner/orders", label: "Orders", short: "Orders", icon: Package },
  { href: "/partner/partners", label: "Referred partners", short: "Partners", icon: Users },
  { href: "/partner/e-points", label: "E-Points", short: "E-Points", icon: Coins },
  { href: "/partner/share", label: "Share & QR", short: "Share", icon: QrCode },
] as const;

const MAIN_STORE_NAV = [
  { href: "/partner", label: "Overview", short: "Overview", icon: LayoutDashboard },
  { href: "/partner/reports", label: "Reports & Stores", short: "Reports", icon: Package },
  { href: "/partner/e-points", label: "Combined E-Points", short: "E-Points", icon: Coins },
  { href: "/partner/share", label: "Share & QR", short: "Share", icon: QrCode },
] as const;

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "P";
}

export default function PartnerShell({ children }: { children: React.ReactNode }) {
  const { dashboard, signOut } = usePartner();
  const pathname = usePathname();
  const { copied, copy } = useCopy();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const shopLink = getPartnerQrLink(dashboard.partner, "shop");

  const isMainStore = dashboard.partner.store_type === "main";
  const navItems = isMainStore ? MAIN_STORE_NAV : LIFESTYLE_NAV;

  const badges: Record<string, string> = {
    "/partner/orders": String(dashboard.totals.orders),
    "/partner/partners": String(dashboard.totals.referred_partners),
    "/partner/e-points": String(dashboard.points.lifetime_points),
  };

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onPointer); document.removeEventListener("keydown", onKey); };
  }, [menuOpen]);

  const isActive = (href: string) => (href === "/partner" ? pathname === "/partner" : pathname.startsWith(href));

  return (
    <div className="pp-app">
      <header className="pp-topbar">
        <Link className="pp-brand" href="/" aria-label="GutGuard home"><Logo h={26} /></Link>
        <span className="pp-portal-name">Partner Portal</span>
        <div className="pp-topbar-spacer" />
        <button type="button" className="pp-copy-btn" onClick={() => copy(shopLink)} aria-label="Copy shop link">
          {copied ? <Check aria-hidden="true" size={16} /> : <Copy aria-hidden="true" size={16} />}
          <span>{copied ? "Copied" : "Copy shop link"}</span>
        </button>
        <div className="pp-user" ref={menuRef}>
          <button type="button" className="pp-user-btn" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
            <span className="pp-avatar" aria-hidden="true">{initials(dashboard.partner.full_name)}</span>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", textAlign: "left" }}>
              <span className="pp-user-name">{dashboard.partner.full_name}</span>
              <span style={{
                fontSize: "10px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                color: isMainStore ? "var(--gold-text, var(--gold))" : dashboard.partner.store_type === "affiliate" ? "#047857" : "var(--blue)",
              }}>
                {isMainStore ? "Main Store" : dashboard.partner.store_type === "affiliate" ? "Affiliate" : "Lifestyle"}
              </span>
            </div>
            <ChevronDown aria-hidden="true" size={16} />
          </button>
          {menuOpen ? (
            <div className="pp-menu" role="menu">
              <p className="pp-menu-name">{dashboard.partner.full_name}</p>
              <button type="button" role="menuitem" onClick={signOut}><LogOut aria-hidden="true" size={16} /> Sign out</button>
            </div>
          ) : null}
        </div>
      </header>

      <div className="pp-body">
        <aside className="pp-side" aria-label="Partner navigation">
          <nav>
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className={isActive(href) ? "pp-nav active" : "pp-nav"} aria-current={isActive(href) ? "page" : undefined}>
                <Icon aria-hidden="true" size={18} />
                <span>{label}</span>
                {badges[href] ? <em>{badges[href]}</em> : null}
              </Link>
            ))}
          </nav>
          <div className="pp-side-card">
            <p className="shop-kicker">{isMainStore ? "Main shop link" : "Your shop link"}</p>
            <p className="pp-side-link">{shopLink.replace(/^https?:\/\//, "")}</p>
            <button type="button" className="shop-secondary" onClick={() => copy(shopLink)}>{copied ? "Copied" : "Copy link"}</button>
            <small>{dashboard.clicks.last_30_days} clicks in the last 30 days</small>
          </div>
        </aside>

        <main className="pp-main">{children}</main>
      </div>

      <nav className="pp-bottom" aria-label="Partner navigation">
        {navItems.map(({ href, short, icon: Icon }) => (
          <Link key={href} href={href} className={isActive(href) ? "active" : undefined} aria-current={isActive(href) ? "page" : undefined}>
            <Icon aria-hidden="true" size={20} />
            <span>{short}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
