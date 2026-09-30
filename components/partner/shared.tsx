"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import type { PartnerDashboard, PartnerOrder } from "@/lib/api";
import { partnerLinkKey } from "@/lib/referral";

const SHOP_ORIGIN = (process.env.NEXT_PUBLIC_SHOP_URL ?? "https://shop.gutguard.ph").replace(/\/$/, "");
const PUBLIC_SITE_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://partners.gutguard.ph").replace(/\/$/, "");
const PUBLIC_MARKETING_ORIGIN = (process.env.NEXT_PUBLIC_MARKETING_URL ?? "https://www.gutguard.ph").replace(/\/$/, "");

export type PartnerQrMode = "shop" | "referral" | "profile";

/** Group target that one E-Points cycle counts towards. */
export const CYCLE_TARGET = 1500;

export const peso = (value: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(value);

export function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export function statusLabel(order: PartnerOrder) {
  if (order.payment_status === "refunded") return "Refunded";
  if (order.payment_status === "paid") return order.status === "fulfilled" ? "Delivered" : "Paid";
  if (order.status === "cancelled") return "Cancelled";
  return "Awaiting payment";
}

export function orderAddress(order: PartnerOrder) {
  return [order.address, order.barangay, order.city, order.province, order.zip]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
}

/** Mirrors getDoctorQrUrl in the admin, so printed codes match across views. */
export function getPartnerQrLink(partner: { id: string; routing_slug: string }, mode: PartnerQrMode) {
  if (!partner.id) {
    if (mode === "shop") return SHOP_ORIGIN;
    return `${PUBLIC_SITE_ORIGIN}/physicians/register`;
  }
  const key = partnerLinkKey(partner.id);
  if (mode === "profile") return `${PUBLIC_SITE_ORIGIN}/dr/${key}`;
  if (mode === "referral") {
    if (partner.routing_slug) return `${PUBLIC_MARKETING_ORIGIN}/${partner.routing_slug.toUpperCase()}`;
    return `${PUBLIC_SITE_ORIGIN}/physicians/register?ref=${key}`;
  }
  if (partner.routing_slug === "dr-grace-saraza") return `${SHOP_ORIGIN}/beehive`;
  return `${SHOP_ORIGIN}/r/${key}`;
}

type PartnerContextValue = { dashboard: PartnerDashboard; signOut: () => void };
const PartnerContext = createContext<PartnerContextValue | null>(null);
export const PartnerProvider = PartnerContext.Provider;

export function usePartner() {
  const value = useContext(PartnerContext);
  if (!value) throw new Error("usePartner must be used inside the partner shell");
  return value;
}

/** Copies text and flips `copied` for two seconds. Returns false when the clipboard is blocked. */
export function useCopy() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2000);
      return true;
    } catch {
      // Clipboard is blocked on insecure origins and in some in-app browsers.
      setCopied(false);
      return false;
    }
  }
  return { copied, copy };
}

export function PageHeader({ kicker, title, lede }: { kicker: string; title: string; lede?: string }) {
  return (
    <header className="pp-page-head">
      <p className="shop-kicker">{kicker}</p>
      <h1>{title}</h1>
      {lede ? <p className="pp-lede">{lede}</p> : null}
    </header>
  );
}

export function StatTile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <article className="pp-stat">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

export function StatusBadge({ order }: { order: PartnerOrder }) {
  return <span className={order.payment_status === "paid" ? "partner-badge paid" : "partner-badge"}>{statusLabel(order)}</span>;
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="partner-empty-orders">
      <strong>{title}</strong>
      {children ? <p>{children}</p> : null}
    </div>
  );
}

export function Loading({ children }: { children: React.ReactNode }) {
  return (
    <div className="partner-orders-loading" aria-live="polite">
      <LoaderCircle className="partner-spinner" aria-hidden="true" /> {children}
    </div>
  );
}

export function Pagination({
  label, offset, pageSize, total, shown, busy, noun, onOffset, onPageSize,
}: {
  label: string; offset: number; pageSize: number; total: number; shown: number; busy?: boolean; noun: string;
  onOffset: (offset: number) => void; onPageSize: (size: number) => void;
}) {
  return (
    <div className="partner-pagination" aria-label={label}>
      <label className="partner-pagination-size">Rows
        <select value={pageSize} onChange={(event) => onPageSize(Number(event.target.value))}>
          <option value="10">10</option><option value="25">25</option><option value="50">50</option>
        </select>
      </label>
      <button type="button" className="shop-secondary" disabled={busy || offset === 0} onClick={() => onOffset(Math.max(0, offset - pageSize))}>Previous</button>
      <span>{total ? `${offset + 1}–${Math.min(offset + shown, total)} of ${total}` : `0 ${noun}`}</span>
      <button type="button" className="shop-secondary" disabled={busy || offset + shown >= total} onClick={() => onOffset(offset + pageSize)}>Next</button>
    </div>
  );
}
