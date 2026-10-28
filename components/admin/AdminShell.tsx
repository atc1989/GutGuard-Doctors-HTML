"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronRight,
  ExternalLink,
  Gift,
  LayoutDashboard,
  ListOrdered,
  LoaderCircle,
  Lock,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  Package,
  QrCode,
  Send,
  ShieldCheck,
  ShoppingBag,
  Star,
  Store,
  Tag,
  Users,
  Wallet,
  X,
} from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { adminLogin, adminLogout, checkAdminSession, type AdminSessionInfo } from "@/lib/api";

// Module = the nav slug after /admin/ (the server checks the same keys). The dashboard is open to all.
const moduleOf = (path: string) => path.split("/")[2] || null;

const AdminAccessContext = createContext<AdminSessionInfo | null>(null);

/** What the logged-in admin may open. The API routes enforce this; the UI only hides what would fail. */
export function useAdminAccess() {
  const access = useContext(AdminAccessContext);
  return {
    owner: Boolean(access?.owner),
    can: (slug: string) => Boolean(access && (access.owner || access.modules.includes(slug))),
  };
}

type NavItem = {
  href: string;
  label: string;
  badge?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Overview",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    title: "Commerce & Sales",
    items: [
      { href: "/admin/orders", label: "Shop Orders", icon: Package },
      { href: "/admin/products", label: "Product Catalog", icon: ShoppingBag },
      { href: "/admin/promos", label: "Promotions", icon: Tag },
      { href: "/admin/referred-shops", label: "Referred Clinics", icon: Store },
    ],
  },
  {
    title: "Partner Network",
    items: [
      { href: "/admin/doctors", label: "Doctor Partners", icon: Users },
      { href: "/admin/codes", label: "Partner Codes", icon: QrCode },
      { href: "/admin/withdrawals", label: "Withdrawals", icon: Wallet },
      { href: "/admin/referral-email", label: "Referral Email", icon: Mail },
    ],
  },
  {
    title: "Marketing & Automation",
    items: [
      { href: "/admin/wheel", label: "Wheel Prizes", icon: Gift },
      { href: "/admin/newsletter", label: "Newsletter", icon: Send },
      { href: "/admin/sms", label: "SMS Blast", icon: MessageSquare },
      { href: "/admin/sequence", label: "Email Sequence", icon: ListOrdered },
    ],
  },
  {
    title: "Content & Moderation",
    items: [
      { href: "/admin/testimonials", label: "Testimonials", icon: Star },
    ],
  },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [access, setAccess] = useState<AdminSessionInfo | null>(null);
  const isAuthenticated = Boolean(access);
  const [password, setPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const checkAuth = useCallback(async () => {
    try {
      setAccess(await checkAdminSession());
    } catch {
      setAccess(null);
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setLoggingIn(true);
    setError(null);
    try {
      await adminLogin(password);
      setPassword("");
      await checkAuth();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed. Check your password.");
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await adminLogout();
    } finally {
      setAccess(null);
      router.push("/admin");
      router.refresh();
    }
  };

  const canOpen = (href: string) => {
    const slug = moduleOf(href);
    return !slug || Boolean(access?.owner || access?.modules.includes(slug));
  };
  const navGroups = NAV_GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => canOpen(item.href)) })).filter(
    (group) => group.items.length > 0,
  );

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  // Find active group and item for breadcrumbs
  let currentGroup = "Operations";
  let currentItem = "Dashboard";
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (isActive(item.href)) {
        currentGroup = group.title;
        currentItem = item.label;
        break;
      }
    }
  }

  if (isChecking) {
    return (
      <div className="admin-crm-loading-shell">
        <LoaderCircle size={36} className="admin-crm-spinner" />
        <p>Verifying admin session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="admin-crm-login-wrap">
        <div className="admin-crm-login-card">
          <div className="admin-crm-login-header">
            <div className="admin-crm-login-brand">
              <Image src="/gutguard-logo.png" alt="GutGuard" width={34} height={42} priority />
            </div>
            <p className="admin-crm-login-kicker">GutGuard Philippines</p>
            <h1>Operations CRM</h1>
            <p className="admin-crm-login-sub">Enter administrator password to access the operational controls.</p>
          </div>

          <form onSubmit={handleLogin} className="admin-crm-login-form">
            {error && <div className="admin-crm-login-error" role="alert">{error}</div>}

            <div className="admin-crm-field">
              <label htmlFor="admin-password">Administrator Password</label>
              <div className="admin-crm-input-wrap">
                <Lock size={17} className="admin-crm-field-icon" />
                <input
                  id="admin-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loggingIn}
                  autoFocus
                  required
                />
              </div>
            </div>

            <button type="submit" className="admin-crm-primary-btn" disabled={loggingIn || !password.trim()}>
              {loggingIn ? (
                <>
                  <LoaderCircle size={18} className="admin-crm-spinner" />
                  <span>Unlocking Console...</span>
                </>
              ) : (
                <>
                  <span>Unlock CRM Console</span>
                  <ChevronRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="admin-crm-login-footer">
            <ShieldCheck size={15} />
            <span>Encrypted admin token &bull; 8-hour auto rotation &bull; IP rate guarded</span>
          </div>
        </div>
      </div>
    );
  }

  const renderNavContent = () => (
    <>
      <div className="admin-crm-brand-block">
        <Link href="/admin" className="admin-crm-brand-link">
          <div className="admin-crm-logo-box">
            <Image src="/gutguard-logo.png" alt="GutGuard" width={28} height={34} priority />
          </div>
          <div className="admin-crm-brand-meta">
            <strong>GutGuard</strong>
            <span>Operations CRM</span>
          </div>
        </Link>
        <span className="admin-crm-badge-ops">ADMIN</span>
      </div>

      <nav className="admin-crm-nav" aria-label="CRM Navigation">
        {navGroups.map((group) => (
          <div key={group.title} className="admin-crm-nav-group">
            <div className="admin-crm-group-header">{group.title}</div>
            <ul className="admin-crm-group-list">
              {group.items.map(({ href, label, icon: Icon, badge }) => {
                const active = isActive(href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      className={`admin-crm-nav-link ${active ? "active" : ""}`}
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon size={18} className="admin-crm-nav-icon" />
                      <span className="admin-crm-nav-label">{label}</span>
                      {badge && <span className="admin-crm-nav-badge">{badge}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="admin-crm-sidebar-footer">
        <div className="admin-crm-session-pill">
          <span className="admin-crm-pulse-dot" />
          <span>{access?.owner ? "Session Active" : `Signed in as ${access?.name}`}</span>
        </div>

        <div className="admin-crm-footer-links">
          <a
            href="/shop"
            target="_blank"
            rel="noopener noreferrer"
            className="admin-crm-footer-link"
            title="Open customer storefront in new tab"
          >
            <ExternalLink size={15} />
            <span>View Live Shop</span>
          </a>

          <button
            type="button"
            onClick={handleLogout}
            className="admin-crm-footer-link admin-crm-logout-btn"
            title="End admin session"
          >
            <LogOut size={15} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="admin-crm-app">
      {/* Top Header */}
      <header className="admin-crm-topbar">
        <div className="admin-crm-topbar-left">
          <button
            type="button"
            className="admin-crm-menu-toggle"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open navigation menu"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div className="admin-crm-breadcrumbs">
            <span className="admin-crm-crumb-root">Admin CRM</span>
            <ChevronRight size={13} className="admin-crm-crumb-sep" />
            <span className="admin-crm-crumb-group">{currentGroup}</span>
            <ChevronRight size={13} className="admin-crm-crumb-sep" />
            <span className="admin-crm-crumb-current">{currentItem}</span>
          </div>
        </div>

        <div className="admin-crm-topbar-right">
          <a
            href="/shop"
            target="_blank"
            rel="noopener noreferrer"
            className="admin-crm-pill-action"
          >
            <ExternalLink size={14} />
            <span className="hide-mobile">Live Shop</span>
          </a>

          <button
            type="button"
            onClick={handleLogout}
            className="admin-crm-pill-action admin-crm-pill-logout"
          >
            <LogOut size={14} />
            <span className="hide-mobile">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Body */}
      <div className="admin-crm-body">
        {/* Desktop Persistent Sidebar */}
        <aside className="admin-crm-sidebar" aria-label="Desktop CRM navigation">
          {renderNavContent()}
        </aside>

        {/* Mobile Sidebar Overlay Drawer */}
        {mobileMenuOpen && (
          <div className="admin-crm-drawer-backdrop" onClick={() => setMobileMenuOpen(false)}>
            <aside
              className="admin-crm-sidebar-drawer"
              onClick={(e) => e.stopPropagation()}
              aria-label="Mobile CRM navigation"
            >
              {renderNavContent()}
            </aside>
          </div>
        )}

        {/* Main Routed Content Area */}
        <main className="admin-crm-main">
          <AdminAccessContext.Provider value={access}>
            {canOpen(pathname) ? (
              children
            ) : (
              <AdminPageHeader
                kicker="No access"
                title="This section isn't on your login"
                description="Ask the owner to add it to your access."
              />
            )}
          </AdminAccessContext.Provider>
        </main>
      </div>
    </div>
  );
}
