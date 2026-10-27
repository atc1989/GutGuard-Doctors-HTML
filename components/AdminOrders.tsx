"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  adminCreateOfflineOrder,
  adminImpersonateDoctor,
  adminListShopOrders,
  adminUpdateShopOrder,
  loadShopCatalog,
  type AdminOfflineOrderInput,
  type ShopOrder,
  type ShopOrderStatus,
  type ShopPaymentStatus,
} from "@/lib/api";
import { priceOrderLines, type Product, type Promo } from "@/lib/catalog";

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
type PartnerLike = {
  id: string;
  full_name: string;
  email: string;
  routing_slug?: string;
  store_type?: "affiliate" | "lifestyle" | "main";
};

const EMPTY_OFFLINE_ORDER: AdminOfflineOrderInput = {
  paymentMethod: "consignment",
  reference: "",
  firstName: "",
  lastName: "",
  mobile: "",
  email: "",
  address: "",
  items: [{ id: "", qty: 1 }],
  referralSlug: "",
  adminNotes: "",
};

export default function AdminOrders({ partners }: { partners: PartnerLike[] }) {
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<ShopOrder | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // Consignment/cash sale the admin is typing in; saved straight away as paid.
  const [newOrder, setNewOrder] = useState<AdminOfflineOrderInput | null>(null);
  const [newOrderError, setNewOrderError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<{ products: Product[]; promos: Promo[] }>({ products: [], promos: [] });

  const partnerNames = useMemo(
    () => new Map(partners.map((partner) => [partner.id, partner.full_name])),
    [partners],
  );
  const partnerEmails = useMemo(
    () => new Map(partners.map((partner) => [partner.id, partner.email])),
    [partners],
  );
  const partnerStoreTypes = useMemo(
    () => new Map(partners.map((partner) => [partner.id, partner.store_type || "lifestyle"])),
    [partners],
  );

  // The buyer has no account - shop checkout is a guest flow keyed by order code - so the
  // only account reachable from an order is the partner who referred it.
  const referralPartnerEmail = selectedOrder?.referral_doctor_id
    ? partnerEmails.get(selectedOrder.referral_doctor_id) ?? ""
    : "";

  async function loginAsReferralPartner(email: string) {
    setError(null);
    setNotice(null);

    if (!window.confirm(`Open the partner portal as ${email}?

This signs you in as them and is recorded in the impersonation log. Any partner session in this browser is replaced.`)) {
      return;
    }

    setIsImpersonating(true);
    try {
      const { actionLink, fullName } = await adminImpersonateDoctor(email);
      window.open(actionLink, "_blank", "noopener,noreferrer");
      setNotice(`Opened the partner portal as ${fullName || email}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to open that partner account.");
    } finally {
      setIsImpersonating(false);
    }
  }

  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setNotice(null);

    try {
      const response = await adminListShopOrders();
      setOrders(response);
      setNotice(`Loaded ${response.length} website order${response.length === 1 ? "" : "s"}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load website orders.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // AdminShell gates /admin on the session cookie, so this needs no unlock of its own.
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
        order.payment_method,
        salesChannel(order),
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
      const saved = await adminUpdateShopOrder({
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

  function openNewOrder() {
    setNewOrder(EMPTY_OFFLINE_ORDER);
    setNewOrderError(null);
    if (catalog.products.length === 0) {
      loadShopCatalog()
        .then(setCatalog)
        .catch(() => setNewOrderError("Could not load the product list. Close and try again."));
    }
  }

  function setNewOrderLine(index: number, line: { id: string; qty: number }) {
    setNewOrder((current) =>
      current ? { ...current, items: current.items.map((item, i) => (i === index ? line : item)) } : current,
    );
  }

  async function saveNewOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newOrder) return;

    setIsSaving(true);
    setNewOrderError(null);
    setNotice(null);

    try {
      const saved = await adminCreateOfflineOrder(newOrder);
      setOrders((current) => [saved, ...current]);
      setNewOrder(null);
      setNotice(`Saved ${saved.order_code} as a paid ${saved.payment_method} order.`);
    } catch (caught) {
      setNewOrderError(caught instanceof Error ? caught.message : "Could not save the order.");
    } finally {
      setIsSaving(false);
    }
  }

  // Priced the same way the server will price it, so the admin sees the total before saving.
  const newOrderItems = newOrder
    ? priceOrderLines(newOrder.items.filter((item) => item.id), catalog.products, catalog.promos)
    : null;
  const newOrderTotal = (newOrderItems ?? []).reduce((sum, item) => sum + item.price * item.qty, 0);
  const referralPartners = useMemo(
    () =>
      partners
        .filter((partner) => partner.routing_slug)
        .sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [partners],
  );

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
        <button type="button" onClick={openNewOrder}>
          Add order
        </button>
      </div>

      {filteredOrders.length > 0 ? (
        <div className="admin-table-table-wrap">
          <table className="admin-table-table admin-shop-orders-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Mobile</th>
                <th>Status</th>
                <th>Payment</th>
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
                  <td>
                    {formatStatus(order.payment_method)}
                    <span>{salesChannel(order)}</span>
                  </td>
                  <td>{referralSource(order, partnerNames, partnerStoreTypes)}</td>
                  <td>{formatPeso(order.total_amount)}</td>
                  <td>{formatAdminDate(order.created_at)}</td>
                  <td>
                    <div className="admin-table-row-actions">
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
                  ["Payment method", `${formatStatus(selectedOrder.payment_method)} (${salesChannel(selectedOrder)})`],
                  ["Payment status", formatStatus(selectedOrder.payment_status)],
                  ["Maya status", selectedOrder.maya_payment_status ?? "--"],
                  ["Maya payment ID", selectedOrder.maya_payment_id ?? "--"],
                  ["Payment reference", selectedOrder.maya_reference ?? "--"],
                  ["Paid via", selectedOrder.maya_fund_source ?? "--"],
                  ["Paid at", selectedOrder.paid_at ? formatAdminDate(selectedOrder.paid_at) : "--"],
                  ["Payment attempts", String(selectedOrder.payment_attempts ?? 0)],
                  ["Came from", referralSource(selectedOrder, partnerNames, partnerStoreTypes)],
                  ["Referral link", selectedOrder.referral_slug ?? "--"],
                ]}
              />

              <section className="admin-table-subsection">
                <h3>Line items</h3>
                <div className="admin-table-table-wrap">
                  <table className="admin-table-table compact admin-shop-line-items-table">
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
                  Payment reference
                  <input
                    value={selectedOrder.maya_reference ?? ""}
                    placeholder={
                      selectedOrder.payment_method === "maya"
                        ? "Filled in automatically by the Maya webhook"
                        : "Bank or cash reference number"
                    }
                    onChange={(event) => setSelectedOrder({ ...selectedOrder, maya_reference: event.target.value })}
                  />
                  <small>
                    {selectedOrder.payment_method === "maya"
                      ? "Maya writes this on payment. Only edit it to reconcile a payment the webhook missed."
                      : "The bank or cash reference entered when this order was added."}
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
              {referralPartnerEmail ? (
                <button
                  type="button"
                  onClick={() => loginAsReferralPartner(referralPartnerEmail)}
                  disabled={isImpersonating}
                  title="Open the partner portal as the partner who referred this order"
                >
                  {isImpersonating ? "Opening…" : "Log in as partner"}
                </button>
              ) : null}
              <button type="submit" disabled={isSaving}>
                {isSaving ? "Saving" : "Save order"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {newOrder ? (
        <div className="admin-modal-backdrop" role="presentation">
          <form className="admin-modal admin-shop-order-modal" role="dialog" aria-modal="true" onSubmit={saveNewOrder}>
            <div className="admin-modal-head">
              <div>
                <p className="admin-wheel-kicker">Consignment or cash sale</p>
                <h2>Add order</h2>
              </div>
              <button type="button" onClick={() => setNewOrder(null)}>
                Close
              </button>
            </div>

            <p>Saved as paid straight away. Prices come from the product catalog; there is no shipping fee.</p>

            {/* The page-level alert sits behind this modal, so errors must show here. */}
            {newOrderError ? <div className="admin-wheel-alert error">{newOrderError}</div> : null}

            <div className="admin-edit-grid">
              <label>
                Payment method
                <select
                  value={newOrder.paymentMethod}
                  onChange={(event) =>
                    setNewOrder({ ...newOrder, paymentMethod: event.target.value as AdminOfflineOrderInput["paymentMethod"] })
                  }
                >
                  <option value="consignment">Consignment</option>
                  <option value="cash">Cash</option>
                </select>
              </label>
              <label>
                {newOrder.paymentMethod === "consignment" ? "Bank reference no." : "Reference no."}
                <input
                  value={newOrder.reference}
                  required
                  placeholder={
                    newOrder.paymentMethod === "consignment"
                      ? "Reference on the bank deposit or transfer"
                      : "Cash receipt or reference number"
                  }
                  onChange={(event) => setNewOrder({ ...newOrder, reference: event.target.value })}
                />
              </label>
              <label>
                First name
                <input
                  value={newOrder.firstName}
                  required
                  onChange={(event) => setNewOrder({ ...newOrder, firstName: event.target.value })}
                />
              </label>
              <label>
                Last name
                <input
                  value={newOrder.lastName}
                  required
                  onChange={(event) => setNewOrder({ ...newOrder, lastName: event.target.value })}
                />
              </label>
              <label>
                Mobile
                <input
                  type="tel"
                  value={newOrder.mobile}
                  required
                  onChange={(event) => setNewOrder({ ...newOrder, mobile: event.target.value })}
                />
              </label>
              <label>
                Email (optional, gets the receipt)
                <input
                  type="email"
                  value={newOrder.email}
                  onChange={(event) => setNewOrder({ ...newOrder, email: event.target.value })}
                />
              </label>
              <label className="admin-edit-wide">
                Address
                <textarea
                  value={newOrder.address}
                  required
                  rows={2}
                  onChange={(event) => setNewOrder({ ...newOrder, address: event.target.value })}
                />
              </label>

              {newOrder.items.map((line, index) => (
                <div key={index} className="admin-edit-wide admin-offline-order-line">
                  <label>
                    Product
                    <select
                      value={line.id}
                      required
                      onChange={(event) => setNewOrderLine(index, { ...line, id: event.target.value })}
                    >
                      <option value="">{catalog.products.length ? "Select product" : "Loading products"}</option>
                      {catalog.products
                        .filter((product) => product.status === "active")
                        .map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name} ({product.caps} caps)
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Qty
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={line.qty}
                      required
                      onChange={(event) => setNewOrderLine(index, { ...line, qty: Number(event.target.value) })}
                    />
                  </label>
                  {newOrder.items.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => setNewOrder({ ...newOrder, items: newOrder.items.filter((_, i) => i !== index) })}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              ))}
              <div className="admin-edit-wide">
                <button
                  type="button"
                  onClick={() => setNewOrder({ ...newOrder, items: [...newOrder.items, { id: "", qty: 1 }] })}
                >
                  Add another product
                </button>
              </div>

              <label className="admin-edit-wide">
                Referring partner (optional, credits G-Points)
                <select
                  value={newOrder.referralSlug}
                  onChange={(event) => setNewOrder({ ...newOrder, referralSlug: event.target.value })}
                >
                  <option value="">None - direct sale</option>
                  {referralPartners.map((partner) => (
                    <option key={partner.id} value={partner.routing_slug}>
                      {partner.full_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="admin-edit-wide">
                Admin notes
                <textarea
                  value={newOrder.adminNotes}
                  rows={2}
                  onChange={(event) => setNewOrder({ ...newOrder, adminNotes: event.target.value })}
                />
              </label>
            </div>

            <div className="admin-modal-actions">
              <button type="button" onClick={() => setNewOrder(null)}>
                Cancel
              </button>
              <button type="submit" disabled={isSaving || !newOrderItems}>
                {isSaving ? "Saving" : `Save as paid${newOrderItems ? ` - ${formatPeso(newOrderTotal)}` : ""}`}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}

/** Maya orders come from shop checkout; consignment/cash are only added by an admin (Add order). */
function salesChannel(order: ShopOrder) {
  return order.payment_method === "maya" ? "Online" : "Store";
}

function Summary({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="admin-table-summary-grid">
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

function referralSource(
  order: ShopOrder,
  partnerNames: Map<string, string>,
  partnerStoreTypes?: Map<string, "affiliate" | "lifestyle" | "main">,
) {
  if (!order.referral_slug) return "Direct";

  const name = (order.referral_doctor_id ? partnerNames.get(order.referral_doctor_id) : "") || order.referral_slug;
  const storeType = order.referral_doctor_id && partnerStoreTypes ? partnerStoreTypes.get(order.referral_doctor_id) : undefined;
  const typeBadge = storeType === "main" ? " [🏢 Main]" : storeType === "affiliate" ? " [🌱 Affiliate]" : storeType === "lifestyle" ? " [🛍️ Lifestyle]" : "";

  return order.referral_doctor_id ? `${name}${typeBadge}` : `${name} (not credited - self-referral)`;
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
