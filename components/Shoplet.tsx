"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon, CheckIcon } from "@/components/Icons";
import { createShopOrder, type ShopOrderItem } from "@/lib/api";

const MAYA_URL = "https://paymaya.me/GRINDERSGUILD";

const TIERS = [
  { id: "start", name: "Start", phase: "30-day", days: 30, caps: 135, perCap: 120, price: 16200 },
  { id: "grow", name: "Grow", phase: "60-day", days: 60, caps: 270, perCap: 110, price: 29700, tag: "Popular" },
  { id: "peak", name: "Peak", phase: "90-day", days: 90, caps: 400, perCap: 100, price: 39999, tag: "Best rate" },
];

const TRIALS = [
  { id: "trial-blister", name: "Blister Trial", caps: 10, price: 1299 },
  { id: "trial-bottle", name: "Bottle Trial", caps: 30, price: 3799 },
];

type Mode = "trial" | "protocol";
type Stage = "shop" | "checkout" | "redirecting";
type FormState = {
  email: string;
  mobile: string;
  name: string;
  address: string;
  city: string;
  province: string;
  zip: string;
};

const emptyForm: FormState = {
  email: "",
  mobile: "",
  name: "",
  address: "",
  city: "",
  province: "",
  zip: "",
};

const peso = (value: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(value);

export default function Shoplet() {
  const [mode, setMode] = useState<Mode>("trial");
  const [trialId, setTrialId] = useState(TRIALS[0].id);
  const [tierId, setTierId] = useState("peak");
  const [basket, setBasket] = useState<ShopOrderItem[]>([]);
  const [stage, setStage] = useState<Stage>("shop");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createdCode, setCreatedCode] = useState("");

  const selectedTrial = TRIALS.find((item) => item.id === trialId) ?? TRIALS[0];
  const selectedTier = TIERS.find((item) => item.id === tierId) ?? TIERS[2];
  const basketCount = basket.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = basket.reduce((sum, item) => sum + item.price * item.qty, 0);

  const currentBuyLabel = mode === "trial" ? `Add ${selectedTrial.name}` : `Add ${selectedTier.name}`;
  const currentPrice = mode === "trial" ? selectedTrial.price : selectedTier.price;

  function addCurrentItem() {
    const source =
      mode === "trial"
        ? { ...selectedTrial, name: `SynBIOTIC+ ${selectedTrial.name}` }
        : { ...selectedTier, name: `SynBIOTIC+ ${selectedTier.name}` };

    setBasket((current) => {
      const existing = current.find((item) => item.id === source.id);
      if (existing) {
        return current.map((item) => (item.id === source.id ? { ...item, qty: Math.min(item.qty + 1, 20) } : item));
      }
      return [...current, { id: source.id, name: source.name, caps: source.caps, price: source.price, qty: 1 }];
    });
  }

  function setLineQty(id: string, qty: number) {
    setBasket((current) =>
      qty <= 0
        ? current.filter((item) => item.id !== id)
        : current.map((item) => (item.id === id ? { ...item, qty: Math.min(qty, 20) } : item)),
    );
  }

  function setField(key: keyof FormState, value: string) {
    const nextValue =
      key === "mobile"
        ? formatMobile(value)
        : key === "zip"
          ? value.replace(/\D/g, "").slice(0, 4)
          : value;

    setForm((current) => ({ ...current, [key]: nextValue }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: validateField(key, nextValue) }));
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError("");

    if (basket.length === 0) {
      setSubmitError("Add at least one item before checkout.");
      return;
    }

    const nextErrors = validateForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const order = await createShopOrder({
        customerName: form.name,
        email: form.email,
        mobile: form.mobile.replace(/\s/g, ""),
        address: form.address,
        city: form.city,
        province: form.province,
        zip: form.zip,
        items: basket,
        subtotal,
        paymentMethod: "maya",
      });
      setCreatedCode(order.order_code);
      setStage("redirecting");
      window.setTimeout(() => {
        window.location.assign(MAYA_URL);
      }, 900);
    } catch (caught) {
      setSubmitError(caught instanceof Error ? caught.message : "Order could not be saved. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const canCheckout = basket.length > 0;
  const savings = Math.max(0, selectedTier.caps * 120 - selectedTier.price);

  return (
    <main className="shop-shell">
      <section className="shop-hero">
        <nav className="shop-nav" aria-label="Shop header">
          <Link className="shop-brand" href="/">
            <Image src="/gutguard-logo.png" alt="GutGuard" width={34} height={40} priority />
            <span>GutGuard</span>
          </Link>
          <a className="shop-nav-link" href="#checkout">
            Basket ({basketCount})
          </a>
        </nav>

        <div className="shop-hero-grid">
          <section className="shop-product">
            <div className="shop-product-visual" aria-hidden="true">
              <div className="shop-bottle">
                <span>SynBIOTIC+</span>
              </div>
            </div>
            <div>
              <p className="shop-kicker">FDA-registered synbiotic</p>
              <h1>SynBIOTIC+ for daily gut support</h1>
              <p className="shop-lede">
                Choose a low-risk trial or begin the complete 90-day protocol. Your order details are saved before
                you continue to Maya for payment.
              </p>
              <div className="shop-proof">
                <span>Free shipping</span>
                <span>MSU-IIT co-developed</span>
                <span>Manual payment confirmation</span>
              </div>
            </div>
          </section>

          <aside className="shop-card" aria-label="Product options">
            <div className="shop-segment">
              <button type="button" className={mode === "trial" ? "active" : ""} onClick={() => setMode("trial")}>
                Try first
              </button>
              <button type="button" className={mode === "protocol" ? "active" : ""} onClick={() => setMode("protocol")}>
                Full protocol
              </button>
            </div>

            {mode === "trial" ? (
              <div className="shop-options">
                {TRIALS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={trialId === item.id ? "shop-option active" : "shop-option"}
                    onClick={() => setTrialId(item.id)}
                  >
                    <span>
                      <strong>{item.name}</strong>
                      <small>{item.caps} capsules</small>
                    </span>
                    <b>{peso(item.price)}</b>
                  </button>
                ))}
              </div>
            ) : (
              <div className="shop-options">
                {TIERS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={tierId === item.id ? "shop-option active" : "shop-option"}
                    onClick={() => setTierId(item.id)}
                  >
                    <span>
                      <strong>
                        {item.name}
                        {item.tag ? <em>{item.tag}</em> : null}
                      </strong>
                      <small>
                        {item.phase} - {item.caps} capsules
                      </small>
                    </span>
                    <b>{peso(item.perCap)}/cap</b>
                  </button>
                ))}
                <p className="shop-note">Selected protocol saves {peso(savings)} versus the starter rate.</p>
              </div>
            )}

            <button type="button" className="shop-primary" onClick={addCurrentItem}>
              <span>
                {currentBuyLabel}
                <small>{peso(currentPrice)}</small>
              </span>
              <ArrowRightIcon />
            </button>
          </aside>
        </div>
      </section>

      <section className="shop-checkout-band" id="checkout">
        <div className="shop-cart">
          <div className="shop-section-head">
            <p className="shop-kicker">Checkout</p>
            <h2>Your order</h2>
          </div>

          {basket.length > 0 ? (
            <div className="shop-lines">
              {basket.map((item) => (
                <article className="shop-line" key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
                    <span>
                      {item.caps} capsules - {peso(item.price)}
                    </span>
                  </div>
                  <div className="shop-qty">
                    <button type="button" onClick={() => setLineQty(item.id, item.qty - 1)} aria-label="Decrease quantity">
                      -
                    </button>
                    <span>{item.qty}</span>
                    <button type="button" onClick={() => setLineQty(item.id, item.qty + 1)} aria-label="Increase quantity">
                      +
                    </button>
                  </div>
                  <b>{peso(item.price * item.qty)}</b>
                </article>
              ))}
              <div className="shop-total">
                <span>Total</span>
                <strong>{peso(subtotal)}</strong>
              </div>
            </div>
          ) : (
            <p className="shop-empty">Your basket is empty. Add a trial or protocol above.</p>
          )}

          {stage === "redirecting" ? (
            <section className="shop-success" role="status">
              <CheckIcon />
              <h2>Order {createdCode} saved.</h2>
              <p>Redirecting you to Maya. After payment, our admin team will confirm the order and call you.</p>
            </section>
          ) : (
            <form className="shop-form" onSubmit={submitOrder}>
              <div className="shop-form-grid">
                <Field id="email" label="Email" type="email" value={form.email} error={errors.email} onChange={setField} />
                <Field id="mobile" label="Mobile" type="tel" value={form.mobile} error={errors.mobile} onChange={setField} />
                <Field id="name" label="Full name" value={form.name} error={errors.name} onChange={setField} wide />
                <Field id="address" label="Street address" value={form.address} error={errors.address} onChange={setField} wide />
                <Field id="city" label="City" value={form.city} error={errors.city} onChange={setField} />
                <Field id="province" label="Province" value={form.province} error={errors.province} onChange={setField} />
                <Field id="zip" label="ZIP" value={form.zip} error={errors.zip} onChange={setField} />
              </div>
              <div className="shop-payment-note">
                Payment method: Maya. Your details are saved first, then you continue to the secure Maya payment link.
              </div>
              {submitError ? <div className="shop-error">{submitError}</div> : null}
              <button type="submit" className="shop-primary" disabled={!canCheckout || submitting}>
                <span>
                  {submitting ? "Saving order" : `Continue to Maya - ${peso(subtotal)}`}
                  <small>Admin will manually confirm payment.</small>
                </span>
                <ArrowRightIcon />
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}

function Field({
  id,
  label,
  value,
  error,
  type = "text",
  wide = false,
  onChange,
}: {
  id: keyof FormState;
  label: string;
  value: string;
  error?: string;
  type?: string;
  wide?: boolean;
  onChange: (key: keyof FormState, value: string) => void;
}) {
  return (
    <label className={wide ? "shop-field wide" : "shop-field"} htmlFor={`shop-${id}`}>
      <span>{label}</span>
      <input id={`shop-${id}`} type={type} value={value} onChange={(event) => onChange(id, event.target.value)} />
      {error ? <em>{error}</em> : null}
    </label>
  );
}

function validateForm(form: FormState) {
  const errors: Partial<Record<keyof FormState, string>> = {};
  (Object.keys(form) as Array<keyof FormState>).forEach((key) => {
    const message = validateField(key, form[key]);
    if (message) errors[key] = message;
  });
  return errors;
}

function validateField(key: keyof FormState, value: string) {
  const clean = value.trim();
  if (!clean) return "Required";
  if (key === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) return "Enter a valid email";
  if (key === "mobile" && !/^09\d{9}$/.test(clean.replace(/\s/g, ""))) return "Enter a valid PH mobile";
  if (key === "zip" && !/^\d{4}$/.test(clean)) return "Use 4 digits";
  return "";
}

function formatMobile(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 4) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
}
