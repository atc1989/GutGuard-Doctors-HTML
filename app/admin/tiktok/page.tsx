"use client";

import { FormEvent, useMemo, useState } from "react";
import Header from "@/components/Header";
import {
  addTikTokExternalOrderReference,
  getTikTokExternalOrderReferences,
  getTikTokOrderDetail,
  getTikTokOrders,
  getTikTokPriceDetail,
  searchTikTokOrderByExternalReference,
  sendTikTokRawApiRequest,
  type TikTokOrderDetailResponse,
  type TikTokOrdersFilters,
  type TikTokOrdersResponse,
  type TikTokPriceDetailResponse,
  type TikTokRawApiResponse,
  type TikTokReferenceResponse,
} from "@/lib/api";

type TikTokTab = "list" | "detail" | "price" | "references" | "console";

const ORDER_STATUS_OPTIONS = [
  { label: "All statuses", value: "" },
  { label: "Unpaid", value: "UNPAID" },
  { label: "Awaiting shipment", value: "AWAITING_SHIPMENT" },
  { label: "Partially shipping", value: "PARTIALLY_SHIPPING" },
  { label: "Awaiting collection", value: "AWAITING_COLLECTION" },
  { label: "In transit", value: "IN_TRANSIT" },
  { label: "Delivered", value: "DELIVERED" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Cancelled", value: "CANCELLED" },
];

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const TABS: Array<{ id: TikTokTab; label: string }> = [
  { id: "list", label: "Order List" },
  { id: "detail", label: "Order Detail" },
  { id: "price", label: "Price Detail" },
  { id: "references", label: "References" },
  { id: "console", label: "Raw API Console" },
];

export default function AdminTikTokPage() {
  const defaultRange = useMemo(() => getDefaultDateRange(), []);
  const [activeTab, setActiveTab] = useState<TikTokTab>("list");
  const [password, setPassword] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [timeMode, setTimeMode] = useState<TikTokOrdersFilters["timeMode"]>("create_time");
  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);
  const [orderStatus, setOrderStatus] = useState("");
  const [pageSize, setPageSize] = useState(20);
  const [pageToken, setPageToken] = useState("");
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [listResult, setListResult] = useState<TikTokOrdersResponse | null>(null);
  const [showListDebug, setShowListDebug] = useState(true);

  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailResult, setDetailResult] = useState<TikTokOrderDetailResponse | null>(null);
  const [showDetailDebug, setShowDetailDebug] = useState(false);

  const [priceOrderId, setPriceOrderId] = useState("");
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [priceResult, setPriceResult] = useState<TikTokPriceDetailResponse | null>(null);
  const [showPriceDebug, setShowPriceDebug] = useState(false);

  const [referenceOrderId, setReferenceOrderId] = useState("");
  const [externalReference, setExternalReference] = useState("");
  const [referenceLoading, setReferenceLoading] = useState(false);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [referenceResult, setReferenceResult] = useState<TikTokReferenceResponse | null>(null);
  const [referenceMode, setReferenceMode] = useState("No reference request sent yet.");

  const [consoleMethod, setConsoleMethod] = useState<"GET" | "POST">("GET");
  const [consolePath, setConsolePath] = useState("/order/202309/orders/search");
  const [consoleQueryJson, setConsoleQueryJson] = useState('{\n  "page_size": "10"\n}');
  const [consoleBodyJson, setConsoleBodyJson] = useState("{}");
  const [consoleMutationConfirmed, setConsoleMutationConfirmed] = useState(false);
  const [consoleLoading, setConsoleLoading] = useState(false);
  const [consoleError, setConsoleError] = useState<string | null>(null);
  const [consoleResult, setConsoleResult] = useState<TikTokRawApiResponse | null>(null);

  const orders = listResult?.orders ?? [];
  const listDebugJson = useDebugJson(listResult);
  const detailDebugJson = useDebugJson(detailResult);
  const priceDebugJson = useDebugJson(priceResult);
  const referenceDebugJson = useDebugJson(referenceResult);
  const consoleDebugJson = useDebugJson(consoleResult);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await fetchOrders();
  }

  async function fetchOrders(overrides: Partial<TikTokOrdersFilters> = {}) {
    setListLoading(true);
    setListError(null);
    setNotice(null);

    try {
      const filters: TikTokOrdersFilters = {
        timeMode,
        startTime: toUnixSeconds(startDate),
        endTime: toUnixSeconds(endDate),
        orderStatus: orderStatus || undefined,
        pageSize,
        pageToken: pageToken.trim() || undefined,
        ...overrides,
      };
      const response = await getTikTokOrders(password, filters);
      setListResult(response);
      setIsUnlocked(true);
      setPageToken(filters.pageToken ?? "");
      setNotice(`Loaded ${response.orders.length} TikTok order${response.orders.length === 1 ? "" : "s"}.`);
    } catch (caught) {
      setListError(caught instanceof Error ? caught.message : "TikTok order request failed.");
    } finally {
      setListLoading(false);
    }
  }

  async function fetchNextPage() {
    if (!listResult?.nextPageToken) return;
    const nextToken = listResult.nextPageToken;
    setPageToken(nextToken);
    await fetchOrders({ pageToken: nextToken });
  }

  async function openDetail(orderId: string) {
    setSelectedOrderId(orderId);
    setPriceOrderId(orderId);
    setReferenceOrderId(orderId);
    setActiveTab("detail");
    await fetchDetail(orderId);
  }

  async function fetchDetail(orderId = selectedOrderId) {
    const cleanOrderId = orderId.trim();
    if (!cleanOrderId) {
      setDetailError("Enter an order ID.");
      return;
    }

    setDetailLoading(true);
    setDetailError(null);
    setNotice(null);

    try {
      const response = await getTikTokOrderDetail(password, cleanOrderId);
      if (!response.order?.summary) {
        throw new Error("Order detail response did not include order data. The Edge Function may need redeploying.");
      }
      setDetailResult(response);
      setIsUnlocked(true);
      setNotice(`Loaded detail for order ${cleanOrderId}.`);
    } catch (caught) {
      setDetailError(caught instanceof Error ? caught.message : "TikTok order detail request failed.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function fetchPrice(orderId = priceOrderId) {
    const cleanOrderId = orderId.trim();
    if (!cleanOrderId) {
      setPriceError("Enter an order ID.");
      return;
    }

    setPriceLoading(true);
    setPriceError(null);
    setNotice(null);

    try {
      const response = await getTikTokPriceDetail(password, cleanOrderId);
      if (!response.price) {
        throw new Error("Price detail response did not include price data. The Edge Function may need redeploying.");
      }
      setPriceResult(response);
      setIsUnlocked(true);
      setNotice(`Loaded price detail for order ${cleanOrderId}.`);
    } catch (caught) {
      setPriceError(caught instanceof Error ? caught.message : "TikTok price detail request failed.");
    } finally {
      setPriceLoading(false);
    }
  }

  async function addReference() {
    const cleanOrderId = referenceOrderId.trim();
    const cleanReference = externalReference.trim();
    if (!cleanOrderId || !cleanReference) {
      setReferenceError("Enter an order ID and external reference.");
      return;
    }
    if (!window.confirm("Add this external reference to the TikTok order?")) return;
    await runReferenceRequest("Added reference", () => addTikTokExternalOrderReference(password, cleanOrderId, cleanReference));
  }

  async function getReferences() {
    const cleanOrderId = referenceOrderId.trim();
    if (!cleanOrderId) {
      setReferenceError("Enter an order ID.");
      return;
    }
    await runReferenceRequest("Fetched references", () => getTikTokExternalOrderReferences(password, cleanOrderId));
  }

  async function searchByReference() {
    const cleanReference = externalReference.trim();
    if (!cleanReference) {
      setReferenceError("Enter an external reference.");
      return;
    }
    await runReferenceRequest("Searched by reference", () => searchTikTokOrderByExternalReference(password, cleanReference));
  }

  async function runReferenceRequest(label: string, request: () => Promise<TikTokReferenceResponse>) {
    setReferenceLoading(true);
    setReferenceError(null);
    setNotice(null);

    try {
      const response = await request();
      if (!Array.isArray(response.references)) {
        throw new Error("Reference response did not include reference data. The Edge Function may need redeploying.");
      }
      setReferenceResult(response);
      setReferenceMode(label);
      setIsUnlocked(true);
      setNotice(`${label} successfully.`);
    } catch (caught) {
      setReferenceError(caught instanceof Error ? caught.message : "TikTok reference request failed.");
    } finally {
      setReferenceLoading(false);
    }
  }

  async function sendRawRequest() {
    setConsoleLoading(true);
    setConsoleError(null);
    setNotice(null);

    try {
      const query = parseJsonStringRecord(consoleQueryJson, "Query JSON");
      const body = parseJsonRecord(consoleBodyJson, "Body JSON");
      if (consoleMethod !== "GET" && !consoleMutationConfirmed) {
        throw new Error("Confirm the mutation warning before sending a POST raw API request.");
      }
      const response = await sendTikTokRawApiRequest(password, {
        method: consoleMethod,
        path: consolePath.trim(),
        query,
        body,
      });
      setConsoleResult(response);
      setIsUnlocked(true);
      setNotice("Raw API request completed.");
    } catch (caught) {
      setConsoleError(caught instanceof Error ? caught.message : "Raw API request failed.");
    } finally {
      setConsoleLoading(false);
    }
  }

  async function copyText(value: string, label: string) {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      setNotice(`${label} copied.`);
    } catch {
      setNotice(null);
    }
  }

  const hasPassword = password.trim().length > 0;
  const detailOrder = detailResult?.order;
  const priceDetail = priceResult?.price;
  const fallbackPriceLineItems =
    priceDetail &&
    detailOrder?.summary.id === priceDetail.orderId &&
    priceDetail.lineItems.every((item) => !item.price) &&
    detailOrder.lineItems.length > 0
      ? detailOrder.lineItems
      : [];
  const priceLineItems = fallbackPriceLineItems.length > 0 ? fallbackPriceLineItems : (priceDetail?.lineItems ?? []);
  const priceCurrency =
    priceDetail?.currency ||
    priceLineItems.map((item) => item.currency).find((currency): currency is string => Boolean(currency)) ||
    "";
  const referenceRows = Array.isArray(referenceResult?.references) ? referenceResult.references : [];

  return (
    <main className="admin-wheel-shell admin-tiktok-shell">
      <Header dateLabel="TikTok Admin" />

      <section className="admin-wheel-hero">
        <div>
          <p className="admin-wheel-kicker">TikTok Shop API</p>
          <h1>
            Orders
            <br />
            <em>Admin</em>
          </h1>
        </div>
        <div className="admin-wheel-summary" aria-live="polite">
          <span>{isUnlocked ? `${orders.length} visible` : "locked"}</span>
          <strong>{listResult?.totalCount ?? orders.length}</strong>
          <span>{listResult?.totalCount === null ? "returned orders" : "total count"}</span>
        </div>
      </section>

      <form className="admin-wheel-auth admin-tiktok-auth" onSubmit={handleSubmit}>
        <label htmlFor="admin-password">Admin password</label>
        <div className="admin-wheel-auth-row">
          <input
            className="admin-hidden-username"
            type="text"
            name="username"
            autoComplete="username"
            value="gutguard-admin"
            readOnly
            aria-hidden="true"
            tabIndex={-1}
          />
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            placeholder="Enter password"
            onChange={(event) => setPassword(event.target.value)}
          />
          <button type="submit" disabled={listLoading || !hasPassword}>
            {listLoading ? "Loading" : isUnlocked ? "Refresh orders" : "Unlock"}
          </button>
        </div>
      </form>

      {notice ? <div className="admin-wheel-alert">{notice}</div> : null}

      <nav className="admin-tiktok-tabs" aria-label="TikTok admin sections">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? "active" : ""}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === "list" ? (
        <>
          {listError ? <div className="admin-wheel-alert error">{listError}</div> : null}
          <section className="admin-wheel-panel">
            <div className="admin-wheel-panel-head">
              <div>
                <p className="admin-wheel-kicker">Order Search</p>
                <h2>Filters</h2>
              </div>
              <p>Credentials stay in Supabase secrets. This page only sends filters and the admin password.</p>
            </div>

            <div className="admin-tiktok-filter-grid">
              <label>
                Time field
                <select value={timeMode} onChange={(event) => setTimeMode(event.target.value as TikTokOrdersFilters["timeMode"])}>
                  <option value="create_time">Created time</option>
                  <option value="update_time">Updated time</option>
                </select>
              </label>
              <label>
                Start date
                <input type="datetime-local" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              </label>
              <label>
                End date
                <input type="datetime-local" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
              </label>
              <label>
                Order status
                <select value={orderStatus} onChange={(event) => setOrderStatus(event.target.value)}>
                  {ORDER_STATUS_OPTIONS.map((option) => (
                    <option key={option.value || "all"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Page size
                <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
              <label className="admin-tiktok-wide">
                Next page token
                <input value={pageToken} placeholder="Optional token from previous response" onChange={(event) => setPageToken(event.target.value)} />
              </label>
            </div>

            <div className="admin-tiktok-actions">
              <button type="button" onClick={() => fetchOrders({ pageToken: undefined })} disabled={listLoading || !hasPassword}>
                {listLoading ? "Loading" : "Fetch orders"}
              </button>
              <button type="button" onClick={() => setPageToken("")} disabled={listLoading || !pageToken}>
                Clear token
              </button>
              <button type="button" onClick={fetchNextPage} disabled={listLoading || !listResult?.nextPageToken}>
                Fetch next page
              </button>
            </div>
          </section>

          <section className="admin-wheel-panel">
            <div className="admin-wheel-panel-head">
              <div>
                <p className="admin-wheel-kicker">TikTok Response</p>
                <h2>Orders</h2>
              </div>
              <p>{listResult?.nextPageToken ? `Next token available: ${shorten(listResult.nextPageToken)}` : "No next page token returned."}</p>
            </div>

            {isUnlocked && orders.length > 0 ? (
              <div className="admin-tiktok-table-wrap">
                <table className="admin-tiktok-table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th>Updated</th>
                      <th>Buyer</th>
                      <th>Delivery</th>
                      <th>Shipping</th>
                      <th>Total</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order, index) => (
                      <tr key={order.id || index}>
                        <td>{order.id || "--"}</td>
                        <td>{order.status || "--"}</td>
                        <td>{formatAdminDate(order.createTime)}</td>
                        <td>{formatAdminDate(order.updateTime)}</td>
                        <td>{order.buyerEmail || "--"}</td>
                        <td>{order.deliveryOptionName || "--"}</td>
                        <td>{[order.shippingProvider, order.trackingNumber].filter(Boolean).join(" / ") || "--"}</td>
                        <td>{formatMoney(order.paymentAmount, order.currency)}</td>
                        <td>
                          <div className="admin-tiktok-row-actions">
                            <button type="button" onClick={() => openDetail(order.id)} disabled={!order.id || detailLoading}>
                              View detail
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setPriceOrderId(order.id);
                                setActiveTab("price");
                              }}
                              disabled={!order.id}
                            >
                              Price
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
                <p>{isUnlocked ? "No TikTok orders returned for the selected filters." : "Enter the admin password to load TikTok Shop orders."}</p>
              </section>
            )}
          </section>

          {listResult ? (
            <DebugPanel
              title="Order List Debug"
              response={listResult}
              debugJson={listDebugJson}
              expanded={showListDebug}
              onToggle={() => setShowListDebug((value) => !value)}
              onCopy={copyText}
            />
          ) : null}
        </>
      ) : null}

      {activeTab === "detail" ? (
        <section className="admin-wheel-panel">
          <PanelHeader kicker="Order Detail" title="Inspect one order" copy="Open from the order list or paste an order ID manually." />
          {detailError ? <div className="admin-wheel-alert error">{detailError}</div> : null}
          <div className="admin-tiktok-inline-form">
            <label>
              Order ID
              <input value={selectedOrderId} onChange={(event) => setSelectedOrderId(event.target.value)} />
            </label>
            <button type="button" onClick={() => fetchDetail()} disabled={detailLoading || !hasPassword}>
              {detailLoading ? "Loading" : "Fetch detail"}
            </button>
          </div>
          {detailOrder ? (
            <>
              <SummaryGrid
                items={[
                  ["Order", detailOrder.summary.id],
                  ["Status", detailOrder.summary.status],
                  ["Created", formatAdminDate(detailOrder.summary.createTime)],
                  ["Updated", formatAdminDate(detailOrder.summary.updateTime)],
                  ["Delivery", detailOrder.summary.deliveryOptionName],
                  ["Fulfillment", detailOrder.summary.fulfillmentType ?? ""],
                ]}
              />
              <DataTable
                title="Line items"
                empty="No line items returned."
                headers={["Line item", "Product", "SKU", "Qty", "Status", "Price"]}
                rows={detailOrder.lineItems.map((item) => [
                  item.id,
                  item.productName ?? "",
                  item.skuName ?? "",
                  formatOptionalNumber(item.quantity),
                  item.displayStatus ?? "",
                  formatMoney(item.price ?? "", item.currency ?? ""),
                ])}
              />
              <DataTable
                title="Packages"
                empty="No package data returned."
                headers={["Package", "Delivery", "Carrier", "Tracking"]}
                rows={detailOrder.packages.map((item) => [
                  item.id,
                  item.deliveryOptionName ?? "",
                  item.shippingProvider ?? "",
                  item.trackingNumber ?? "",
                ])}
              />
              <DebugPanel
                title="Order Detail Debug"
                response={detailResult}
                debugJson={detailDebugJson}
                expanded={showDetailDebug}
                onToggle={() => setShowDetailDebug((value) => !value)}
                onCopy={copyText}
              />
            </>
          ) : (
            <section className="admin-wheel-empty"><p>No order detail loaded.</p></section>
          )}
        </section>
      ) : null}

      {activeTab === "price" ? (
        <section className="admin-wheel-panel">
          <PanelHeader kicker="Price Detail" title="Totals and fees" copy="Fetch TikTok price detail without clearing the order list." />
          {priceError ? <div className="admin-wheel-alert error">{priceError}</div> : null}
          <div className="admin-tiktok-inline-form">
            <label>
              Order ID
              <input value={priceOrderId} onChange={(event) => setPriceOrderId(event.target.value)} />
            </label>
            <button type="button" onClick={() => fetchPrice()} disabled={priceLoading || !hasPassword}>
              {priceLoading ? "Loading" : "Fetch price detail"}
            </button>
          </div>
          {priceDetail ? (
            <>
              <SummaryGrid
                items={[
                  ["Order", priceDetail.orderId],
                  ["Currency", priceCurrency],
                  ...priceDetail.totals.map((item) => [item.label, formatMoney(item.amount, priceCurrency)] as [string, string]),
                ]}
              />
              {fallbackPriceLineItems.length > 0 ? (
                <p className="admin-tiktok-muted">Line item prices are shown from Order Detail because Price Detail did not return item amount fields.</p>
              ) : null}
              <DataTable
                title="Line item prices"
                empty="No line item price data returned."
                headers={["Line item", "Product", "SKU", "Qty", "Price"]}
                rows={priceLineItems.map((item) => [
                  item.id,
                  item.productName ?? "",
                  item.skuName ?? "",
                  formatOptionalNumber(item.quantity),
                  formatMoney(item.price ?? "", item.currency ?? priceCurrency),
                ])}
              />
              <DebugPanel
                title="Price Detail Debug"
                response={priceResult}
                debugJson={priceDebugJson}
                expanded={showPriceDebug}
                onToggle={() => setShowPriceDebug((value) => !value)}
                onCopy={copyText}
              />
            </>
          ) : (
            <section className="admin-wheel-empty"><p>No price detail loaded.</p></section>
          )}
        </section>
      ) : null}

      {activeTab === "references" ? (
        <section className="admin-wheel-panel">
          <PanelHeader kicker="References" title="External order references" copy="Add, fetch, or search external references with isolated request state." />
          {referenceError ? <div className="admin-wheel-alert error">{referenceError}</div> : null}
          <div className="admin-tiktok-reference-grid">
            <label>
              Order ID
              <input value={referenceOrderId} onChange={(event) => setReferenceOrderId(event.target.value)} />
            </label>
            <label>
              External reference
              <input value={externalReference} onChange={(event) => setExternalReference(event.target.value)} />
            </label>
            <button type="button" onClick={addReference} disabled={referenceLoading || !hasPassword}>
              Add reference
            </button>
            <button type="button" onClick={getReferences} disabled={referenceLoading || !hasPassword}>
              Get references
            </button>
            <button type="button" onClick={searchByReference} disabled={referenceLoading || !hasPassword}>
              Search order
            </button>
          </div>
          <p className="admin-tiktok-muted">{referenceMode}</p>
          {referenceResult ? (
            <>
              <DataTable
                title="Reference results"
                empty="No references returned."
                headers={["Order", "External reference", "Created", "Updated"]}
                rows={referenceRows.map((item) => [
                  item.orderId ?? "",
                  item.externalReference ?? "",
                  formatAdminDate(item.createdAt ?? ""),
                  formatAdminDate(item.updatedAt ?? ""),
                ])}
              />
              <DebugPanel
                title="Reference Debug"
                response={referenceResult}
                debugJson={referenceDebugJson}
                expanded
                onToggle={() => undefined}
                onCopy={copyText}
              />
            </>
          ) : null}
        </section>
      ) : null}

      {activeTab === "console" ? (
        <section className="admin-wheel-panel">
          <PanelHeader kicker="Raw API Console" title="Signed order endpoint test" copy="Only /order/ TikTok Shop paths are accepted by the Edge Function." />
          {consoleError ? <div className="admin-wheel-alert error">{consoleError}</div> : null}
          <div className="admin-tiktok-console-grid">
            <label>
              Method
              <select value={consoleMethod} onChange={(event) => setConsoleMethod(event.target.value as "GET" | "POST")}>
                <option value="GET">GET</option>
                <option value="POST">POST</option>
              </select>
            </label>
            <label className="admin-tiktok-wide">
              Path
              <input value={consolePath} onChange={(event) => setConsolePath(event.target.value)} />
            </label>
            <label>
              Query JSON
              <textarea value={consoleQueryJson} onChange={(event) => setConsoleQueryJson(event.target.value)} />
            </label>
            <label>
              Body JSON
              <textarea value={consoleBodyJson} onChange={(event) => setConsoleBodyJson(event.target.value)} />
            </label>
          </div>
          <label className="admin-tiktok-check">
            <input
              type="checkbox"
              checked={consoleMutationConfirmed}
              onChange={(event) => setConsoleMutationConfirmed(event.target.checked)}
            />
            I understand this may update TikTok Shop data.
          </label>
          <div className="admin-tiktok-actions">
            <button type="button" onClick={sendRawRequest} disabled={consoleLoading || !hasPassword}>
              {consoleLoading ? "Sending" : "Send raw request"}
            </button>
          </div>
          {consoleResult ? (
            <DebugPanel
              title="Raw API Result"
              response={consoleResult}
              debugJson={consoleDebugJson}
              expanded
              onToggle={() => undefined}
              onCopy={copyText}
            />
          ) : null}
        </section>
      ) : null}
    </main>
  );
}

