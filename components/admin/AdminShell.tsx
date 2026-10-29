"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ExternalLink,
  Gift,
  LayoutGrid,
  ListOrdered,
  LoaderCircle,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  MessageSquareQuote,
  Package,
  QrCode,
  Send,
  ShoppingBag,
  Stethoscope,
  Store,
  Tag,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import AdminLogin from "@/components/admin/AdminLogin";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/admin/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/admin/ui/sheet";
import { adminLogout, checkAdminSession, type AdminSessionInfo } from "@/lib/api";
import { isSandboxShop } from "@/lib/supabase";
import { cn } from "@/lib/utils";

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

type NavItem = { href: string; label: string; icon: LucideIcon };
type NavGroup = { title: string | null; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  { title: null, items: [{ href: "/admin", label: "Dashboard", icon: LayoutGrid }] },
  {
    title: "Commerce",
    items: [
      { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
      { href: "/admin/products", label: "Products", icon: Package },
      { href: "/admin/promos", label: "Promotions", icon: Tag },
      { href: "/admin/referred-shops", label: "Referred clinics", icon: Store },
    ],
  },
  {
    title: "Partners",
    items: [
      { href: "/admin/doctors", label: "Doctor partners", icon: Stethoscope },
      { href: "/admin/codes", label: "Partner codes", icon: QrCode },
      { href: "/admin/withdrawals", label: "Withdrawals", icon: Wallet },
      { href: "/admin/referral-email", label: "Referral email", icon: Mail },
    ],
  },
  {
    title: "Marketing",
    items: [
      { href: "/admin/wheel", label: "Wheel prizes", icon: Gift },
      { href: "/admin/newsletter", label: "Newsletter", icon: Send },
      { href: "/admin/sms", label: "SMS blast", icon: MessageSquare },
      { href: "/admin/sequence", label: "Email sequence", icon: ListOrdered },
    ],
  },
  {
    title: "Content",
    items: [{ href: "/admin/testimonials", label: "Testimonials", icon: MessageSquareQuote }],
  },
];

const navItemClass =
  "flex h-8 items-center gap-2.5 rounded-lg border border-transparent px-2.5 text-sm text-muted-foreground hover:bg-black/[0.03] hover:text-foreground";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [access, setAccess] = useState<AdminSessionInfo | null>(null);
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

  const handleSignedIn = async () => {
    await checkAuth();
    router.refresh();
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
  const currentLabel = NAV_GROUPS.flatMap((group) => group.items).find((item) => isActive(item.href))?.label ?? "Dashboard";

  if (isChecking) {
    return (
      <div className="grid min-h-dvh place-items-center bg-chrome font-sans text-muted-foreground">
        <LoaderCircle className="size-5 animate-spin" strokeWidth={1.5} aria-hidden="true" />
        <span className="sr-only">Checking your session</span>
      </div>
    );
  }

  if (!access) return <AdminLogin onSignedIn={handleSignedIn} />;

  const displayName = access.owner ? "Owner" : access.name;
  const sidebar = (
    <>
      <div className="flex h-14 shrink-0 items-center border-b border-border px-4">
        <Link href="/admin" className="flex items-center gap-2">
          <Image src="/gutguard-logo.png" alt="" width={18} height={22} priority />
          <span className="text-[15px] font-medium tracking-[-0.01em] text-foreground">GutGuard</span>
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto p-4 [scrollbar-width:thin]" aria-label="Admin">
        {navGroups.map((group) => (
          <div key={group.title ?? "home"} className="flex flex-col gap-1">
            {group.title && (
              <p className="px-2.5 pb-1 text-[11px] uppercase tracking-[0.08em] text-subtle-foreground">{group.title}</p>
            )}
            {group.items.map(({ href, label, icon: Icon }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(navItemClass, active && "border-border bg-background text-foreground shadow-lift hover:bg-background")}
                >
                  <Icon className="size-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                  {label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="flex flex-col gap-3 border-t border-border p-4">
        <a href="/shop" target="_blank" rel="noopener noreferrer" className={navItemClass}>
          <ExternalLink className="size-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
          Live shop
        </a>
        <div className="flex items-center gap-2.5 pl-2.5">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-[11px] uppercase text-muted-foreground">
            {displayName.slice(0, 2)}
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[13px] text-foreground">{displayName}</p>
            <p className="text-xs text-muted-foreground">
              {access.owner ? "All sections" : `${access.modules.length} section${access.modules.length === 1 ? "" : "s"}`}
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={handleLogout} aria-label="Sign out" title="Sign out" className="text-muted-foreground">
            <LogOut strokeWidth={1.5} />
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-dvh bg-background font-sans text-foreground antialiased">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-chrome md:flex">{sidebar}</aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-chrome px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon-sm" className="-ml-1.5 md:hidden" aria-label="Open menu">
                  <Menu strokeWidth={1.5} />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" showCloseButton={false} className="w-60 gap-0 bg-chrome p-0 font-sans sm:max-w-60">
                <SheetTitle className="sr-only">Admin menu</SheetTitle>
                {sidebar}
              </SheetContent>
            </Sheet>
            <h1 className="m-0 max-w-none font-sans text-base font-medium leading-6 tracking-normal text-foreground">{currentLabel}</h1>
          </div>
          {isSandboxShop && (
            <span className="inline-flex h-[22px] items-center rounded border border-border bg-background px-1.5 text-xs text-foreground">
              Sandbox
            </span>
          )}
        </header>

        {/* admin-crm-main stays: un-restyled pages still size themselves with ".admin-crm-main …" rules. */}
        <main className="admin-crm-main min-w-0 flex-1 overflow-y-auto bg-background">
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
