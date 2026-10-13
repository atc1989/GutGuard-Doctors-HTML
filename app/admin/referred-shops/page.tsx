"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Header from "@/components/Header";
import { adminLogin, checkAdminSession } from "@/lib/api";
import type { AdminShop } from "@/app/api/admin/referred-shops/route";

const peso = (value: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(value);
const day = (value: string) =>
  new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));

const STORE_TYPES: Record<string, string> = { main: "Main Store", lifestyle: "Lifestyle", affiliate: "Affiliate" };
const storeLabel = (type: string) => STORE_TYPES[type] ?? type;

type Sort = "newest" | "sales" | "orders" | "name";

/** RFC 4180 quoting, so addresses with commas stay in one cell in Excel. */
function toCsv(shops: AdminShop[]) {
  const header = ["Shop / owner", "Clinic address", "Mobile", "Email", "Store type", "Referred by", "Main store", "Joined", "Orders", "Paid sales (PHP)"];
  const rows = shops.map((shop) => [
    shop.name,
    shop.address,
    shop.mobile,
    shop.email,
    storeLabel(shop.storeType),
    shop.referrerName || "Direct sign-up",
    shop.mainStoreName,
    shop.joinedAt.slice(0, 10),
    String(shop.orders),
    String(shop.sales),
  ]);
  return [header, ...rows].map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\r\n");
}

