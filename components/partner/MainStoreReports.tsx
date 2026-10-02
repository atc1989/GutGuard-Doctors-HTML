"use client";

import { useEffect, useState } from "react";
import { Store, ShoppingBag, Users, Coins, Search, ArrowUpDown, ChevronRight } from "lucide-react";
import { EmptyState, PageHeader, Pagination, formatDate, peso, usePartner } from "./shared";
import { getMainStoreReports, type MainStoreReports, type MainStoreOrder, type MainStoreChildStore } from "@/lib/api";

type Tab = "stores" | "orders";

export default function MainStoreReportsPage() {
  const { dashboard } = usePartner();
  const [tab, setTab] = useState<Tab>("stores");
  const [loading, setLoading] = useState(true);
  const [reportsData, setReportsData] = useState<MainStoreReports | null>(null);

  const [search, setSearch] = useState("");
  const [storeFilter, setStoreFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    getMainStoreReports({
      storeId: storeFilter || undefined,
      status: statusFilter || undefined,
      limit: pageSize,
      offset: (page - 1) * pageSize,
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
  }, [storeFilter, statusFilter, page]);

  const stores = reportsData?.stores ?? [];
  const orders = reportsData?.orders ?? [];
  const totalOrders = reportsData?.total_orders ?? 0;

  const filteredStores = stores.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.full_name.toLowerCase().includes(q) || s.routing_slug.toLowerCase().includes(q) || s.specialty.toLowerCase().includes(q);
  });

  return (
    <div className="pp-screen">
      <PageHeader
        kicker="Aggregated Reports"
        title="Main Store Network Reports"
        lede="Inspect all descendant Lifestyle & Affiliate store performances and cross-store order attributions."
      />

      {/* Tab Switcher */}
      <div className="pp-seg" role="tablist" aria-label="Main Store report tabs">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "stores"}
          className={tab === "stores" ? "active" : ""}
          onClick={() => setTab("stores")}
        >
          <Store aria-hidden="true" size={16} />
          <span>Store Directory ({stores.length})</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "orders"}
          className={tab === "orders" ? "active" : ""}
          onClick={() => setTab("orders")}
        >
          <ShoppingBag aria-hidden="true" size={16} />
          <span>All Network Orders ({totalOrders})</span>
        </button>
      </div>

      {tab === "stores" ? (
        <section className="pp-card" aria-label="Store Directory">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0 }}>
              Descendant Stores ({filteredStores.length})
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", maxWidth: "320px" }}>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search store by name or specialty…"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "1px solid var(--rule, #e2e8f0)",
                  fontSize: "14px",
                }}
              />
            </div>
          </div>

          {filteredStores.length ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", textAlign: "left" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--rule, #e2e8f0)", color: "var(--ink-3, #64748b)" }}>
                    <th style={{ padding: "12px 8px" }}>Store Name</th>
                    <th style={{ padding: "12px 8px" }}>Type</th>
                    <th style={{ padding: "12px 8px" }}>Specialty & Location</th>
                    <th style={{ padding: "12px 8px", textAlign: "right" }}>Paid Orders</th>
                    <th style={{ padding: "12px 8px", textAlign: "right" }}>Gross Value</th>
                    <th style={{ padding: "12px 8px", textAlign: "right" }}>Total Points</th>
                    <th style={{ padding: "12px 8px", textAlign: "center" }}>Referral QR</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStores.map((store) => (
                    <tr key={store.id} style={{ borderBottom: "1px solid var(--rule, #e2e8f0)" }}>
                      <td style={{ padding: "12px 8px" }}>
                        <strong>{store.full_name}</strong>
                        <div style={{ fontSize: "12px", color: "var(--ink-3)" }}>/{store.routing_slug}</div>
                      </td>
                      <td style={{ padding: "12px 8px" }}>
                        <span style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          background: store.store_type === "lifestyle" ? "#dbeafe" : "#fef3c7",
                          color: store.store_type === "lifestyle" ? "#1e40af" : "#92400e",
                        }}>
                          {store.store_type === "lifestyle" ? "🛍️ Lifestyle" : "🌱 Affiliate"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 8px" }}>
                        <div>{store.specialty || "--"}</div>
                        <div style={{ fontSize: "12px", color: "var(--ink-3)" }}>{store.practice_location || "--"}</div>
                      </td>
                      <td style={{ padding: "12px 8px", textAlign: "right" }}>{store.orders_count}</td>
                      <td style={{ padding: "12px 8px", textAlign: "right", fontWeight: 600 }}>{peso(store.revenue)}</td>
                      <td style={{ padding: "12px 8px", textAlign: "right", fontWeight: 600 }}>{store.points} pts</td>
                      <td style={{ padding: "12px 8px", textAlign: "center" }}>
                        <span style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          color: store.referral_qr_enabled ? "#16a34a" : "#94a3b8"
                        }}>
                          {store.referral_qr_enabled ? "Active" : "Locked"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No descendant stores found.">
              Partner stores registered under your Main Store link will appear here.
            </EmptyState>
          )}
        </section>
      ) : (
        <section className="pp-card" aria-label="Network Orders">
          {/* Order Filters */}
          <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
            <select
              value={storeFilter}
              onChange={(e) => {
                setStoreFilter(e.target.value);
                setPage(1);
              }}
              style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--rule, #e2e8f0)", fontSize: "14px" }}
            >
              <option value="">All Stores (Direct + Descendants)</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name} ({s.store_type})
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--rule, #e2e8f0)", fontSize: "14px" }}
            >
              <option value="">All Statuses</option>
              <option value="paid">Paid</option>
              <option value="fulfilled">Fulfilled</option>
              <option value="pending">Pending Payment</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {loading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--ink-3)" }}>
              Loading network orders…
            </div>
          ) : orders.length ? (
            <>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", textAlign: "left" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--rule, #e2e8f0)", color: "var(--ink-3, #64748b)" }}>
                      <th style={{ padding: "12px 8px" }}>Order Code</th>
                      <th style={{ padding: "12px 8px" }}>Attributed Store</th>
                      <th style={{ padding: "12px 8px" }}>Buyer</th>
                      <th style={{ padding: "12px 8px" }}>Date</th>
                      <th style={{ padding: "12px 8px" }}>Status</th>
                      <th style={{ padding: "12px 8px", textAlign: "right" }}>Total Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.order_code} style={{ borderBottom: "1px solid var(--rule, #e2e8f0)" }}>
                        <td style={{ padding: "12px 8px", fontWeight: 600 }}>{order.order_code}</td>
                        <td style={{ padding: "12px 8px" }}>
                          <div><strong>{order.store_name}</strong></div>
                          <span style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            padding: "1px 6px",
                            borderRadius: "3px",
                            background: order.store_type === "main" ? "#fef3c7" : "#e0e7ff",
                            color: order.store_type === "main" ? "#92400e" : "#3730a3"
                          }}>
                            {order.store_type === "main" ? "Main Store Direct" : order.store_type}
                          </span>
                        </td>
                        <td style={{ padding: "12px 8px" }}>{order.buyer_name || "Customer"}</td>
                        <td style={{ padding: "12px 8px", color: "var(--ink-3)" }}>{formatDate(order.created_at)}</td>
                        <td style={{ padding: "12px 8px" }}>
                          <span style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            background: order.payment_status === "paid" ? "#dcfce7" : "#fee2e2",
                            color: order.payment_status === "paid" ? "#166534" : "#991b1b"
                          }}>
                            {order.payment_status}
                          </span>
                        </td>
                        <td style={{ padding: "12px 8px", textAlign: "right", fontWeight: 700 }}>{peso(order.total_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: "16px" }}>
                <Pagination
                  total={totalOrders}
                  limit={pageSize}
                  offset={(page - 1) * pageSize}
                  onPageChange={(newOffset) => setPage(Math.floor(newOffset / pageSize) + 1)}
                />
              </div>
            </>
          ) : (
            <EmptyState title="No matching network orders found.">
              Try adjusting your store or status filter.
            </EmptyState>
          )}
        </section>
      )}
    </div>
  );
}