function PanelHeader({ kicker, title, copy }: { kicker: string; title: string; copy: string }) {
  return (
    <div className="admin-wheel-panel-head">
      <div>
        <p className="admin-wheel-kicker">{kicker}</p>
        <h2>{title}</h2>
      </div>
      <p>{copy}</p>
    </div>
  );
}

function SummaryGrid({ items }: { items: Array<[string, string | undefined]> }) {
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

function DataTable({ title, empty, headers, rows }: { title: string; empty: string; headers: string[]; rows: string[][] }) {
  return (
    <section className="admin-tiktok-subsection">
      <h3>{title}</h3>
      {rows.length > 0 ? (
        <div className="admin-tiktok-table-wrap">
          <table className="admin-tiktok-table compact">
            <thead>
              <tr>
                {headers.map((header) => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={`${row[0]}-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <td key={`${cell}-${cellIndex}`}>{cell || "--"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <section className="admin-wheel-empty small"><p>{empty}</p></section>
      )}
    </section>
  );
}

function DebugPanel({
  title,
  response,
  debugJson,
  expanded,
  onToggle,
  onCopy,
}: {
  title: string;
  response: { raw: unknown };
  debugJson: string;
  expanded: boolean;
  onToggle: () => void;
  onCopy: (value: string, label: string) => void;
}) {
  const rawJson = JSON.stringify(response.raw, null, 2);

  return (
    <section className="admin-wheel-panel admin-tiktok-debug-panel">
      <div className="admin-wheel-panel-head">
        <div>
          <p className="admin-wheel-kicker">Developer debug</p>
          <h2>{title}</h2>
        </div>
        <button type="button" onClick={onToggle}>
          {expanded ? "Hide debug" : "Show debug"}
        </button>
      </div>
      {expanded ? (
        <div className="admin-tiktok-debug-grid">
          <article className="admin-tiktok-debug-box">
            <div>
              <strong>Request metadata</strong>
              <button type="button" onClick={() => onCopy(debugJson, "Debug metadata")}>Copy</button>
            </div>
            <pre>{debugJson}</pre>
          </article>
          <article className="admin-tiktok-debug-box">
            <div>
              <strong>Raw response</strong>
              <button type="button" onClick={() => onCopy(rawJson, "Raw response")}>Copy</button>
            </div>
            <pre>{rawJson}</pre>
          </article>
        </div>
      ) : null}
    </section>
  );
}

function useDebugJson(response: { debug: unknown; raw: unknown } | null) {
  return useMemo(() => {
    if (!response) return "";
    return JSON.stringify({ request: response.debug }, null, 2);
  }, [response]);
}

function getDefaultDateRange() {
  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  return {
    start: toDatetimeLocal(start),
    end: toDatetimeLocal(end),
  };
}

function toDatetimeLocal(date: Date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

function toUnixSeconds(value: string) {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return undefined;
  return Math.floor(time / 1000);
}

function formatAdminDate(value: string) {
  if (!value) return "--";
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

function formatMoney(amount: string, currency: string) {
  if (!amount && !currency) return "--";
  return [currency, amount].filter(Boolean).join(" ");
}

function formatOptionalNumber(value: number | undefined) {
  return typeof value === "number" ? String(value) : "";
}

function shorten(value: string) {
  if (value.length <= 18) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function parseJsonRecord(value: string, label: string) {
  const cleanValue = value.trim();
  if (!cleanValue) return {};
  const parsed = JSON.parse(cleanValue) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object.`);
  }
  return parsed as Record<string, unknown>;
}

function parseJsonStringRecord(value: string, label: string) {
  const parsed = parseJsonRecord(value, label);
  return Object.fromEntries(Object.entries(parsed).map(([key, rawValue]) => [key, String(rawValue)]));
}