export default function AdminReferredShopsPage() {
  const [password, setPassword] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [shops, setShops] = useState<AdminShop[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [referrer, setReferrer] = useState("all");
  const [storeType, setStoreType] = useState("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [grouped, setGrouped] = useState(false);

  useEffect(() => {
    checkAdminSession().then((authenticated) => {
      if (authenticated) load();
    });
  }, []);

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/referred-shops");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not load shops.");
      setShops(data.shops);
      setIsUnlocked(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load shops.");
      setIsUnlocked(false);
    } finally {
      setIsLoading(false);
    }
  }

  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await adminLogin(password);
      setPassword("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not unlock.");
    }
  }

  const referrers = useMemo(() => {
    const names = new Map<string, string>();
    for (const shop of shops) if (shop.referrerId) names.set(shop.referrerId, shop.referrerName || "Unnamed partner");
    return [...names.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [shops]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = shops.filter((shop) => {
      if (storeType !== "all" && shop.storeType !== storeType) return false;
      if (referrer === "direct" && shop.referrerId) return false;
      if (referrer === "referred" && !shop.referrerId) return false;
      if (!["all", "direct", "referred"].includes(referrer) && shop.referrerId !== referrer) return false;
      if (!q) return true;
      return [shop.name, shop.address, shop.referrerName, shop.mobile, shop.email].some((field) =>
        field.toLowerCase().includes(q),
      );
    });
    return list.sort((a, b) => {
      if (sort === "sales") return b.sales - a.sales;
      if (sort === "orders") return b.orders - a.orders;
      if (sort === "name") return a.name.localeCompare(b.name);
      return b.joinedAt.localeCompare(a.joinedAt);
    });
  }, [shops, search, referrer, storeType, sort]);

  // Group view: referrer -> their shops, biggest network first; direct sign-ups last.
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; shops: AdminShop[] }>();
    for (const shop of visible) {
      const key = shop.referrerId ?? "direct";
      const entry = map.get(key) ?? { name: shop.referrerName || (shop.referrerId ? "Unnamed partner" : "Direct sign-up"), shops: [] };
      entry.shops.push(shop);
      map.set(key, entry);
    }
    return [...map.entries()].sort(([a, x], [b, y]) =>
      a === "direct" ? 1 : b === "direct" ? -1 : y.shops.length - x.shops.length,
    );
  }, [visible]);

  function downloadCsv() {
    // BOM so Excel reads ₱ and ñ in addresses correctly.
    const blob = new Blob(["﻿" + toCsv(visible)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `gutguard-shops-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const referredCount = shops.filter((shop) => shop.referrerId).length;
  const totals = visible.reduce((sum, shop) => ({ orders: sum.orders + shop.orders, sales: sum.sales + shop.sales }), {
    orders: 0,
    sales: 0,
  });

  const table = (rows: AdminShop[]) => (
    <div className="admin-shops-table-wrap">
      <table className="admin-shops-table">
        <thead>
          <tr>
            <th>Shop / owner</th>
            <th>Clinic address</th>
            <th>Contact</th>
            <th>Store type</th>
            <th>Referred by</th>
            <th>Main store</th>
            <th>Joined</th>
            <th className="num">Orders</th>
            <th className="num">Paid sales</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((shop) => (
            <tr key={shop.id}>
              <td>
                <strong>{shop.name || "Unnamed partner"}</strong>
                {shop.specialty ? <small>{shop.specialty}</small> : null}
              </td>
              <td>{shop.address || "--"}</td>
              <td>
                {shop.mobile || "--"}
                {shop.email ? <small>{shop.email}</small> : null}
              </td>
              <td>{storeLabel(shop.storeType)}</td>
              <td>
                {shop.referrerName || <span className="muted">Direct sign-up</span>}
                {shop.referrerStoreType ? <small>{storeLabel(shop.referrerStoreType)}</small> : null}
              </td>
              <td>{shop.mainStoreName || "--"}</td>
              <td>{day(shop.joinedAt)}</td>
              <td className="num">{shop.orders}</td>
              <td className="num">{peso(shop.sales)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <main className="admin-wheel-shell admin-shop-orders-shell">
      <Header dateLabel="Referred Shops" />

      <section className="admin-wheel-hero">
        <div>
          <p className="admin-wheel-kicker">GutGuard Partners</p>
          <h1>
            Shops
            <br />
            <em>Admin</em>
          </h1>
        </div>
        <div className="admin-wheel-summary" aria-live="polite">
          <span>{isUnlocked ? "visible" : "locked"}</span>
          <strong>{shops.length}</strong>
          <span>{referredCount} referred</span>
        </div>
      </section>

      {isUnlocked ? null : (
        <form className="admin-wheel-auth admin-tiktok-auth" onSubmit={unlock}>
          <label htmlFor="admin-password">Admin password</label>
          <div className="admin-wheel-auth-row">
            <input
              className="admin-hidden-username"
              type="text"
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
            <button type="submit" disabled={isLoading || !password.trim()}>
              {isLoading ? "Loading" : "Unlock"}
            </button>
          </div>
        </form>
      )}

      {error ? <div className="admin-wheel-alert error">{error}</div> : null}

      {isUnlocked ? (
        <section className="admin-wheel-panel">
          <div className="admin-wheel-panel-head">
            <div>
              <p className="admin-wheel-kicker">Directory</p>
              <h2>All shops</h2>
            </div>
            <p>
              Every partner shop with its owner, clinic address and who referred it. Orders count every order through
              the shop&apos;s own link; paid sales count paid orders only - the same numbers partners see.
            </p>
          </div>

          <div className="admin-shops-toolbar">
            <label>
              Search
              <input
                type="search"
                value={search}
                placeholder="Name, address, referrer, mobile"
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <label>
              Referred by
              <select value={referrer} onChange={(event) => setReferrer(event.target.value)}>
                <option value="all">Everyone</option>
                <option value="referred">Referred shops only</option>
                <option value="direct">Direct sign-ups only</option>
                {referrers.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Store type
              <select value={storeType} onChange={(event) => setStoreType(event.target.value)}>
                <option value="all">All types</option>
                {Object.entries(STORE_TYPES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Sort
              <select value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
                <option value="newest">Newest first</option>
                <option value="sales">Highest sales</option>
                <option value="orders">Most orders</option>
                <option value="name">Name A-Z</option>
              </select>
            </label>
          </div>

          <div className="admin-shops-actions">
            <label className="admin-wheel-toggle">
              <input type="checkbox" checked={grouped} onChange={(event) => setGrouped(event.target.checked)} />
              Group by referrer
            </label>
            <span>
              {visible.length} shops · {totals.orders} orders · {peso(totals.sales)} paid sales
            </span>
            <button type="button" onClick={downloadCsv} disabled={visible.length === 0}>
              Download CSV
            </button>
          </div>

          {visible.length === 0 ? (
            <p className="admin-wheel-empty">No shops match.</p>
          ) : grouped ? (
            groups.map(([key, group]) => (
              <div className="admin-shops-group" key={key}>
                <h3>
                  {group.name} <span>· {group.shops.length} shops</span>
                </h3>
                {table(group.shops)}
              </div>
            ))
          ) : (
            table(visible)
          )}
        </section>
      ) : null}
    </main>
  );
}
