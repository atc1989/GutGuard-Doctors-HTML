"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { CreditCard, Plus, ReceiptText, RefreshCw, Truck, Wallet } from "lucide-react";
import { Alert, FilterTabs, MetricCell, MetricStrip, PageBody, Section, StatusDot } from "@/components/admin/blocks";
import { CellStack, DataTable } from "@/components/admin/data-table/data-table";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import {
  adminCreateOfflineOrder,
  adminImpersonateDoctor,
  adminListShopOrders,
  adminUpdateShopOrder,
  getDoctorRegistrations,
  loadShopCatalog,
  type AdminOfflineOrderInput,
  type ShopOrder,
  type ShopOrderStatus,
  type ShopPaymentStatus,
} from "@/lib/api";
import { useAdminAccess } from "@/components/admin/AdminShell";
import { priceOrderLines, type Product, type Promo } from "@/lib/catalog";
import { EMPTY_FULFILLMENT, TRACKING_STATUSES, type OrderFulfillment, type TrackingStatus } from "@/lib/order-fulfillment";

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
  fulfillment: EMPTY_FULFILLMENT,
};

type OrderTab = "all" | "review" | "ship" | "fulfilled";

const TAB_MATCH: Record<OrderTab, (order: ShopOrder) => boolean> = {
  all: () => true,
  review: (order) => order.status === "payment_review",
  ship: (order) => order.status === "paid" || order.status === "confirmed",
  fulfilled: (order) => order.status === "fulfilled",
};

const STATUS_VIEW: Record<ShopOrderStatus, [string, "gray" | "amber" | "ink" | "green"]> = {
  pending_payment: ["Awaiting payment", "gray"],
  payment_review: ["Payment review", "amber"],
  paid: ["Paid", "ink"],
  confirmed: ["Confirmed", "ink"],
  fulfilled: ["Fulfilled", "green"],
  cancelled: ["Cancelled", "gray"],
};

const STORE_TYPE_LABEL = { main: "Main store", affiliate: "Affiliate", lifestyle: "Lifestyle" } as const;

const monthIndex = (iso: string) => {
  const date = new Date(iso);
  return date.getFullYear() * 12 + date.getMonth();
};
const shortItemName = (name: string) => name.replace(/^SynBIOTIC\+\s*/i, "");

