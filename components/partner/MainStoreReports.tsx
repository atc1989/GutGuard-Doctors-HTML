"use client";

import { useEffect, useRef, useState } from "react";
import { Store, ShoppingBag, Users, Coins, Search, ArrowUpDown, ChevronRight, X, Package, ExternalLink } from "lucide-react";
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
                    <th style={{ padding: "12px 8px", textAlign: "right" }}>Orders</th>
                    <th style={{ padding: "12px 8px", textAlign: "right" }}>Sales Revenue</th>
                    <th style={{ padding: "12px 8px", textAlign: "right" }}>E-Points</th>
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
                setOffset(0);
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
                setOffset(0);
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
                      <th style={{ padding: "12px 8px", textAlign: "center" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr
                        key={order.order_code}
                        onClick={() => setSelectedOrder(order)}
                        style={{ borderBottom: "1px solid var(--rule, #e2e8f0)", cursor: "pointer" }}
                        className="pp-tree-head"
                      >
                        <td style={{ padding: "12px 8px", fontWeight: 600 }}>
                          <code>{order.order_code}</code>
                        </td>
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
                        <td style={{ padding: "12px 8px", textAlign: "center" }}>
                          <button
                            type="button"
                            className="shop-secondary"
                            style={{ padding: "4px 10px", fontSize: "12px" }}
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
              </div>

              <div style={{ marginTop: "16px" }}>
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
              </div>
            </>
          ) : (
            <EmptyState title="No matching network orders found.">
              Try adjusting your store or status filter.
            </EmptyState>
          )}
        </section>
      )}

      {/* Detailed Order Modal */}
      {selectedOrder ? (
        <MainStoreOrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      ) : null}
    </div>
  );
}

function MainStoreOrderDetailModal({ order, onClose }: { order: MainStoreOrder; onClose: () => void }) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const deliveryAddress = [order.address, order.barangay, order.city, order.province, order.zip].filter(Boolean).join(", ");
  const items = Array.isArray(order.items) ? order.items : [];

  return (
    <div className="admin-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="admin-modal admin-shop-order-modal"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "680px" }}
      >
        <div className="admin-modal-head">
          <div>
            <p className="admin-wheel-kicker">Network Order Detail</p>
            <h2 style={{ fontSize: "1.25rem", margin: 0 }}>{order.order_code}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <div className="admin-shop-order-detail" style={{ maxHeight: "70vh", overflowY: "auto", padding: "16px 20px" }}>
          {/* Status & Store Banner */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 16px",
            background: "var(--bone-soft, #f8fafc)",
            borderRadius: "8px",
            marginBottom: "16px",
            flexWrap: "wrap",
            gap: "8px"
          }}>
            <div>
              <span style={{ fontSize: "11px", color: "var(--ink-3)", textTransform: "uppercase", fontWeight: 700 }}>Attributed Store</span>
              <div style={{ fontWeight: 700, color: "var(--ink)" }}>{order.store_name}</div>
              <small style={{ color: "var(--ink-3)" }}>/{order.store_slug}</small>
            </div>
            <span style={{
              fontSize: "12px",
              fontWeight: 700,
              textTransform: "uppercase",
              padding: "4px 10px",
              borderRadius: "6px",
              background: order.payment_status === "paid" ? "#dcfce7" : "#fee2e2",
              color: order.payment_status === "paid" ? "#166534" : "#991b1b"
            }}>
              {order.payment_status}
            </span>
          </div>

          <dl className="admin-tiktok-summary-grid">
            <div>
              <dt>Buyer Name</dt>
              <dd><strong>{order.buyer_name || "Customer"}</strong></dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{order.email ? <a href={`mailto:${order.email}`} style={{ color: "var(--ink)" }}>{order.email}</a> : "--"}</dd>
            </div>
            <div>
              <dt>Mobile</dt>
              <dd>{order.mobile ? <a href={`tel:${order.mobile}`} style={{ color: "var(--ink)" }}>{order.mobile}</a> : "--"}</dd>
            </div>
            <div>
              <dt>Delivery Address</dt>
              <dd>{deliveryAddress || "--"}</dd>
            </div>
            <div>
              <dt>Shipping Region</dt>
              <dd>{order.shipping_region || "--"}</dd>
            </div>
            <div>
              <dt>Order Date</dt>
              <dd>{formatDate(order.created_at)}</dd>
            </div>
            <div>
              <dt>Payment Method</dt>
              <dd>{order.payment_method || "Maya"}</dd>
            </div>
            <div>
              <dt>Maya Reference</dt>
              <dd><code>{order.maya_reference || "--"}</code></dd>
            </div>
            <div>
              <dt>Paid At</dt>
              <dd>{order.paid_at ? formatDate(order.paid_at) : (order.payment_status === "paid" ? formatDate(order.created_at) : "--")}</dd>
            </div>
            <div>
              <dt>Order Status</dt>
              <dd><span style={{ textTransform: "capitalize" }}>{order.status}</span></dd>
            </div>
            <div>
              <dt>Subtotal</dt>
              <dd>{peso(order.subtotal || order.total_amount)}</dd>
            </div>
            <div>
              <dt>Shipping Fee</dt>
              <dd>{peso(order.shipping_fee || 0)}</dd>
            </div>
            <div style={{ gridColumn: "1 / -1", borderTop: "1px solid var(--rule, #e2e8f0)", paddingTop: "8px" }}>
              <dt style={{ fontSize: "14px", fontWeight: 700 }}>Total Paid</dt>
              <dd style={{ fontSize: "18px", fontWeight: 800, color: "var(--gold-dark, #b45309)" }}>{peso(order.total_amount)}</dd>
            </div>
          </dl>

          {/* Line Items Table */}
          {items.length > 0 && (
            <section className="admin-tiktok-subsection" style={{ marginTop: "20px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 700, marginBottom: "8px" }}>Ordered Items</h3>
              <div style={{ overflowX: "auto" }}>
                <table className="admin-tiktok-table compact" style={{ width: "100%", fontSize: "13px" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left" }}>Item</th>
                      <th style={{ textAlign: "center" }}>Caps</th>
                      <th style={{ textAlign: "center" }}>Qty</th>
                      <th style={{ textAlign: "right" }}>Price</th>
                      <th style={{ textAlign: "right" }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={item.id || idx}>
                        <td><strong>{item.name}</strong></td>
                        <td style={{ textAlign: "center" }}>{item.caps || "--"}</td>
                        <td style={{ textAlign: "center" }}>{item.qty}</td>
                        <td style={{ textAlign: "right" }}>{peso(item.price)}</td>
                        <td style={{ textAlign: "right", fontWeight: 600 }}>{peso(item.price * item.qty)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>

        <div className="admin-modal-actions" style={{ justifyContent: "flex-end", padding: "12px 20px" }}>
          <button type="button" className="shop-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
