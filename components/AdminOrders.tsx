"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  adminListShopOrders,
  adminUpdateShopOrder,
  type ShopOrder,
  type ShopOrderStatus,
  type ShopPaymentStatus,
} from "@/lib/api";

const ORDER_STATUSES: ShopOrderStatus[] = [
  "pending_payment",
  "payment_review",
  "paid",
  "confirmed",
  "cancelled",
  "fulfilled",
];

const PAYMENT_STATUSES: ShopPaymentStatus[] = ["pending", "review", "paid", "failed", "refunded"];

/** Only what the referral column needs, so this does not depend on the admin doctor type. */
type PartnerLike = { id: string; full_name: string };

export default function AdminOrders({ password, partners }: { password: string; partners: PartnerLike[] }) {
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<ShopOrder | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const partnerNames = useMemo(
    () => new Map(partners.map((partner) => [partner.id, partner.full_name])),
    [partners],
  );

  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setNotice(null);

    try {
      const response = await adminListShopOrders(password);
      setOrders(response);
      setNotice(`Loaded ${response.length} website order${response.length === 1 ? "" : "s"}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load website orders.");
    } finally {
      setIsLoading(false);
    }
  }, [password]);

  // The tab mounts only after the admin password is accepted, so this needs no unlock of its own.
  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

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
        order.barangay,
        order.status,
        order.maya_reference ?? "",
        referralSource(order, partnerNames),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [orders, partnerNames, search]);

  const metrics = useMemo(
    () => ({
      pending: orders.filter((order) => order.status === "pending_payment" || order.status === "payment_review").length,
      confirmed: orders.filter((order) => order.status === "confirmed" || order.status === "fulfilled").length,
    }),
    [orders],
  );

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
        paymentStatus: selectedOrder.payment_status,
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

  return (
    <section className="admin-wheel-panel admin-shop-orders-shell">
      <div className="admin-wheel-panel-head">
        <div>
          <p className="admin-wheel-kicker">Order Queue</p>
          <h2>Website orders</h2>
        </div>
        <p>
          {metrics.pending} pending payment review. {metrics.confirmed} confirmed or fulfilled.
        </p>
      </div>

      {error ? <div className="admin-wheel-alert error">{error}</div> : null}
      {notice ? <div className="admin-wheel-alert">{notice}</div> : null}

      <div className="admin-shop-order-toolbar">
        <label>
          Search orders
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, mobile, code, status, partner"
          />
        </label>
        <button type="button" onClick={loadOrders} disabled={isLoading}>
          {isLoading ? "Loading" : "Refresh orders"}
        </button>
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
                <th>Came from</th>
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
                  <td>
                    {formatStatus(order.status)}
                    <span>{formatStatus(order.payment_status)}</span>
                  </td>
                  <td>{referralSource(order, partnerNames)}</td>
                  <td>{formatPeso(order.total_amount)}</td>
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
          <p>{isLoading ? "Loading website orders." : "No website orders match the current search."}</p>
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
                  ["Delivery", formatDeliveryAddress(selectedOrder)],
                  ["Shipping area", selectedOrder.shipping_region ?? "--"],
                  ["Estimated weight", `${selectedOrder.shipping_weight_grams || 0}g`],
                  ["Subtotal", formatPeso(selectedOrder.subtotal)],
                  ["Shipping fee", formatPeso(selectedOrder.shipping_fee)],
                  ["Total", formatPeso(selectedOrder.total_amount)],
                  ["Created", formatAdminDate(selectedOrder.created_at)],
                  ["Payment status", formatStatus(selectedOrder.payment_status)],
                  ["Maya status", selectedOrder.maya_payment_status ?? "--"],
                  ["Maya payment ID", selectedOrder.maya_payment_id ?? "--"],
                  ["Maya reference", selectedOrder.maya_reference ?? "--"],
                  ["Paid via", selectedOrder.maya_fund_source ?? "--"],
                  ["Paid at", selectedOrder.paid_at ? formatAdminDate(selectedOrder.paid_at) : "--"],
                  ["Payment attempts", String(selectedOrder.payment_attempts ?? 0)],
                  ["Came from", referralSource(selectedOrder, partnerNames)],
                  ["Referral link", selectedOrder.referral_slug ?? "--"],
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
                <label>
                  Payment status
                  <select
                    value={selectedOrder.payment_status}
                    onChange={(event) =>
                      setSelectedOrder({ ...selectedOrder, payment_status: event.target.value as ShopPaymentStatus })
                    }
                  >
                    {PAYMENT_STATUSES.map((status) => (
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
                    placeholder="Filled in automatically by the Maya webhook"
                    onChange={(event) => setSelectedOrder({ ...selectedOrder, maya_reference: event.target.value })}
                  />
                  <small>
                    Maya writes this on payment. Only edit it to reconcile a payment the webhook missed.
                  </small>
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
    </section>
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

/**
 * Who the order came from: the partner whose shop link the customer used, or Direct.
 * A slug with no doctor id was recorded but not credited - almost always a self-referral -
 * so say so, because nobody should pay a commission on it.
 */
function referralSource(order: ShopOrder, partnerNames: Map<string, string>) {
  if (!order.referral_slug) return "Direct";

  const name = (order.referral_doctor_id ? partnerNames.get(order.referral_doctor_id) : "") || order.referral_slug;
  return order.referral_doctor_id ? name : `${name} (not credited - self-referral)`;
}

function formatDeliveryAddress(order: ShopOrder) {
  return [order.address, order.barangay, order.city, order.province, order.zip].filter(Boolean).join(", ");
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
