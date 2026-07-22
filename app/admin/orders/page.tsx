"use client";

import { FormEvent, useMemo, useState } from "react";
import Header from "@/components/Header";
import {
  adminListShopOrders,
  adminUpdateShopOrder,
  type ShopOrder,
  type ShopOrderStatus,
} from "@/lib/api";

const ORDER_STATUSES: ShopOrderStatus[] = [
  "pending_payment",
  "payment_review",
  "paid",
  "confirmed",
  "cancelled",
  "fulfilled",
];

export default function AdminOrdersPage() {
  const [password, setPassword] = useState("");
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<ShopOrder | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return orders;
    return orders.filter((order) =>
      [
        order.order_code,
        order.customer_name,
        order.email,
        order.mobile,
        order.city,
        order.province,
        order.status,
        order.maya_reference ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [orders, search]);

  const metrics = useMemo(
    () => ({
      total: orders.length,
      pending: orders.filter((order) => order.status === "pending_payment" || order.status === "payment_review").length,
      confirmed: orders.filter((order) => order.status === "confirmed" || order.status === "fulfilled").length,
    }),
    [orders],
  );

  async function loadOrders(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setIsLoading(true);
    setError(null);
    setNotice(null);

    try {
      const response = await adminListShopOrders(password);
      setOrders(response);
      setIsUnlocked(true);
      setNotice(`Loaded ${response.length} website order${response.length === 1 ? "" : "s"}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load website orders.");
    } finally {
      setIsLoading(false);
    }
  }

  async function saveOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedOrder) return;

    setIsSaving(true);
    setError(null);
    setNotice(null);

    try {
      const saved = await adminUpdateShopOrder(password, {
        id: selectedOrder.id,
        status: selectedOrder.status,
        paymentStatus: mapPaymentStatus(selectedOrder.status),
        mayaReference: selectedOrder.maya_reference ?? "",
        adminNotes: selectedOrder.admin_notes ?? "",
      });
      setOrders((current) => current.map((order) => (order.id === saved.id ? saved : order)));
      setSelectedOrder(saved);
      setNotice(`Saved ${saved.order_code}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save order.");
    } finally {
      setIsSaving(false);
    }
  }

  const hasPassword = password.trim().length > 0;

  return (
    <main className="admin-wheel-shell admin-shop-orders-shell">
      <Header dateLabel="Website Orders" />

      <section className="admin-wheel-hero">
        <div>
          <p className="admin-wheel-kicker">GutGuard Shop</p>
          <h1>
            Orders
            <br />
            <em>Admin</em>
          </h1>
        </div>
        <div className="admin-wheel-summary" aria-live="polite">
          <span>{isUnlocked ? "visible" : "locked"}</span>
          <strong>{metrics.total}</strong>
          <span>{metrics.pending} pending</span>
        </div>
      </section>

      <form className="admin-wheel-auth admin-tiktok-auth" onSubmit={loadOrders}>
        <label htmlFor="admin-password">Admin password</label>
        <div className="admin-wheel-auth-row">
          <input className="admin-hidden-username" type="text" value="gutguard-admin" readOnly aria-hidden="true" tabIndex={-1} />
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            placeholder="Enter password"
            onChange={(event) => setPassword(event.target.value)}
          />
          <button type="submit" disabled={isLoading || !hasPassword}>
            {isLoading ? "Loading" : isUnlocked ? "Refresh orders" : "Unlock"}
          </button>
        </div>
      </form>

      {notice ? <div className="admin-wheel-alert">{notice}</div> : null}
      {error ? <div className="admin-wheel-alert error">{error}</div> : null}

      {isUnlocked ? (
        <>
          <section className="admin-wheel-panel">
            <div className="admin-wheel-panel-head">
              <div>
                <p className="admin-wheel-kicker">Order Queue</p>
                <h2>Website orders</h2>
              </div>
              <p>
                {metrics.pending} pending payment review. {metrics.confirmed} confirmed or fulfilled.
              </p>
            </div>
            <div className="admin-shop-order-toolbar">
              <label>
                Search orders
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, mobile, code, status" />
              </label>
            </div>

            {filteredOrders.length > 0 ? (
              <div className="admin-tiktok-table-wrap">
                <table className="admin-tiktok-table admin-shop-orders-table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Customer</th>
                      <th>Mobile</th>
                      <th>Status</th>
                      <th>Maya Ref</th>
                      <th>Total</th>
                      <th>Created</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((order) => (
                      <tr key={order.id}>
                        <td>{order.order_code}</td>
                        <td>
                          <strong>{order.customer_name}</strong>
                          <span>{order.email}</span>
                        </td>
                        <td>{order.mobile}</td>
                        <td>{formatStatus(order.status)}</td>
                        <td>{order.maya_reference || "--"}</td>
                        <td>{formatPeso(order.subtotal)}</td>
                        <td>{formatAdminDate(order.created_at)}</td>
                        <td>
                          <div className="admin-tiktok-row-actions">
                            <button type="button" onClick={() => setSelectedOrder(order)}>
                              View
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <section className="admin-wheel-empty">
                <p>No website orders match the current search.</p>
              </section>
            )}
          </section>
        </>
      ) : (
        <section className="admin-wheel-empty">
          <p>Enter the admin password to load website orders.</p>
        </section>
      )}

      {selectedOrder ? (
        <div className="admin-modal-backdrop" role="presentation">
          <form className="admin-modal admin-shop-order-modal" role="dialog" aria-modal="true" onSubmit={saveOrder}>
            <div className="admin-modal-head">
              <div>
                <p className="admin-wheel-kicker">Order Detail</p>
                <h2>{selectedOrder.order_code}</h2>
              </div>
              <button type="button" onClick={() => setSelectedOrder(null)}>
                Close
              </button>
            </div>

            <div className="admin-shop-order-detail">
              <Summary
                items={[
                  ["Customer", selectedOrder.customer_name],
                  ["Email", selectedOrder.email],
                  ["Mobile", selectedOrder.mobile],
                  ["Delivery", `${selectedOrder.address}, ${selectedOrder.city}, ${selectedOrder.province} ${selectedOrder.zip}`],
                  ["Total", formatPeso(selectedOrder.subtotal)],
                  ["Created", formatAdminDate(selectedOrder.created_at)],
                ]}
              />

              <section className="admin-tiktok-subsection">
                <h3>Line items</h3>
                <div className="admin-tiktok-table-wrap">
                  <table className="admin-tiktok-table compact admin-shop-line-items-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Caps</th>
                        <th>Qty</th>
                        <th>Price</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.items.map((item) => (
                        <tr key={item.id}>
                          <td>{item.name}</td>
                          <td>{item.caps}</td>
                          <td>{item.qty}</td>
                          <td>{formatPeso(item.price)}</td>
                          <td>{formatPeso(item.price * item.qty)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <div className="admin-edit-grid">
                <label>
                  Order status
                  <select
                    value={selectedOrder.status}
                    onChange={(event) => setSelectedOrder({ ...selectedOrder, status: event.target.value as ShopOrderStatus })}
                  >
                    {ORDER_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {formatStatus(status)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="admin-edit-wide">
                  Maya reference
                  <input
                    value={selectedOrder.maya_reference ?? ""}
                    placeholder="Paste reference from Maya email/dashboard"
                    onChange={(event) => setSelectedOrder({ ...selectedOrder, maya_reference: event.target.value })}
                  />
                </label>
                <label className="admin-edit-wide">
                  Admin notes
                  <textarea
                    value={selectedOrder.admin_notes ?? ""}
                    placeholder="Call notes, confirmation details, shipping notes"
                    onChange={(event) => setSelectedOrder({ ...selectedOrder, admin_notes: event.target.value })}
                  />
                </label>
              </div>
            </div>

            <div className="admin-modal-actions">
              <button type="button" onClick={() => setSelectedOrder(null)}>
                Cancel
              </button>
              <button type="submit" disabled={isSaving}>
                {isSaving ? "Saving" : "Save order"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}

function Summary({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="admin-tiktok-summary-grid">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value || "--"}</dd>
        </div>
      ))}
    </dl>
  );
}

function formatPeso(value: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(value);
}

function formatStatus(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function mapPaymentStatus(status: ShopOrderStatus) {
  if (status === "paid" || status === "confirmed" || status === "fulfilled") return "paid";
  if (status === "payment_review") return "review";
  if (status === "cancelled") return "failed";
  return "pending";
}

function formatAdminDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
