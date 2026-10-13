"use client";

import { useEffect, useState, type FormEvent } from "react";
import Header from "@/components/Header";
import { adminLogin, checkAdminSession } from "@/lib/api";
import {
  isPromoLive,
  promoPerCap,
  promoPrice,
  SHOP_IMAGES,
  type Product,
  type ProductStatus,
  type Promo,
} from "@/lib/catalog";

type AdminProduct = Product & { updatedAt: string };

const peso = (value: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(value);

const STATUS_TABS: { value: ProductStatus; label: string; help: string }[] = [
  { value: "active", label: "Active", help: "In the shop and can be bought." },
  { value: "hidden", label: "Hidden", help: "Not in the shop. Still in promos - easy to bring back." },
  { value: "archived", label: "Archived", help: "Retired. Not in the shop or the promo picker. Never deleted." },
];

const GROUPS: { kind: Product["kind"]; label: string }[] = [
  { kind: "protocol", label: "Full Protocol" },
  { kind: "trial", label: "Try First" },
];

async function request<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed.");
  return data as T;
}

export default function AdminProductsPage() {
  const [password, setPassword] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [drafts, setDrafts] = useState<Record<string, AdminProduct>>({});
  const [tab, setTab] = useState<ProductStatus>("active");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    checkAdminSession().then((authenticated) => {
      if (authenticated) load();
    });
  }, []);

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      const [productData, promoData] = await Promise.all([
        request<{ products: AdminProduct[] }>("/api/admin/products"),
        request<{ promos: Promo[] }>("/api/admin/promos"),
      ]);
      setProducts(productData.products);
      setPromos(promoData.promos);
      setDrafts({});
      setIsUnlocked(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load products.");
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

  function edit(product: AdminProduct, patch: Partial<AdminProduct>) {
    setDrafts((current) => ({ ...current, [product.id]: { ...(current[product.id] ?? product), ...patch } }));
  }

  async function save(product: AdminProduct, draft: AdminProduct) {
    if (
      draft.price !== product.price &&
      !window.confirm(
        `Change ${product.name} from ${peso(product.price)} to ${peso(draft.price)}?\n\n` +
          "Customers with an unpaid order at the old price will be asked to rebuild their basket.",
      )
    ) {
      return;
    }
    setSavingId(product.id);
    setError(null);
    setNotice(null);
    try {
      const { product: saved } = await request<{ product: AdminProduct }>("/api/admin/products", draft);
      setProducts((current) => current.map((row) => (row.id === saved.id ? saved : row)));
      setDrafts((current) => {
        const next = { ...current };
        delete next[product.id];
        return next;
      });
      setNotice(
        saved.status === product.status
          ? `${saved.name} saved.`
          : `${saved.name} is now ${saved.status}.`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save product.");
    } finally {
      setSavingId(null);
    }
  }

  const now = new Date();
  const livePromos = promos.filter((promo) => isPromoLive(promo, now));
  const counts = Object.fromEntries(
    STATUS_TABS.map(({ value }) => [value, products.filter((product) => product.status === value).length]),
  ) as Record<ProductStatus, number>;

  return (
    <main className="admin-wheel-shell admin-shop-orders-shell">
      <Header dateLabel="Shop Products" />

      <section className="admin-wheel-hero">
        <div>
          <p className="admin-wheel-kicker">GutGuard Shop</p>
          <h1>
            Products
            <br />
            <em>Admin</em>
          </h1>
        </div>
        <div className="admin-wheel-summary" aria-live="polite">
          <span>{isUnlocked ? "visible" : "locked"}</span>
          <strong>{counts.active ?? 0}</strong>
          <span>active in shop</span>
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

      {notice ? <div className="admin-wheel-alert">{notice}</div> : null}
      {error ? <div className="admin-wheel-alert error">{error}</div> : null}

      {isUnlocked ? (
        <section className="admin-wheel-panel">
          <div className="admin-wheel-panel-head">
            <div>
              <p className="admin-wheel-kicker">Catalog</p>
              <h2>Shop products</h2>
            </div>
            <p>
              Price is what checkout charges. Price per capsule is what the shop shows - type it in, it is not
              calculated. Products are never deleted: hide or archive them instead.
            </p>
          </div>

          <div className="admin-product-tabs" role="tablist" aria-label="Product status">
            {STATUS_TABS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                className={tab === value ? "active" : ""}
                onClick={() => setTab(value)}
              >
                {label} ({counts[value] ?? 0})
              </button>
            ))}
          </div>
          <p className="admin-product-tab-help">{STATUS_TABS.find(({ value }) => value === tab)?.help}</p>

          {GROUPS.map(({ kind, label }) => {
            const rows = products.filter((product) => product.kind === kind && product.status === tab);
            if (rows.length === 0) return null;
            return (
              <div className="admin-product-group" key={kind}>
                <h3>{label}</h3>
                <div className="admin-wheel-list">
                  {rows.map((product) => {
                    const draft = drafts[product.id] ?? product;
                    const dirty = drafts[product.id] !== undefined;
                    return (
                      <form
                        className="admin-wheel-prize admin-product-card"
                        key={product.id}
                        onSubmit={(event) => {
                          event.preventDefault();
                          save(product, draft);
                        }}
                      >
                        <div className="admin-wheel-prize-main">
                          <label>
                            Name
                            <input value={draft.name} onChange={(event) => edit(product, { name: event.target.value })} required />
                          </label>
                          <div className="admin-wheel-grid">
                            <label>
                              Price (₱)
                              <input
                                type="number"
                                min={1}
                                value={draft.price || ""}
                                onChange={(event) => edit(product, { price: Math.round(Number(event.target.value)) })}
                                required
                              />
                            </label>
                            <label>
                              Price per capsule (₱)
                              <input
                                type="number"
                                min={1}
                                value={draft.perCap || ""}
                                onChange={(event) => edit(product, { perCap: Math.round(Number(event.target.value)) })}
                                required
                              />
                            </label>
                            <label>
                              Capsules
                              <input
                                type="number"
                                min={1}
                                value={draft.caps || ""}
                                onChange={(event) => edit(product, { caps: Math.round(Number(event.target.value)) })}
                                required
                              />
                            </label>
                          </div>
                          <div className="admin-wheel-grid">
                            {kind === "protocol" ? (
                              <>
                                <label>
                                  Phase label
                                  <input
                                    value={draft.phase}
                                    placeholder="30-day"
                                    onChange={(event) => edit(product, { phase: event.target.value })}
                                  />
                                </label>
                                <label>
                                  Tag (optional)
                                  <input
                                    value={draft.tag}
                                    placeholder="Popular"
                                    onChange={(event) => edit(product, { tag: event.target.value })}
                                  />
                                </label>
                              </>
                            ) : (
                              <label>
                                Image
                                <select value={draft.image} onChange={(event) => edit(product, { image: event.target.value })}>
                                  {SHOP_IMAGES.map((image) => (
                                    <option key={image} value={image}>
                                      {image.replace("/shop/", "")}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            )}
                            <label>
                              Display order
                              <input
                                type="number"
                                value={draft.sortOrder}
                                onChange={(event) => edit(product, { sortOrder: Math.round(Number(event.target.value)) })}
                              />
                            </label>
                          </div>
                          {kind === "protocol" ? (
                            <>
                              <label>
                                Dosage line (on the card)
                                <input
                                  value={draft.dosage}
                                  placeholder="2–4 capsules a day"
                                  onChange={(event) => edit(product, { dosage: event.target.value })}
                                />
                              </label>
                              <label>
                                What&apos;s included (one per line, shown when selected)
                                <textarea
                                  value={draft.includes.join("\n")}
                                  placeholder={"SynBIOTIC+ (330 capsules)\nLifestyle Protocol"}
                                  onChange={(event) => edit(product, { includes: event.target.value.split("\n") })}
                                />
                              </label>
                              <label>
                                Note under the included list
                                <input
                                  value={draft.includesNote}
                                  placeholder="Lower rate for completing the full 90 days."
                                  onChange={(event) => edit(product, { includesNote: event.target.value })}
                                />
                              </label>
                            </>
                          ) : null}
                        </div>

                        <div className="admin-product-preview" aria-live="polite">
                          <p className="admin-wheel-kicker">Shop preview</p>
                          <p>
                            <strong>{peso(draft.price)}</strong> · {peso(draft.perCap)}/cap · {draft.caps} capsules
                          </p>
                          {livePromos
                            .filter((promo) => promo.discounts[product.id])
                            .map((promo) => {
                              const pricing = promoPrice(product.id, draft.price, [promo], now);
                              const winning = promoPrice(product.id, draft.price, livePromos, now).promo?.id === promo.id;
                              return (
                                <p key={promo.id} className={winning ? "winning" : ""}>
                                  With {promo.name} ({pricing.percent}%): <strong>{peso(pricing.price)}</strong> ·{" "}
                                  {peso(promoPerCap(draft, pricing))}/cap
                                  {winning ? " - showing now" : ""}
                                </p>
                              );
                            })}
                          <small>
                            ID <code>{product.id}</code> · last changed{" "}
                            {product.updatedAt ? new Date(product.updatedAt).toLocaleString("en-PH") : "never"}
                          </small>
                        </div>

                        <div className="admin-wheel-prize-footer">
                          <label>
                            Status
                            <select
                              value={draft.status}
                              onChange={(event) => edit(product, { status: event.target.value as ProductStatus })}
                            >
                              {STATUS_TABS.map(({ value, label: statusLabel }) => (
                                <option key={value} value={value}>
                                  {statusLabel}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button
                            type="button"
                            disabled={!dirty || savingId === product.id}
                            onClick={() =>
                              setDrafts((current) => {
                                const next = { ...current };
                                delete next[product.id];
                                return next;
                              })
                            }
                          >
                            Undo
                          </button>
                          <button type="submit" disabled={!dirty || savingId === product.id}>
                            {savingId === product.id ? "Saving" : "Save"}
                          </button>
                        </div>
                      </form>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {counts[tab] ? null : <p className="admin-wheel-empty">No {tab} products.</p>}
        </section>
      ) : null}
    </main>
  );
}
