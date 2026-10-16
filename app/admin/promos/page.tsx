"use client";

import { useEffect, useState, type FormEvent } from "react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { adminLogin, checkAdminSession } from "@/lib/api";
import {
  discountedPrice,
  formatPromoDay,
  manilaDate,
  MAX_PROMO_PERCENT,
  promoStatus,
  type Product,
  type Promo,
} from "@/lib/catalog";

const productLabel = (product: Product) =>
  `${product.name}${product.phase ? ` (${product.phase})` : ""}${product.status === "active" ? "" : ` - ${product.status}`}`;

const peso = (value: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(value);

const emptyDraft = (): Promo => ({
  id: "",
  name: "",
  label: "",
  starts_on: manilaDate(new Date()),
  ends_on: null,
  enabled: true,
  discounts: {},
  prices: {},
  perCap: {},
});

async function request<T>(method: string, body?: unknown, query = ""): Promise<T> {
  const res = await fetch(`/api/admin/promos${query}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed.");
  return data as T;
}

export default function AdminPromosPage() {
  const [loaded, setLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  // Archived products leave the picker, unless a promo being edited still has them.
  const pickable = products
    .filter((product) => product.status !== "archived" || draft?.discounts[product.id] !== undefined)
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.sortOrder - b.sortOrder);
  const [draft, setDraft] = useState<Promo | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // AdminShell only renders this page once the admin session is valid.
  useEffect(() => {
    loadPromos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadPromos() {
    setIsLoading(true);
    setError(null);
    try {
      const data = await request<{ promos: Promo[]; products: Product[] }>("GET");
      setPromos(data.promos);
      setProducts(data.products);
      setLoaded(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load promos.");
    } finally {
      setIsLoading(false);
    }
  }


  async function save(promo: Promo, message: string) {
    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      const { promo: saved } = await request<{ promo: Promo }>("POST", promo);
      setPromos((current) =>
        current.some((row) => row.id === saved.id)
          ? current.map((row) => (row.id === saved.id ? saved : row))
          : [saved, ...current],
      );
      setNotice(message);
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save promo.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function submitDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft && (await save(draft, `${draft.name.trim()} saved.`))) setDraft(null);
  }

  async function remove(promo: Promo) {
    if (!window.confirm(`Delete "${promo.name}"? Shop prices update immediately.`)) return;
    setError(null);
    try {
      await request("DELETE", undefined, `?id=${encodeURIComponent(promo.id)}`);
      setPromos((current) => current.filter((row) => row.id !== promo.id));
      setNotice(`${promo.name} deleted.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete promo.");
    }
  }

  function setPercent(productId: string, value: string | null) {
    if (!draft) return;
    const discounts = { ...draft.discounts };
    const prices = { ...draft.prices };
    const perCap = { ...draft.perCap };
    if (value === null) {
      delete discounts[productId];
      delete prices[productId];
      delete perCap[productId];
    } else discounts[productId] = Math.min(Math.max(Math.round(Number(value) || 0), 0), MAX_PROMO_PERCENT);
    setDraft({ ...draft, discounts, prices, perCap });
  }

  /**
   * Final price or promo per-capsule. Blank = use the calculation, which is what the field
   * shows as its placeholder, and keeps following the % if it changes.
   */
  function setTyped(field: "prices" | "perCap", productId: string, value: string) {
    if (!draft) return;
    const typed = { ...draft[field] };
    const pesos = Math.round(Number(value));
    if (!value || !pesos || pesos < 1) delete typed[productId];
    else typed[productId] = pesos;
    setDraft({ ...draft, [field]: typed });
  }

  const now = new Date();
  const live = promos.filter((promo) => promoStatus(promo, now) === "Live").length;

  return (
    <div className="admin-wheel-shell admin-shop-orders-shell">
      <AdminPageHeader kicker="GutGuard shop" title="Promotions" description="Scheduled price promotions and the packages they apply to." />


      {notice ? <div className="admin-wheel-alert">{notice}</div> : null}
      {error ? <div className="admin-wheel-alert error">{error}</div> : null}

      {loaded ? (
        <section className="admin-wheel-panel">
          <div className="admin-wheel-panel-head">
            <div>
              <p className="admin-wheel-kicker">Discounts</p>
              <h2>Shop promos</h2>
            </div>
            <p>
              Dates are Philippine time; a promo runs until 11:59 PM on its end date. When promos overlap, each
              product gets the biggest discount - they never add up.
            </p>
          </div>

          {draft ? (
            <form className="admin-wheel-prize admin-promo-editor" onSubmit={submitDraft}>
              <div className="admin-wheel-prize-main">
                <label>
                  Promo name
                  <input
                    value={draft.name}
                    placeholder="Holiday Promo"
                    onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                    required
                  />
                </label>
                <label>
                  Shop label (optional, shown to customers)
                  <input
                    value={draft.label}
                    placeholder="Holiday Sale"
                    onChange={(event) => setDraft({ ...draft, label: event.target.value })}
                  />
                </label>
                <div className="admin-wheel-grid admin-promo-dates">
                  <label>
                    Starts
                    <input
                      type="date"
                      value={draft.starts_on}
                      onChange={(event) => setDraft({ ...draft, starts_on: event.target.value })}
                      required
                    />
                  </label>
                  <label>
                    Ends (blank = no end)
                    <input
                      type="date"
                      value={draft.ends_on ?? ""}
                      min={draft.starts_on}
                      onChange={(event) => setDraft({ ...draft, ends_on: event.target.value || null })}
                    />
                  </label>
                </div>
              </div>

              <div className="admin-promo-products">
                <div className="admin-promo-product admin-promo-product-head" aria-hidden="true">
                  <span>Product</span>
                  <span>Discount</span>
                  <span>Final price</span>
                  <span>Promo ₱/cap</span>
                  <span>Shop shows</span>
                </div>
                {pickable.map((product) => {
                  const pct = draft.discounts[product.id];
                  const chosen = pct !== undefined;
                  const calculatedPerCap = discountedPrice(product.perCap, pct || 0);
                  const calculatedPrice = discountedPrice(product.price, pct || 0);
                  return (
                    <div className="admin-promo-product" key={product.id}>
                      <label className="admin-wheel-toggle">
                        <input
                          type="checkbox"
                          checked={chosen}
                          onChange={(event) => setPercent(product.id, event.target.checked ? "10" : null)}
                        />
                        {productLabel(product)}
                      </label>
                      {chosen ? (
                        <>
                          <label className="admin-promo-percent">
                            <input
                              type="number"
                              min={1}
                              max={MAX_PROMO_PERCENT}
                              value={pct || ""}
                              aria-label={`${product.name} discount percent`}
                              onChange={(event) => setPercent(product.id, event.target.value)}
                            />
                            %
                          </label>
                          <label className="admin-promo-final">
                            ₱
                            <input
                              type="number"
                              min={1}
                              max={product.price - 1}
                              value={draft.prices[product.id] ?? ""}
                              placeholder={String(calculatedPrice)}
                              title={`Blank uses the calculation: ₱${product.price} less ${pct || 0}% = ₱${calculatedPrice}. This is what checkout charges.`}
                              aria-label={`${product.name} promo final price`}
                              onChange={(event) => setTyped("prices", product.id, event.target.value)}
                            />
                          </label>
                          <label className="admin-promo-percap">
                            ₱
                            <input
                              type="number"
                              min={1}
                              value={draft.perCap[product.id] ?? ""}
                              placeholder={String(calculatedPerCap)}
                              title={`Blank uses the calculation: ₱${product.perCap} less ${pct || 0}% = ₱${calculatedPerCap}`}
                              aria-label={`${product.name} promo price per capsule`}
                              onChange={(event) => setTyped("perCap", product.id, event.target.value)}
                            />
                          </label>
                          <span className="admin-promo-preview">
                            {peso(product.price)} → <strong>{peso(draft.prices[product.id] || calculatedPrice)}</strong>
                            <small>
                              {peso(product.perCap)} → {peso(draft.perCap[product.id] || calculatedPerCap)} /cap
                            </small>
                          </span>
                        </>
                      ) : (
                        <span className="admin-promo-preview">
                          {peso(product.price)}
                          <small>{peso(product.perCap)} /cap</small>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="admin-wheel-prize-footer">
                <label className="admin-wheel-toggle">
                  <input
                    type="checkbox"
                    checked={draft.enabled}
                    onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })}
                  />
                  Promo is on
                </label>
                <button type="button" onClick={() => setDraft(null)} disabled={isSaving}>
                  Cancel
                </button>
                <button type="submit" disabled={isSaving}>
                  {isSaving ? "Saving" : "Save promo"}
                </button>
              </div>
            </form>
          ) : (
            <div className="admin-tiktok-row-actions">
              <button type="button" onClick={() => setDraft(emptyDraft())}>
                New promo
              </button>
            </div>
          )}

          {promos.length === 0 ? (
            <p className="admin-wheel-empty">No promos yet.</p>
          ) : (
            <div className="admin-wheel-list">
              {promos.map((promo) => {
                const status = promoStatus(promo, now);
                return (
                  <article className={`admin-promo-row ${status.toLowerCase()}`} key={promo.id}>
                    <div>
                      <strong>{promo.name}</strong>
                      <span className="admin-promo-status">{status}</span>
                      <p>
                        {formatPromoDay(promo.starts_on)} {promo.starts_on.slice(0, 4)} –{" "}
                        {promo.ends_on ? `${formatPromoDay(promo.ends_on)} ${promo.ends_on.slice(0, 4)}` : "no end date"}
                        {promo.label ? ` · shows as "${promo.label}"` : ""}
                      </p>
                      <p>
                        {products
                          .filter((product) => promo.discounts[product.id])
                          .map((product) => {
                            const typed = [
                              promo.prices[product.id] ? `₱${promo.prices[product.id].toLocaleString("en-PH")}` : "",
                              promo.perCap[product.id] ? `₱${promo.perCap[product.id]}/cap` : "",
                            ].filter(Boolean);
                            return `${product.name} ${promo.discounts[product.id]}%${typed.length ? ` (${typed.join(", ")})` : ""}`;
                          })
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="admin-tiktok-row-actions">
                      <button type="button" onClick={() => setDraft(promo)} disabled={isSaving}>
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() =>
                          save(
                            { ...promo, enabled: !promo.enabled },
                            `${promo.name} switched ${promo.enabled ? "off" : "on"}.`,
                          )
                        }
                      >
                        {promo.enabled ? "Switch off" : "Switch on"}
                      </button>
                      <button type="button" onClick={() => remove(promo)} disabled={isSaving}>
                        Delete
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
