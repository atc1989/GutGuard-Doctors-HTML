"use client";

import { FormEvent, useMemo, useState } from "react";
import Header from "@/components/Header";
import { getTikTokOrders, type TikTokOrdersFilters, type TikTokOrdersResponse } from "@/lib/api";

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

export default function AdminTikTokPage() {
  const defaultRange = useMemo(() => getDefaultDateRange(), []);
  const [password, setPassword] = useState("");
  const [timeMode, setTimeMode] = useState<TikTokOrdersFilters["timeMode"]>("create_time");
  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);
  const [orderStatus, setOrderStatus] = useState("");
  const [pageSize, setPageSize] = useState(20);
  const [pageToken, setPageToken] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<TikTokOrdersResponse | null>(null);

  const orders = result?.orders ?? [];
  const rawJson = useMemo(() => (result ? JSON.stringify(result.raw, null, 2) : ""), [result]);
  const debugJson = useMemo(() => {
    if (!result) return "";
    return JSON.stringify(
      {
        request: result.debug,
        totalCount: result.totalCount,
        visibleOrders: result.orders.length,
        nextPageToken: result.nextPageToken,
      },
      null,
      2,
    );
  }, [result]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await fetchOrders();
  }

  async function fetchOrders(overrides: Partial<TikTokOrdersFilters> = {}) {
    setIsLoading(true);
    setError(null);
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
      setResult(response);
      setIsUnlocked(true);
      setPageToken(filters.pageToken ?? "");
      setNotice(`Loaded ${response.orders.length} TikTok order${response.orders.length === 1 ? "" : "s"}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "TikTok order request failed.");
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchNextPage() {
    if (!result?.nextPageToken) return;
    const nextToken = result.nextPageToken;
    setPageToken(nextToken);
    await fetchOrders({ pageToken: nextToken });
  }

  async function copyText(value: string, label: string) {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      setNotice(`${label} copied.`);
    } catch {
      setError(`${label} could not be copied.`);
    }
  }

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
          <strong>{result?.totalCount ?? orders.length}</strong>
          <span>{result?.totalCount === null ? "returned orders" : "total count"}</span>
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
          <button type="submit" disabled={isLoading || password.trim().length === 0}>
            {isLoading ? "Loading" : isUnlocked ? "Refresh orders" : "Unlock"}
          </button>
        </div>
      </form>

      {error ? <div className="admin-wheel-alert error">{error}</div> : null}
      {notice ? <div className="admin-wheel-alert">{notice}</div> : null}

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
            <input
              value={pageToken}
              placeholder="Optional token from previous response"
              onChange={(event) => setPageToken(event.target.value)}
            />
          </label>
        </div>

        <div className="admin-tiktok-actions">
          <button type="button" onClick={() => fetchOrders({ pageToken: undefined })} disabled={isLoading || password.trim().length === 0}>
            {isLoading ? "Loading" : "Fetch orders"}
          </button>
          <button type="button" onClick={() => setPageToken("")} disabled={isLoading || !pageToken}>
            Clear token
          </button>
          <button type="button" onClick={fetchNextPage} disabled={isLoading || !result?.nextPageToken}>
            Fetch next page
          </button>
        </div>
      </section>

      {isUnlocked ? (
        <section className="admin-wheel-panel">
          <div className="admin-wheel-panel-head">
            <div>
              <p className="admin-wheel-kicker">TikTok Response</p>
              <h2>Orders</h2>
            </div>
            <p>{result?.nextPageToken ? `Next token available: ${shorten(result.nextPageToken)}` : "No next page token returned."}</p>
          </div>

          {orders.length > 0 ? (
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
                      <td>
                        {[order.shippingProvider, order.trackingNumber].filter(Boolean).join(" / ") || "--"}
                      </td>
                      <td>{formatMoney(order.paymentAmount, order.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <section className="admin-wheel-empty">
              <p>No TikTok orders returned for the selected filters.</p>
            </section>
          )}
        </section>
      ) : (
        <section className="admin-wheel-empty">
          <p>Enter the admin password to load TikTok Shop orders.</p>
        </section>
      )}

      {result ? (
        <section className="admin-wheel-panel">
          <div className="admin-wheel-panel-head">
            <div>
              <p className="admin-wheel-kicker">Debug</p>
              <h2>Request and Raw JSON</h2>
            </div>
            <p>Debug request metadata is sanitized before it reaches the browser.</p>
          </div>

          <div className="admin-tiktok-debug-grid">
            <article className="admin-tiktok-debug-box">
              <div>
                <strong>Request metadata</strong>
                <button type="button" onClick={() => copyText(debugJson, "Debug metadata")}>
                  Copy
                </button>
              </div>
              <pre>{debugJson}</pre>
            </article>
            <article className="admin-tiktok-debug-box">
              <div>
                <strong>Raw response</strong>
                <button type="button" onClick={() => copyText(rawJson, "Raw response")}>
                  Copy
                </button>
              </div>
              <pre>{rawJson}</pre>
            </article>
          </div>
        </section>
      ) : null}
    </main>
  );
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

function shorten(value: string) {
  if (value.length <= 18) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}
