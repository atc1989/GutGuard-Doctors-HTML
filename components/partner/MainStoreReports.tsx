"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpDown, Search, X } from "lucide-react";
import { EmptyState, Loading, PageHeader, Pagination, formatDate, peso, usePartner } from "./shared";
import { getMainStoreReports, type MainStoreReports, type MainStoreOrder, type MainStoreChildStore } from "@/lib/api";

type Tab = "stores" | "orders";

export default function MainStoreReportsPage() {
  const { dashboard } = usePartner();
  const [tab, setTab] = useState<Tab>("stores");
  const [loading, setLoading] = useState(true);
  const [reportsData, setReportsData] = useState<MainStoreReports | null>(null);

  const [search, setSearch] = useState("");
  const [storeTypeFilter, setStoreTypeFilter] = useState<string>("");
  const [storeSortBy, setStoreSortBy] = useState<"points" | "orders" | "revenue" | "name">("points");

  const [orderSearch, setOrderSearch] = useState("");
  const [storeFilter, setStoreFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  const [selectedOrder, setSelectedOrder] = useState<MainStoreOrder | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    getMainStoreReports({
      storeId: storeFilter || undefined,
      status: statusFilter || undefined,
      limit: pageSize,
      offset,
    })
      .then((res) => {
        if (!cancelled) {
          setReportsData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load reports:", err);
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [storeFilter, statusFilter, offset, pageSize]);

  const stores = reportsData?.stores ?? [];
  const orders = reportsData?.orders ?? [];
  const totalOrders = reportsData?.total_orders ?? 0;

  const filteredOrders = orders.filter((o) => {
    if (!orderSearch) return true;
    const q = orderSearch.toLowerCase();
    return (
      o.order_code.toLowerCase().includes(q) ||
      (o.buyer_name && o.buyer_name.toLowerCase().includes(q)) ||
      (o.store_name && o.store_name.toLowerCase().includes(q))
    );
  });

  const filteredStores = stores
    .filter((s) => {
      if (storeTypeFilter && s.store_type !== storeTypeFilter) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        s.full_name.toLowerCase().includes(q) ||
        s.routing_slug.toLowerCase().includes(q) ||
        (s.specialty && s.specialty.toLowerCase().includes(q)) ||
        (s.practice_location && s.practice_location.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      if (storeSortBy === "points") return (b.points || 0) - (a.points || 0);
      if (storeSortBy === "orders") return (b.orders_count || 0) - (a.orders_count || 0);
      if (storeSortBy === "revenue") return (b.revenue || 0) - (a.revenue || 0);
      if (storeSortBy === "name") return a.full_name.localeCompare(b.full_name);
      return 0;
    });

  return (
    <div className="pp-screen">
      <PageHeader
        kicker="Aggregated reports"
        title="Main Store Network Reports"
        lede="Inspect all descendant Lifestyle & Affiliate store performances and cross-store order attributions."
      />

      {/* Universal Tab Navigation (Outside Card) */}
      <div className="pp-seg" role="tablist" aria-label="Main Store report tabs" style={{ marginTop: 20, marginBottom: 16 }}>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "stores"}
          className={tab === "stores" ? "active" : ""}
          onClick={() => setTab("stores")}
        >
          Store Directory
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "orders"}
          className={tab === "orders" ? "active" : ""}
          onClick={() => setTab("orders")}
        >
          Network Orders
        </button>
      </div>

      {tab === "stores" ? (
        <>
          {/* Universal External Filter Toolbar matching Referred Partners */}
          <div className="pp-partner-toolbar">
            <div className="pp-partner-search">
              <Search size={16} className="pp-search-icon" aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by doctor name, specialty, or clinic..."
                aria-label="Search descendant stores"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="pp-search-clear"
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              ) : null}
            </div>

            <div className="pp-partner-actions">
              <label className="pp-partner-sort">
                <span>Type:</span>
                <select
                  value={storeTypeFilter}
                  onChange={(e) => setStoreTypeFilter(e.target.value)}
                  aria-label="Filter store type"
                >
                  <option value="">All types</option>
                  <option value="lifestyle">Lifestyle</option>
                  <option value="affiliate">Affiliate</option>
                </select>
              </label>

              <label className="pp-partner-sort">
                <ArrowUpDown size={14} aria-hidden="true" />
                <span>Sort:</span>
                <select
                  value={storeSortBy}
                  onChange={(e) => setStoreSortBy(e.target.value as typeof storeSortBy)}
                  aria-label="Sort descendant stores"
                >
                  <option value="points">Most E-Points</option>
                  <option value="orders">Most Orders</option>
                  <option value="revenue">Highest Sales</option>
                  <option value="name">Alphabetical</option>
                </select>
              </label>

              {(search || storeTypeFilter || storeSortBy !== "points") ? (
                <button
                  type="button"
                  className="shop-secondary pp-tree-quick-btn"
                  onClick={() => {
                    setSearch("");
                    setStoreTypeFilter("");
                    setStoreSortBy("points");
                  }}
                  aria-label="Reset filters"
                >
                  Reset
                </button>
              ) : null}
            </div>
          </div>

          <section className="pp-card pp-card-flush" aria-label="Store Directory">
            {filteredStores.length ? (
              <table className="pp-table">
                <thead>
                  <tr>
                    <th>Store Name</th>
                    <th>Type</th>
                    <th>Specialty & Location</th>
                    <th className="numeric">Orders</th>
                    <th className="numeric">Sales Revenue</th>
                    <th className="numeric">E-Points</th>
                    <th style={{ textAlign: "center" }}>Referral QR</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStores.map((store) => (
                    <tr key={store.id}>
                      <td>
                        <strong>{store.full_name}</strong>
                        <div style={{ fontSize: "12px", color: "var(--ink-3)" }}>/{store.routing_slug}</div>
                      </td>
                      <td>
                        <span className={store.store_type === "lifestyle" ? "pp-tag pp-tag-blue" : "pp-tag pp-tag-bone"}>
                          {store.store_type === "lifestyle" ? "Lifestyle" : "Affiliate"}
                        </span>
                      </td>
                      <td>
                        <div>{store.specialty || "--"}</div>
                        <div style={{ fontSize: "12px", color: "var(--ink-3)" }}>{store.practice_location || "--"}</div>
                      </td>
                      <td className="numeric">{store.orders_count}</td>
                      <td className="numeric" style={{ fontWeight: 600 }}>{peso(store.revenue)}</td>
                      <td className="numeric" style={{ fontWeight: 600 }}>{store.points} pts</td>
                      <td style={{ textAlign: "center" }}>
                        <span className={store.referral_qr_enabled ? "pp-tag pp-tag-blue" : "pp-tag pp-tag-bone"}>
                          {store.referral_qr_enabled ? "Active" : "Locked"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EmptyState title="No descendant stores found.">
                Partner stores registered under your Main Store link will appear here.
              </EmptyState>
            )}
          </section>
        </>
      ) : (
        <>
          {/* Universal External Filter Toolbar with Search on Left and Filters on Right */}
          <div className="pp-partner-toolbar">
            <div className="pp-partner-search">
              <Search size={16} className="pp-search-icon" aria-hidden="true" />
              <input
                type="search"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder="Search by order code, buyer, or store..."
                aria-label="Search network orders"
              />
              {orderSearch ? (
                <button
                  type="button"
                  onClick={() => setOrderSearch("")}
                  className="pp-search-clear"
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              ) : null}
            </div>

            <div className="pp-partner-actions">
              <label className="pp-partner-sort">
                <span>Store:</span>
                <select
                  value={storeFilter}
                  onChange={(e) => {
                    setStoreFilter(e.target.value);
                    setOffset(0);
                  }}
                  aria-label="Filter store"
                >
                  <option value="">All stores</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="pp-partner-sort">
                <span>Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setOffset(0);
                  }}
                  aria-label="Filter status"
                >
                  <option value="">All statuses</option>
                  <option value="paid">Paid</option>
                  <option value="fulfilled">Fulfilled</option>
                  <option value="pending">Pending</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>

              {(orderSearch || storeFilter || statusFilter) ? (
                <button
                  type="button"
                  className="shop-secondary pp-tree-quick-btn"
                  onClick={() => {
                    setOrderSearch("");
                    setStoreFilter("");
                    setStatusFilter("");
                    setOffset(0);
                  }}
                  aria-label="Reset filters"
                >
                  Reset
                </button>
              ) : null}
            </div>
          </div>

          <section className="pp-card pp-card-flush" aria-label="Network Orders">
            {loading ? (
              <Loading>Loading network orders…</Loading>
            ) : filteredOrders.length ? (
              <>
                <table className="pp-table">
                  <thead>
                    <tr>
                      <th>Order Code</th>
                      <th>Attributed Store</th>
                      <th>Buyer</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th className="numeric">Total Amount</th>
                      <th style={{ width: 80, textAlign: "right" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((order) => (
                      <tr
                        key={order.order_code}
                        onClick={() => setSelectedOrder(order)}
                        style={{ cursor: "pointer" }}
                      >
                        <td style={{ fontWeight: 600 }}>
                          <code>{order.order_code}</code>
                        </td>
                        <td>
                          <div><strong>{order.store_name}</strong></div>
                          <span className={order.store_type === "main" ? "pp-tag pp-tag-bone" : "pp-tag pp-tag-blue"}>
                            {order.store_type === "main" ? "Main Store Direct" : order.store_type}
                          </span>
                        </td>
                        <td>{order.buyer_name || "Customer"}</td>
                        <td style={{ color: "var(--ink-3)" }} className="nowrap">{formatDate(order.created_at)}</td>
                        <td>
                          <span className={`partner-badge ${order.payment_status || "pending"}`}>
                            {order.payment_status}
                          </span>
                        </td>
                        <td className="numeric"><b>{peso(order.total_amount)}</b></td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            type="button"
                            className="shop-secondary pp-tree-inspect-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOrder(order);
                            }}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <Pagination
                  label="Network orders pagination"
                  offset={offset}
                  pageSize={pageSize}
                  total={totalOrders}
                  shown={orders.length}
                  noun="orders"
                  onOffset={setOffset}
                  onPageSize={(size) => {
                    setPageSize(size);
                    setOffset(0);
                  }}
                />
              </>
            ) : (
              <EmptyState title="No matching network orders found.">
                Try adjusting your store or status filter.
              </EmptyState>
            )}
          </section>
        </>
      )}

      {/* Detailed Order Drawer matching Design System */}
      {selectedOrder ? (
        <MainStoreOrderDrawer order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      ) : null}
    </div>
  );
}

function MainStoreOrderDrawer({ order, onClose }: { order: MainStoreOrder; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

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

  const deliveryAddress = [order.address, order.barangay, order.city, order.province, order.zip].filter(Boolean).join(", ");
  const items = Array.isArray(order.items) ? order.items : [];

  return (
    <div className="pp-drawer-backdrop" onClick={onClose}>
      <div className="pp-drawer" ref={ref} role="dialog" aria-modal="true" aria-labelledby="pp-drawer-title" tabIndex={-1} onClick={(event) => event.stopPropagation()}>
        <div className="pp-drawer-head">
          <div>
            <p className="shop-kicker">{order.order_code}</p>
            <h2 id="pp-drawer-title">{order.buyer_name || "Customer"}</h2>
          </div>
          <button type="button" className="pp-sheet-close" aria-label="Close order details" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <dl className="pp-dl">
          <div>
            <dt>Status</dt>
            <dd>
              <span className={`partner-badge ${order.payment_status || "pending"}`}>
                {order.payment_status}
              </span>
            </dd>
          </div>
          <div>
            <dt>Total</dt>
            <dd><b>{peso(order.total_amount)}</b></dd>
          </div>
          <div>
            <dt>Date</dt>
            <dd>{formatDate(order.created_at)}</dd>
          </div>
          <div>
            <dt>Attributed store</dt>
            <dd>
              <strong>{order.store_name}</strong>
              <div style={{ fontSize: "12px", color: "var(--ink-3)" }}>/{order.store_slug}</div>
            </dd>
          </div>
          <div>
            <dt>Store type</dt>
            <dd>
              <span className={order.store_type === "main" ? "pp-tag pp-tag-bone" : "pp-tag pp-tag-blue"}>
                {order.store_type === "main" ? "Main Store Direct" : "Child Lifestyle Store"}
              </span>
            </dd>
          </div>
          <div>
            <dt>Mobile</dt>
            <dd>{order.mobile ? <a href={`tel:${order.mobile}`}>{order.mobile}</a> : "--"}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{order.email ? <a href={`mailto:${order.email}`}>{order.email}</a> : "--"}</dd>
          </div>
          <div>
            <dt>Delivery address</dt>
            <dd>{deliveryAddress || "--"}</dd>
          </div>
          {order.shipping_region ? (
            <div>
              <dt>Region</dt>
              <dd>{order.shipping_region}</dd>
            </div>
          ) : null}
          {order.payment_method ? (
            <div>
              <dt>Payment method</dt>
              <dd>{order.payment_method}</dd>
            </div>
          ) : null}
        </dl>

        {items.length > 0 && (
          <div style={{ marginTop: "12px", borderTop: "1px solid var(--rule-soft)", paddingTop: "14px" }}>
            <h3 style={{ fontSize: "13px", fontWeight: 700, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--ink-3)" }}>
              Ordered Items
            </h3>
            <table className="pp-table" style={{ fontSize: "13px" }}>
              <thead>
                <tr>
                  <th>Item</th>
                  <th style={{ textAlign: "center" }}>Qty</th>
                  <th className="numeric">Price</th>
                  <th className="numeric">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={item.id || idx}>
                    <td><strong>{item.name}</strong></td>
                    <td style={{ textAlign: "center" }}>{item.qty}</td>
                    <td className="numeric">{peso(item.price)}</td>
                    <td className="numeric" style={{ fontWeight: 600 }}>{peso(item.price * item.qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

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
