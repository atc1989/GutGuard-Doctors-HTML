"use client";

import { useEffect, useState, type FormEvent } from "react";
import Header from "@/components/Header";
import { adminLogin, checkAdminSession } from "@/lib/api";
import {
  discountedPrice,
  formatPromoDay,
  manilaDate,
  MAX_PROMO_PERCENT,
  promoStatus,
  TIERS,
  TRIALS,
  type Promo,
} from "@/lib/catalog";

const PRODUCTS = [
  ...TIERS.map((tier) => ({ id: tier.id, name: `${tier.name} (${tier.phase})`, price: tier.price })),
  ...TRIALS.map((trial) => ({ id: trial.id, name: trial.name, price: trial.price })),
];

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
  const [password, setPassword] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [draft, setDraft] = useState<Promo | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    checkAdminSession().then((authenticated) => {
      if (authenticated) loadPromos();
    });
  }, []);

  async function loadPromos() {
    setIsLoading(true);
    setError(null);
    try {
      setPromos((await request<{ promos: Promo[] }>("GET")).promos);
      setIsUnlocked(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load promos.");
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
      await loadPromos();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not unlock.");
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
    if (value === null) delete discounts[productId];
    else discounts[productId] = Math.min(Math.max(Math.round(Number(value) || 0), 0), MAX_PROMO_PERCENT);
    setDraft({ ...draft, discounts });
  }

  const now = new Date();
  const live = promos.filter((promo) => promoStatus(promo, now) === "Live").length;

  return (
    <main className="admin-wheel-shell admin-shop-orders-shell">
      <Header dateLabel="Shop Promos" />

      <section className="admin-wheel-hero">
        <div>
          <p className="admin-wheel-kicker">GutGuard Shop</p>
          <h1>
            Promos
            <br />
            <em>Admin</em>
          </h1>
        </div>
        <div className="admin-wheel-summary" aria-live="polite">
          <span>{isUnlocked ? "visible" : "locked"}</span>
          <strong>{promos.length}</strong>
          <span>{live} live</span>
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
                {PRODUCTS.map((product) => {
                  const pct = draft.discounts[product.id];
                  const chosen = pct !== undefined;
                  return (
                    <div className="admin-promo-product" key={product.id}>
                      <label className="admin-wheel-toggle">
                        <input
                          type="checkbox"
                          checked={chosen}
                          onChange={(event) => setPercent(product.id, event.target.checked ? "10" : null)}
                        />
                        {product.name}
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
                          <span className="admin-promo-preview">
                            {peso(product.price)} → <strong>{peso(discountedPrice(product.price, pct || 0))}</strong>
                          </span>
                        </>
                      ) : (
                        <span className="admin-promo-preview">{peso(product.price)}</span>
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
                        {PRODUCTS.filter((product) => promo.discounts[product.id])
                          .map((product) => `${product.name} ${promo.discounts[product.id]}%`)
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
    </main>
  );
}
