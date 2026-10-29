"use client";

import { useEffect, useState } from "react";
import { CreditCard, MessageSquareQuote, Package, ShoppingBag, Stethoscope, Truck, Wallet } from "lucide-react";
import { useAdminAccess } from "@/components/admin/AdminShell";
import { EmptyState, LinkList, LinkRow, MetricCell, MetricStrip, PageBody, Section, SkeletonRows } from "@/components/admin/blocks";

// Sections the dashboard reads from. A staff login only loads (and sees) the ones it can open.
const MODULES = ["doctors", "referred-shops", "orders", "products", "promos", "testimonials", "withdrawals"] as const;
type Module = (typeof MODULES)[number];

type Row = Record<string, unknown>;
type Lists = Partial<Record<Module, Row[] | null>>;

const RESPONSE_KEY: Record<Module, string> = {
  doctors: "doctors",
  "referred-shops": "shops",
  orders: "orders",
  products: "products",
  promos: "promos",
  testimonials: "stories",
  withdrawals: "withdrawals",
};
const API_PATH: Record<Module, string> = {
  doctors: "/api/admin/doctors",
  "referred-shops": "/api/admin/referred-shops",
  orders: "/api/admin/shop-orders",
  products: "/api/admin/products",
  promos: "/api/admin/promos",
  testimonials: "/api/admin/testimonials",
  withdrawals: "/api/admin/withdrawals",
};

async function loadList(module: Module): Promise<Row[] | null> {
  try {
    const res = await fetch(API_PATH[module]);
    if (!res.ok) return null;
    const data = await res.json();
    const list = data?.[RESPONSE_KEY[module]];
    return Array.isArray(list) ? list : null;
  } catch {
    return null;
  }
}

const count = (list: Row[] | null | undefined, match?: (row: Row) => boolean) =>
  list ? (match ? list.filter(match).length : list.length) : null;

export default function AdminOverviewPage() {
  const { can } = useAdminAccess();
  // A string so the effect only re-runs when the login's sections actually change.
  const allowedKey = MODULES.filter(can).join(",");
  const [lists, setLists] = useState<Lists | null>(null);

  useEffect(() => {
    let active = true;
    const allowed = (allowedKey ? allowedKey.split(",") : []) as Module[];
    Promise.all(allowed.map(async (module) => [module, await loadList(module)] as const)).then((entries) => {
      if (active) setLists(Object.fromEntries(entries));
    });
    return () => {
      active = false;
    };
  }, [allowedKey]);

  const loading = lists === null;
  const show = (value: number | null) => (value === null ? "—" : value.toLocaleString("en-PH"));

  const orders = lists?.orders;
  const stories = lists?.testimonials;
  const attention = [
    { module: "orders", href: "/admin/orders", icon: CreditCard, label: "Payments to review", n: count(orders, (o) => o.status === "payment_review") },
    { module: "orders", href: "/admin/orders", icon: Truck, label: "Orders to ship", n: count(orders, (o) => o.status === "paid" || o.status === "confirmed") },
    { module: "withdrawals", href: "/admin/withdrawals", icon: Wallet, label: "Withdrawal requests", n: count(lists?.withdrawals, (w) => w.status === "pending") },
    { module: "testimonials", href: "/admin/testimonials", icon: MessageSquareQuote, label: "Stories to review", n: count(stories, (s) => s.status === "pending") },
  ].filter((row) => can(row.module) && row.n);

  return (
    <>
      <MetricStrip>
        {can("doctors") && (
          <MetricCell
            label="Doctor partners"
            icon={Stethoscope}
            href="/admin/doctors"
            loading={loading}
            value={show(count(lists?.doctors))}
            footer={["Joined by referral", show(count(lists?.["referred-shops"], (s) => Boolean(s.referrerId)))]}
          />
        )}
        {can("orders") && (
          <MetricCell
            label="Orders"
            icon={ShoppingBag}
            href="/admin/orders"
            loading={loading}
            value={show(count(orders))}
            footer={["Paid", show(count(orders, (o) => o.payment_status === "paid"))]}
          />
        )}
        {can("products") && (
          <MetricCell
            label="Products"
            icon={Package}
            href="/admin/products"
            loading={loading}
            value={show(count(lists?.products))}
            footer={["Promotions", show(count(lists?.promos))]}
          />
        )}
        {can("testimonials") && (
          <MetricCell
            label="Stories to review"
            icon={MessageSquareQuote}
            href="/admin/testimonials"
            loading={loading}
            value={show(count(stories, (s) => s.status === "pending"))}
            footer={["Approved", show(count(stories, (s) => s.status === "approved"))]}
          />
        )}
      </MetricStrip>

      <PageBody>
        <Section title="Needs attention" count={loading ? undefined : attention.length}>
          {loading ? (
            <SkeletonRows />
          ) : attention.length ? (
            <LinkList>
              {attention.map((row) => (
                <LinkRow key={row.label} href={row.href} icon={row.icon} label={row.label} count={show(row.n)} />
              ))}
            </LinkList>
          ) : (
            <EmptyState>Nothing needs attention.</EmptyState>
          )}
        </Section>
      </PageBody>
    </>
  );
}
