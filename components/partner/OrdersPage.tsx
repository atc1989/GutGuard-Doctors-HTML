"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpDown, SlidersHorizontal, X } from "lucide-react";
import { getPartnerDashboard, type PartnerDashboard, type PartnerOrder, type PartnerOrderScope } from "@/lib/api";
import {
  EmptyState, Loading, PageHeader, Pagination, StatusBadge, formatDate, orderAddress, peso, usePartner,
} from "./shared";

const SCOPES: PartnerOrderScope[] = ["all", "direct", "referred"];
const PAGE_SIZES = [10, 25, 50];

type Filters = { scope: PartnerOrderScope; status: string; from: string; to: string; sort: "newest" | "oldest"; size: number; offset: number };

function readFilters(params: URLSearchParams): Filters {
  const scope = params.get("scope") as PartnerOrderScope;
  const size = Number(params.get("size"));
  return {
    scope: SCOPES.includes(scope) ? scope : "all",
    status: params.get("status") ?? "",
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
    sort: params.get("sort") === "oldest" ? "oldest" : "newest",
    size: PAGE_SIZES.includes(size) ? size : 10,
    offset: Math.max(0, Number(params.get("offset")) || 0),
  };
}

export default function OrdersPage() {
  const { dashboard } = usePartner();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = readFilters(new URLSearchParams(searchParams.toString()));
  const { scope, status, from, to, sort, size, offset } = filters;

  const [page, setPage] = useState<Pick<PartnerDashboard, "orders" | "orders_page"> | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<PartnerOrder | null>(null);
  const closeDrawer = () => setSelected(null);

  // Filters live in the URL so back/forward and shared links keep them.
  function update(patch: Partial<Filters>) {
    const next = { ...filters, offset: 0, ...patch };
    const params = new URLSearchParams();
    if (next.scope !== "all") params.set("scope", next.scope);
    if (next.status) params.set("status", next.status);
    if (next.from) params.set("from", next.from);
    if (next.to) params.set("to", next.to);
    if (next.sort !== "newest") params.set("sort", next.sort);
    if (next.size !== 10) params.set("size", String(next.size));
    if (next.offset) params.set("offset", String(next.offset));
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    setError("");
    getPartnerDashboard({ scope, status, dateFrom: from, dateTo: to, sort, limit: size, offset })
      .then((next) => { if (!cancelled) setPage({ orders: next.orders, orders_page: next.orders_page }); })
      .catch(() => { if (!cancelled) setError("Orders could not be loaded. Please try again."); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [scope, status, from, to, sort, size, offset]);

  const orders = page?.orders ?? [];
  const total = page?.orders_page.total ?? 0;
  const activeFilters = [status, from, to, sort === "oldest" ? "x" : ""].filter(Boolean).length;
  const scopeLabels: Array<[PartnerOrderScope, string]> = [
    ["all", "All orders"],
    ["direct", "Direct"],
    ["referred", "Referred"],
  ];

  return (
    <>
      <PageHeader kicker="Your orders" title={page ? (total > 0 ? `${total} attributed` : "No orders yet") : "Orders"} />

      {/* Universal Tab Switcher (Outside Card, No Numbers) */}
      <div className="pp-seg" role="tablist" aria-label="Order attribution" style={{ marginTop: 20, marginBottom: 16 }}>
        {scopeLabels.map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={scope === value}
            className={scope === value ? "active" : ""}
            onClick={() => update({ scope: value })}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Universal Filter Toolbar (Outside Card) */}
      <div className="pp-partner-toolbar">
        <div className="pp-partner-actions">
          <label className="pp-partner-sort">
            <span>Status</span>
            <select
              value={status}
              onChange={(event) => update({ status: event.target.value })}
              aria-label="Filter order status"
            >
              <option value="">All statuses</option>
              <option value="paid">Paid</option>
              <option value="pending">Awaiting payment</option>
              <option value="fulfilled">Delivered</option>
              <option value="cancelled">Cancelled</option>
              <option value="refunded">Refunded</option>
            </select>
          </label>

          <label className="pp-partner-sort">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <ArrowUpDown size={12} aria-hidden="true" />
              <span>Sort</span>
            </span>
            <select
              value={sort}
              onChange={(event) => update({ sort: event.target.value as "newest" | "oldest" })}
              aria-label="Sort orders"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </label>

          <label className="pp-partner-sort">
            <span>From</span>
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(event) => update({ from: event.target.value })}
              className="pp-date-input"
              aria-label="Filter from date"
            />
          </label>

          <label className="pp-partner-sort">
            <span>To</span>
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(event) => update({ to: event.target.value })}
              className="pp-date-input"
              aria-label="Filter to date"
            />
          </label>

          {activeFilters ? (
            <button
              type="button"
              className="shop-secondary pp-tree-quick-btn pp-filter-reset-btn"
              onClick={() => update({ status: "", from: "", to: "", sort: "newest" })}
              aria-label="Clear active filters"
            >
              Reset
            </button>
          ) : null}
        </div>
      </div>

      <section className="pp-card pp-card-flush" aria-label="Orders table">
        {error ? <div className="partner-orders-error" role="alert">{error}</div> : null}

        {busy ? <Loading>Loading orders…</Loading> : orders.length === 0 ? (
          <EmptyState title={scope === "direct" ? "No direct orders yet." : scope === "referred" ? "No referred-partner orders yet." : "No attributed orders yet."}>
            {scope === "referred" ? "Orders generated by partners you referred will appear here." : "Share the matching QR code to get started."}
          </EmptyState>
        ) : (
          <>
            <table className="pp-table">
              <thead>
                <tr>
                  <th scope="col">Buyer</th><th scope="col">Contact</th><th scope="col">Date</th><th scope="col">Source</th>
                  <th scope="col">Status</th><th scope="col" className="numeric">Total</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.order_code} onClick={() => setSelected(order)}>
                    <th scope="row">
                      <div className="pp-buyer">
                        <button type="button" className="pp-link-btn" onClick={(event) => { event.stopPropagation(); setSelected(order); }}>
                          {order.buyer_name || order.buyer_first_name || "A customer"}
                        </button>
                        <span>{order.order_code}</span>
                      </div>
                    </th>
                    <td>
                      <div className="pp-contact">
                      {order.buyer_mobile ? <a href={`tel:${order.buyer_mobile}`} onClick={(event) => event.stopPropagation()}>{order.buyer_mobile}</a> : <span>--</span>}
                      {order.buyer_email ? <a href={`mailto:${order.buyer_email}`} onClick={(event) => event.stopPropagation()}>{order.buyer_email}</a> : null}
                      </div>
                    </td>
                    <td className="nowrap">{formatDate(order.created_at)}</td>
                    <td>{order.source_type === "direct" ? "Your shop link" : `Via ${order.source_partner_name}`}</td>
                    <td><StatusBadge order={order} /></td>
                    <td className="numeric"><b>{peso(order.total_amount)}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="pp-order-cards">
              {orders.map((order) => (
                <li key={order.order_code}>
                  <button type="button" onClick={() => setSelected(order)}>
                    <span className="pp-oc-top">
                      <strong>{order.buyer_name || order.buyer_first_name || "A customer"}</strong>
                      <b>{peso(order.total_amount)}</b>
                    </span>
                    <span className="pp-oc-mid">{order.order_code} · {formatDate(order.created_at)}</span>
                    <span className="pp-oc-bottom">
                      <StatusBadge order={order} />
                      <small>{order.source_type === "direct" ? "Your shop link" : `Via ${order.source_partner_name}`}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <Pagination
          label="Order pages" offset={offset} pageSize={size} total={total} shown={orders.length} busy={busy} noun="orders"
          onOffset={(next) => update({ offset: next })} onPageSize={(next) => update({ size: next })}
        />
      </section>

      {selected ? <OrderDrawer order={selected} onClose={closeDrawer} /> : null}
    </>
  );
}

function OrderDrawer({ order, onClose }: { order: PartnerOrder; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const address = orderAddress(order);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      opener?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="pp-drawer-backdrop" onClick={onClose}>
      <div className="pp-drawer" ref={ref} role="dialog" aria-modal="true" aria-labelledby="pp-drawer-title" tabIndex={-1} onClick={(event) => event.stopPropagation()}>
        <div className="pp-drawer-head">
          <div>
            <p className="shop-kicker">{order.order_code}</p>
            <h2 id="pp-drawer-title">{order.buyer_name || order.buyer_first_name || "A customer"}</h2>
          </div>
          <button type="button" className="pp-sheet-close" aria-label="Close order details" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <dl className="pp-dl">
          <div><dt>Status</dt><dd><StatusBadge order={order} /></dd></div>
          <div><dt>Total</dt><dd><b>{peso(order.total_amount)}</b></dd></div>
          <div><dt>Date</dt><dd>{formatDate(order.created_at)}</dd></div>
          <div><dt>Source</dt><dd>{order.source_type === "direct" ? "Your shop link" : `Via ${order.source_partner_name}`}</dd></div>
          <div><dt>Mobile</dt><dd>{order.buyer_mobile ? <a href={`tel:${order.buyer_mobile}`}>{order.buyer_mobile}</a> : "--"}</dd></div>
          <div><dt>Email</dt><dd>{order.buyer_email ? <a href={`mailto:${order.buyer_email}`}>{order.buyer_email}</a> : "--"}</dd></div>
          <div><dt>Delivery address</dt><dd>{address || "--"}</dd></div>
        </dl>
        <p className="shop-note" style={{ margin: "14px 0 0" }}>Buyer contact details are confidential. Use them only to follow up on this order.</p>
        <div className="pp-sheet-footer" style={{ marginTop: "auto", padding: "16px 0 0", background: "transparent" }}>
          <button type="button" className="shop-secondary pp-sheet-btn-secondary" style={{ width: "100%" }} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