export default function AdminOrders() {
  // Partner names for the "Came from" column. Failing to load them only falls back to the link slug.
  const [partners, setPartners] = useState<PartnerLike[]>([]);
  useEffect(() => {
    getDoctorRegistrations().then(setPartners).catch(() => undefined);
  }, []);
  const [tab, setTab] = useState<OrderTab>("all");
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<ShopOrder | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const { owner } = useAdminAccess();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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

  /** Partner name (or "Direct") for the "Came from" column, filter and CSV. */
  const sourceName = useCallback(
    (order: ShopOrder) =>
      !order.referral_slug
        ? "Direct"
        : (order.referral_doctor_id ? partnerNames.get(order.referral_doctor_id) : "") || order.referral_slug,
    [partnerNames],
  );

  const searchText = useCallback(
    (order: ShopOrder) =>
      [
        order.order_code,
        order.customer_name,
        order.email,
        order.mobile,
        order.city,
        order.province,
        order.barangay,
        order.payment_method,
        salesChannel(order),
        order.maya_reference ?? "",
        sourceName(order),
      ].join(" "),
    [sourceName],
  );

  const metrics = useMemo(() => {
    const thisMonth = new Date().getFullYear() * 12 + new Date().getMonth();
    const paidThisMonth = orders.filter(
      (order) => order.payment_status === "paid" && monthIndex(order.paid_at ?? order.created_at) === thisMonth,
    );
    return {
      review: orders.filter(TAB_MATCH.review).length,
      awaiting: orders.filter((order) => order.status === "pending_payment").length,
      ship: orders.filter(TAB_MATCH.ship).length,
      fulfilled: orders.filter(TAB_MATCH.fulfilled).length,
      revenue: paidThisMonth.reduce((sum, order) => sum + order.total_amount, 0),
      paidCount: paidThisMonth.length,
      thisMonth: orders.filter((order) => monthIndex(order.created_at) === thisMonth).length,
      lastMonth: orders.filter((order) => monthIndex(order.created_at) === thisMonth - 1).length,
    };
  }, [orders]);

  const tabOrders = useMemo(() => orders.filter(TAB_MATCH[tab]), [orders, tab]);

  const columns = useMemo<ColumnDef<ShopOrder, unknown>[]>(
    () => [
      {
        id: "order",
        accessorKey: "created_at",
        meta: { label: "Order", csv: (order) => order.order_code },
        cell: ({ row }) => <CellStack title={row.original.order_code} sub={formatAdminDate(row.original.created_at)} />,
      },
      {
        id: "created",
        accessorKey: "created_at",
        meta: { label: "Created", csv: (order) => order.created_at },
        cell: ({ row }) => formatAdminDate(row.original.created_at),
      },
      {
        id: "customer",
        accessorKey: "customer_name",
        meta: { label: "Customer" },
        cell: ({ row }) => <CellStack title={row.original.customer_name} sub={row.original.mobile} />,
      },
      { id: "mobile", accessorKey: "mobile", meta: { label: "Mobile" } },
      { id: "email", accessorKey: "email", meta: { label: "Email" } },
      {
        id: "items",
        accessorFn: (order) => order.items.map((item) => item.name).join(", "),
        enableSorting: false,
        meta: { label: "Items", csv: (order) => order.items.map((item) => `${item.name} x${item.qty}`).join("; ") },
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1.5">
            {row.original.items.map((item) => (
              <Badge key={item.id}>
                {shortItemName(item.name)}
                {item.qty > 1 ? ` ×${item.qty}` : ""}
              </Badge>
            ))}
          </div>
        ),
      },
      {
        id: "source",
        accessorFn: sourceName,
        meta: { label: "Came from" },
        cell: ({ row }) => {
          const order = row.original;
          const type = order.referral_doctor_id ? partnerStoreTypes.get(order.referral_doctor_id) : undefined;
          const sub = !order.referral_slug ? undefined : order.referral_doctor_id ? (type ? STORE_TYPE_LABEL[type] : undefined) : "Not credited, self-referral";
          return <CellStack title={sourceName(order)} sub={sub} />;
        },
      },
      {
        id: "payment_method",
        accessorFn: (order) => formatStatus(order.payment_method),
        meta: { label: "Payment method" },
      },
      {
        id: "payment_status",
        accessorFn: (order) => formatStatus(order.payment_status),
        meta: { label: "Payment status" },
      },
      {
        id: "reference",
        accessorFn: (order) => order.maya_reference ?? "",
        meta: { label: "Payment reference" },
      },
      {
        id: "total",
        accessorKey: "total_amount",
        meta: { label: "Total", align: "right" },
        cell: ({ row }) => formatPeso(row.original.total_amount),
      },
      {
        id: "status",
        accessorFn: (order) => STATUS_VIEW[order.status]?.[0] ?? formatStatus(order.status),
        meta: { label: "Status" },
        cell: ({ row }) => {
          const [label, tone] = STATUS_VIEW[row.original.status] ?? [formatStatus(row.original.status), "gray"];
          return <StatusDot tone={tone}>{label}</StatusDot>;
        },
      },
    ],
    [partnerStoreTypes, sourceName],
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
        // Only when edited, so plain status saves never touch the fulfilment columns.
        fulfillment:
          JSON.stringify(selectedOrder.fulfillment) !==
          JSON.stringify(orders.find((order) => order.id === selectedOrder.id)?.fulfillment)
            ? selectedOrder.fulfillment
            : undefined,
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
    // Order time starts at "now"; the admin changes it when entering an older sale.
    setNewOrder({ ...EMPTY_OFFLINE_ORDER, fulfillment: { ...EMPTY_FULFILLMENT, order_time: new Date().toISOString() } });
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
    <>
      <MetricStrip>
        <MetricCell
          label="Payments to review"
          icon={CreditCard}
          loading={isLoading}
          value={metrics.review.toLocaleString("en-PH")}
          footer={["Awaiting payment", metrics.awaiting.toLocaleString("en-PH")]}
        />
        <MetricCell
          label="To ship"
          icon={Truck}
          loading={isLoading}
          value={metrics.ship.toLocaleString("en-PH")}
          footer={["Fulfilled", metrics.fulfilled.toLocaleString("en-PH")]}
        />
        <MetricCell
          label="Revenue this month"
          icon={Wallet}
          loading={isLoading}
          value={formatPeso(metrics.revenue)}
          footer={["Paid orders", metrics.paidCount.toLocaleString("en-PH")]}
        />
        <MetricCell
          label="Orders this month"
          icon={ReceiptText}
          loading={isLoading}
          value={metrics.thisMonth.toLocaleString("en-PH")}
          footer={["Last month", metrics.lastMonth.toLocaleString("en-PH")]}
        />
      </MetricStrip>

      <PageBody>
        {error ? <Alert tone="error">{error}</Alert> : null}
        {notice ? <Alert>{notice}</Alert> : null}

        <Section
          title="Orders"
          actions={
            <FilterTabs
              label="Filter orders by status"
              value={tab}
              onChange={setTab}
              tabs={[
                { value: "all", label: "All", count: orders.length },
                { value: "review", label: "Payment review", count: metrics.review },
                { value: "ship", label: "To ship", count: metrics.ship },
                { value: "fulfilled", label: "Fulfilled", count: metrics.fulfilled },
              ]}
            />
          }
        >
          <DataTable
            data={tabOrders}
            columns={columns}
            loading={isLoading && orders.length === 0}
            searchText={searchText}
            searchPlaceholder="Search orders"
            facets={[
              { column: "source", title: "Came from" },
              { column: "payment_method", title: "Payment" },
            ]}
            exportName="gutguard-orders"
            onRowClick={setSelectedOrder}
            initialHidden={["created", "mobile", "email", "payment_method", "payment_status", "reference"]}
            emptyText="No orders yet."
            actions={
              <>
                <Button variant="outline" size="icon-sm" onClick={loadOrders} disabled={isLoading} aria-label="Refresh orders" title="Refresh orders" className="rounded-lg shadow-none">
                  <RefreshCw className={isLoading ? "animate-spin" : undefined} strokeWidth={1.5} />
                </Button>
                <Button size="sm" onClick={openNewOrder} className="h-8 rounded-lg text-[13px]">
                  <Plus strokeWidth={1.5} />
                  Add order
                </Button>
              </>
            }
          />
        </Section>
      </PageBody>

      {/* ponytail: the old detail and Add-order pop-ups stay until part 2 moves them into a Sheet.
          Their inputs and buttons are only styled inside .admin-wheel-shell, so keep that ancestor
          without letting it take up any space. */}
      <div className="admin-wheel-shell contents">

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
                <FulfillmentFields
                  value={selectedOrder.fulfillment}
                  onChange={(fulfillment) => setSelectedOrder({ ...selectedOrder, fulfillment })}
                />
              </div>
            </div>

            <div className="admin-modal-actions">
              <button type="button" onClick={() => setSelectedOrder(null)}>
                Cancel
              </button>
              {referralPartnerEmail && owner ? (
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
                  <option value="maya">Maya</option>
                </select>
              </label>
              <label>
                {newOrder.paymentMethod === "consignment"
                  ? "Bank reference no."
                  : newOrder.paymentMethod === "maya"
                    ? "Maya reference no."
                    : "Reference no."}
                <input
                  value={newOrder.reference}
                  required
                  placeholder={
                    newOrder.paymentMethod === "consignment"
                      ? "Reference on the bank deposit or transfer"
                      : newOrder.paymentMethod === "maya"
                        ? "Reference on the Maya payment"
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
              <FulfillmentFields
                value={newOrder.fulfillment}
                onChange={(fulfillment) => setNewOrder({ ...newOrder, fulfillment })}
              />
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
      </div>
    </>
  );
}

/** "Store" = added by an admin through Add order (any payment method); "Online" = shop checkout. */
function salesChannel(order: ShopOrder) {
  return order.sales_channel === "store" ? "Store" : "Online";
}

/** Order time, POF, courier and salesperson fields - shared by Add order and the order detail. */
function FulfillmentFields({
  value,
  onChange,
}: {
  value: OrderFulfillment;
  onChange: (value: OrderFulfillment) => void;
}) {
  const set = (patch: Partial<OrderFulfillment>) => onChange({ ...value, ...patch });
  const timeInput = (label: string, key: "order_time" | "pof_time" | "pickup_time") => (
    <label>
      {label}
      <input
        type="datetime-local"
        value={toLocalInput(value[key])}
        onChange={(event) => set({ [key]: fromLocalInput(event.target.value) })}
      />
    </label>
  );

  return (
    <>
      <h3 className="admin-edit-wide admin-fulfillment-heading">Fulfilment</h3>
      {timeInput("Order time", "order_time")}
      {timeInput("POF time (proof of payment)", "pof_time")}
      <label>
        Tracking number
        <input value={value.tracking_number ?? ""} onChange={(event) => set({ tracking_number: event.target.value })} />
      </label>
      {timeInput("Pick-up time", "pickup_time")}
      <label>
        Tracking status
        <select
          value={value.tracking_status ?? ""}
          onChange={(event) => set({ tracking_status: (event.target.value || null) as TrackingStatus | null })}
        >
          <option value="">Not set</option>
          {TRACKING_STATUSES.map((status) => (
            <option key={status} value={status}>
              {formatStatus(status)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Sales (salesperson)
        <input value={value.salesperson ?? ""} onChange={(event) => set({ salesperson: event.target.value })} />
      </label>
      <label className="admin-edit-wide">
        Bot message
        <textarea
          value={value.bot_message ?? ""}
          rows={2}
          onChange={(event) => set({ bot_message: event.target.value })}
        />
      </label>
    </>
  );
}

/** ISO timestamp -> the browser's local "YYYY-MM-DDTHH:mm" for <input type="datetime-local">. */
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function fromLocalInput(value: string) {
  return value ? new Date(value).toISOString() : null;
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
