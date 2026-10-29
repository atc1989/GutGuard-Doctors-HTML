"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { CreditCard, Plus, ReceiptText, RefreshCw, Truck, Wallet, X } from "lucide-react";
import { Alert, FilterTabs, MetricCell, MetricStrip, PageBody, Section, StatusDot } from "@/components/admin/blocks";
import { CellStack, DataTable } from "@/components/admin/data-table/data-table";
import { DetailList, EditSheet, Field, FieldGroup } from "@/components/admin/form";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { DateTimePicker } from "@/components/admin/ui/date-time-picker";
import { Select } from "@/components/admin/ui/select";
import { Textarea } from "@/components/admin/ui/textarea";
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
  const [confirmingLogin, setConfirmingLogin] = useState(false);
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

  // Confirmed in the panel first (the "Log in as partner" button asks before calling this).
  async function loginAsReferralPartner(email: string) {
    setError(null);
    setNotice(null);
    setIsImpersonating(true);
    try {
      const { actionLink, fullName } = await adminImpersonateDoctor(email);
      window.open(actionLink, "_blank", "noopener,noreferrer");
      setNotice(`Opened the partner portal as ${fullName || email}.`);
      setConfirmingLogin(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to open that partner account.");
    } finally {
      setIsImpersonating(false);
    }
  }

  // selectedOrder is the editable copy; savedOrder is what the server last returned.
  const savedOrder = selectedOrder ? orders.find((order) => order.id === selectedOrder.id) : undefined;
  const detailDirty = Boolean(selectedOrder && JSON.stringify(selectedOrder) !== JSON.stringify(savedOrder));
  const closeDetail = () => {
    setSelectedOrder(null);
    setConfirmingLogin(false);
    setError(null);
  };

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
  /** "Came from" in the detail panel: name plus store type, or why it wasn't credited. */
  const sourceLabel = (order: ShopOrder) => {
    const name = sourceName(order);
    if (!order.referral_slug) return name;
    if (!order.referral_doctor_id) return `${name} (not credited, self-referral)`;
    const type = partnerStoreTypes.get(order.referral_doctor_id);
    return type ? `${name} · ${STORE_TYPE_LABEL[type]}` : name;
  };

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
            {row.original.items.map((item, index) => (
              <Badge key={`${item.id}-${index}`}>
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
      closeDetail();
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
    // The product picker isn't a native <select>, so `required` can't catch an empty line.
    if (newOrder.items.some((item) => !item.id)) {
      setNewOrderError("Choose a product on every line, or remove the empty line.");
      return;
    }

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

      {selectedOrder ? (
        <EditSheet
          open
          onOpenChange={(isOpen) => !isOpen && closeDetail()}
          title={selectedOrder.order_code}
          description={
            <span className="inline-flex flex-wrap items-center gap-x-3">
              {formatAdminDate(selectedOrder.created_at)}
              <StatusDot tone={(STATUS_VIEW[savedOrder?.status ?? selectedOrder.status] ?? STATUS_VIEW.pending_payment)[1]}>
                {(STATUS_VIEW[savedOrder?.status ?? selectedOrder.status] ?? [formatStatus(selectedOrder.status)])[0]}
              </StatusDot>
            </span>
          }
          onSubmit={saveOrder}
          footer={
            <>
              <Button type="button" variant="ghost" size="sm" onClick={closeDetail}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={!detailDirty || isSaving}>
                {isSaving ? "Saving" : "Save"}
              </Button>
            </>
          }
        >
          {error ? <Alert tone="error">{error}</Alert> : null}

          <DetailList
            title="Customer"
            items={[
              ["Name", selectedOrder.customer_name],
              ["Email", selectedOrder.email],
              ["Mobile", selectedOrder.mobile],
              ["Delivery", formatDeliveryAddress(selectedOrder)],
              ["Shipping area", selectedOrder.shipping_region ?? ""],
              ["Weight", `${selectedOrder.shipping_weight_grams || 0} g`],
            ]}
          />

          <DetailList
            title="Payment"
            items={[
              ["Method", `${formatStatus(selectedOrder.payment_method)} · ${salesChannel(selectedOrder)}`],
              ["Maya status", selectedOrder.maya_payment_status ?? ""],
              ["Maya payment ID", selectedOrder.maya_payment_id ?? ""],
              ["Paid via", selectedOrder.maya_fund_source ?? ""],
              ["Paid at", selectedOrder.paid_at ? formatAdminDate(selectedOrder.paid_at) : ""],
              ["Attempts", String(selectedOrder.payment_attempts ?? 0)],
              ["Came from", sourceLabel(selectedOrder)],
              ["Referral link", selectedOrder.referral_slug ?? ""],
            ]}
          />

          <FieldGroup title="Items">
            <div className="overflow-hidden rounded-lg border border-border text-[13px]">
              <table className="w-full">
                <thead>
                  <tr className="h-9 border-b border-border text-muted-foreground">
                    <th scope="col" className="px-3 text-left font-normal">Item</th>
                    <th scope="col" className="px-3 text-right font-normal">Qty</th>
                    <th scope="col" className="px-3 text-right font-normal">Price</th>
                    <th scope="col" className="px-3 text-right font-normal">Total</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {selectedOrder.items.map((item, index) => (
                    <tr key={`${item.id}-${index}`} className="h-10 border-b border-border">
                      <td className="px-3">
                        {item.name}
                        <span className="text-muted-foreground"> · {item.caps} caps</span>
                      </td>
                      <td className="px-3 text-right">{item.qty}</td>
                      <td className="px-3 text-right">{formatPeso(item.price)}</td>
                      <td className="px-3 text-right">{formatPeso(item.price * item.qty)}</td>
                    </tr>
                  ))}
                  <tr className="h-8 text-muted-foreground">
                    <td colSpan={3} className="px-3 text-right">Subtotal</td>
                    <td className="px-3 text-right">{formatPeso(selectedOrder.subtotal)}</td>
                  </tr>
                  <tr className="h-8 text-muted-foreground">
                    <td colSpan={3} className="px-3 text-right">Shipping</td>
                    <td className="px-3 text-right">{formatPeso(selectedOrder.shipping_fee)}</td>
                  </tr>
                  <tr className="h-9 font-medium">
                    <td colSpan={3} className="px-3 text-right">Total</td>
                    <td className="px-3 text-right">{formatPeso(selectedOrder.total_amount)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </FieldGroup>

          <FieldGroup title="Status">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Order status" htmlFor="order-status">
                <Select
                  id="order-status"
                  value={selectedOrder.status}
                  onValueChange={(status) => setSelectedOrder({ ...selectedOrder, status: status as ShopOrderStatus })}
                  options={ORDER_STATUSES.map((status) => ({ value: status, label: STATUS_VIEW[status]?.[0] ?? formatStatus(status) }))}
                />
              </Field>
              <Field label="Payment status" htmlFor="order-payment-status">
                <Select
                  id="order-payment-status"
                  value={selectedOrder.payment_status}
                  onValueChange={(status) => setSelectedOrder({ ...selectedOrder, payment_status: status as ShopPaymentStatus })}
                  options={PAYMENT_STATUSES.map((status) => ({ value: status, label: formatStatus(status) }))}
                />
              </Field>
            </div>
            <Field
              label="Payment reference"
              htmlFor="order-reference"
              hint={
                selectedOrder.payment_method === "maya"
                  ? "Maya writes this on payment. Only edit it to reconcile a payment the webhook missed."
                  : "The bank or cash reference entered when this order was added."
              }
            >
              <Input
                id="order-reference"
                value={selectedOrder.maya_reference ?? ""}
                placeholder={selectedOrder.payment_method === "maya" ? "Filled in by the Maya webhook" : "Bank or cash reference"}
                onChange={(event) => setSelectedOrder({ ...selectedOrder, maya_reference: event.target.value })}
              />
            </Field>
            <Field label="Admin notes" htmlFor="order-notes">
              <Textarea
                id="order-notes"
                value={selectedOrder.admin_notes ?? ""}
                placeholder="Call notes, confirmation details, shipping notes"
                onChange={(event) => setSelectedOrder({ ...selectedOrder, admin_notes: event.target.value })}
              />
            </Field>
          </FieldGroup>

          <FulfillmentFields
            idPrefix="order"
            value={selectedOrder.fulfillment}
            onChange={(fulfillment) => setSelectedOrder({ ...selectedOrder, fulfillment })}
          />

          {referralPartnerEmail && owner ? (
            <FieldGroup title="Referring partner">
              {confirmingLogin ? (
                <div className="flex flex-col gap-3 rounded-lg border border-[#d97706]/30 bg-[#d97706]/5 p-3 text-[13px] text-[#92400e]">
                  <p>
                    Open the partner portal as {referralPartnerEmail}? This signs you in as them, is recorded in the
                    impersonation log, and replaces any partner session in this browser.
                  </p>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" onClick={() => loginAsReferralPartner(referralPartnerEmail)} disabled={isImpersonating}>
                      {isImpersonating ? "Opening…" : "Open partner portal"}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmingLogin(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="truncate text-muted-foreground">{referralPartnerEmail}</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => setConfirmingLogin(true)} className="shadow-none">
                    Log in as partner
                  </Button>
                </div>
              )}
            </FieldGroup>
          ) : null}
        </EditSheet>
      ) : null}

      {newOrder ? (
        <EditSheet
          open
          onOpenChange={(isOpen) => !isOpen && setNewOrder(null)}
          title="Add order"
          description="Consignment or cash sale. Saved as paid; prices come from the catalog and there's no shipping fee."
          onSubmit={saveNewOrder}
          footer={
            <>
              <Button type="button" variant="ghost" size="sm" onClick={() => setNewOrder(null)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSaving || !newOrderItems}>
                {isSaving ? "Saving" : `Save as paid${newOrderItems ? ` · ${formatPeso(newOrderTotal)}` : ""}`}
              </Button>
            </>
          }
        >
          {newOrderError ? <Alert tone="error">{newOrderError}</Alert> : null}

          <FieldGroup title="Payment">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Payment method" htmlFor="new-method">
                <Select
                  id="new-method"
                  value={newOrder.paymentMethod}
                  onValueChange={(method) => setNewOrder({ ...newOrder, paymentMethod: method as AdminOfflineOrderInput["paymentMethod"] })}
                  options={[
                    { value: "consignment", label: "Consignment" },
                    { value: "cash", label: "Cash" },
                    { value: "maya", label: "Maya" },
                  ]}
                />
              </Field>
              <Field
                label={
                  newOrder.paymentMethod === "consignment"
                    ? "Bank reference no."
                    : newOrder.paymentMethod === "maya"
                      ? "Maya reference no."
                      : "Reference no."
                }
                htmlFor="new-reference"
              >
                <Input
                  id="new-reference"
                  value={newOrder.reference}
                  required
                  placeholder={
                    newOrder.paymentMethod === "consignment"
                      ? "On the deposit or transfer"
                      : newOrder.paymentMethod === "maya"
                        ? "On the Maya payment"
                        : "Cash receipt or reference"
                  }
                  onChange={(event) => setNewOrder({ ...newOrder, reference: event.target.value })}
                />
              </Field>
            </div>
          </FieldGroup>

          <FieldGroup title="Customer">
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name" htmlFor="new-first">
                <Input id="new-first" value={newOrder.firstName} required onChange={(event) => setNewOrder({ ...newOrder, firstName: event.target.value })} />
              </Field>
              <Field label="Last name" htmlFor="new-last">
                <Input id="new-last" value={newOrder.lastName} required onChange={(event) => setNewOrder({ ...newOrder, lastName: event.target.value })} />
              </Field>
              <Field label="Mobile" htmlFor="new-mobile">
                <Input id="new-mobile" type="tel" value={newOrder.mobile} required onChange={(event) => setNewOrder({ ...newOrder, mobile: event.target.value })} />
              </Field>
              <Field label="Email (optional)" htmlFor="new-email" hint="Gets the receipt.">
                <Input id="new-email" type="email" value={newOrder.email} onChange={(event) => setNewOrder({ ...newOrder, email: event.target.value })} />
              </Field>
            </div>
            <Field label="Address" htmlFor="new-address">
              <Textarea id="new-address" value={newOrder.address} required rows={2} onChange={(event) => setNewOrder({ ...newOrder, address: event.target.value })} />
            </Field>
          </FieldGroup>

          <FieldGroup title="Products">
            {newOrder.items.map((line, index) => (
              <div key={index} className="grid grid-cols-[minmax(0,1fr)_80px_32px] items-end gap-3">
                <Field label={`Product ${newOrder.items.length > 1 ? index + 1 : ""}`.trim()} htmlFor={`new-product-${index}`}>
                  <Select
                    id={`new-product-${index}`}
                    value={line.id}
                    placeholder={catalog.products.length ? "Select product" : "Loading products"}
                    onValueChange={(id) => setNewOrderLine(index, { ...line, id })}
                    options={catalog.products
                      .filter((product) => product.status === "active")
                      .map((product) => ({ value: product.id, label: `${product.name} (${product.caps} caps)` }))}
                  />
                </Field>
                <Field label="Qty" htmlFor={`new-qty-${index}`}>
                  <Input
                    id={`new-qty-${index}`}
                    type="number"
                    min={1}
                    max={20}
                    value={line.qty}
                    required
                    onChange={(event) => setNewOrderLine(index, { ...line, qty: Number(event.target.value) })}
                  />
                </Field>
                {newOrder.items.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove product ${index + 1}`}
                    onClick={() => setNewOrder({ ...newOrder, items: newOrder.items.filter((_, i) => i !== index) })}
                    className="mb-0.5 text-muted-foreground"
                  >
                    <X strokeWidth={1.5} />
                  </Button>
                ) : (
                  <span />
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setNewOrder({ ...newOrder, items: [...newOrder.items, { id: "", qty: 1 }] })}
              className="self-start text-[13px] font-normal text-muted-foreground"
            >
              <Plus strokeWidth={1.5} />
              Add another product
            </Button>
            <Field label="Referring partner (optional)" htmlFor="new-partner" hint="Credits the partner's G-Points.">
              <Select
                searchable
                id="new-partner"
                value={newOrder.referralSlug}
                onValueChange={(referralSlug) => setNewOrder({ ...newOrder, referralSlug })}
                options={[
                  { value: "", label: "None, direct sale" },
                  ...referralPartners.map((partner) => ({ value: partner.routing_slug ?? "", label: partner.full_name })),
                ]}
              />
            </Field>
            <Field label="Admin notes" htmlFor="new-notes">
              <Textarea id="new-notes" value={newOrder.adminNotes} rows={2} onChange={(event) => setNewOrder({ ...newOrder, adminNotes: event.target.value })} />
            </Field>
          </FieldGroup>

          <FulfillmentFields
            idPrefix="new"
            value={newOrder.fulfillment}
            onChange={(fulfillment) => setNewOrder({ ...newOrder, fulfillment })}
          />
        </EditSheet>
      ) : null}
    </>
  );
}

/** "Store" = added by an admin through Add order (any payment method); "Online" = shop checkout. */
function salesChannel(order: ShopOrder) {
  return order.sales_channel === "store" ? "Store" : "Online";
}

/** Order time, POF, courier and salesperson fields - shared by Add order and the order detail. */
function FulfillmentFields({
  idPrefix,
  value,
  onChange,
}: {
  idPrefix: string;
  value: OrderFulfillment;
  onChange: (value: OrderFulfillment) => void;
}) {
  const set = (patch: Partial<OrderFulfillment>) => onChange({ ...value, ...patch });
  const timeInput = (label: string, key: "order_time" | "pof_time" | "pickup_time") => (
    <Field label={label} htmlFor={`${idPrefix}-${key}`}>
      <DateTimePicker id={`${idPrefix}-${key}`} value={value[key]} onChange={(iso) => set({ [key]: iso })} />
    </Field>
  );

  return (
    <FieldGroup title="Fulfilment">
      <div className="grid grid-cols-2 gap-3">
        {timeInput("Order time", "order_time")}
        {timeInput("Proof of payment time", "pof_time")}
        {timeInput("Pick-up time", "pickup_time")}
        <Field label="Tracking status" htmlFor={`${idPrefix}-tracking-status`}>
          <Select
            id={`${idPrefix}-tracking-status`}
            value={value.tracking_status ?? ""}
            onValueChange={(status) => set({ tracking_status: (status || null) as TrackingStatus | null })}
            options={[
              { value: "", label: "Not set" },
              ...TRACKING_STATUSES.map((status) => ({ value: status, label: formatStatus(status) })),
            ]}
          />
        </Field>
        <Field label="Tracking number" htmlFor={`${idPrefix}-tracking-number`}>
          <Input
            id={`${idPrefix}-tracking-number`}
            value={value.tracking_number ?? ""}
            onChange={(event) => set({ tracking_number: event.target.value })}
          />
        </Field>
        <Field label="Salesperson" htmlFor={`${idPrefix}-salesperson`}>
          <Input id={`${idPrefix}-salesperson`} value={value.salesperson ?? ""} onChange={(event) => set({ salesperson: event.target.value })} />
        </Field>
      </div>
      <Field label="Bot message" htmlFor={`${idPrefix}-bot-message`}>
        <Textarea
          id={`${idPrefix}-bot-message`}
          value={value.bot_message ?? ""}
          rows={2}
          onChange={(event) => set({ bot_message: event.target.value })}
        />
      </Field>
    </FieldGroup>
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
