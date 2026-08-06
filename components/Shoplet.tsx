"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon, CheckIcon } from "@/components/Icons";
import { createShopOrder, sendShopOrderEmail, startMayaCheckout, type ShopOrderItem } from "@/lib/api";
import { TIERS, TRIALS } from "@/lib/catalog";
import {
  fetchBarangays,
  fetchLocalities,
  fetchProvinces,
  type BarangayOption,
  type LocalityOption,
  type ProvinceOption,
} from "@/lib/philippines-address";
import { readReferralShopName, readReferralSlug } from "@/lib/referral";
import { getOrderTotal, quoteShipping } from "@/lib/shipping";

// Bump this suffix whenever catalog prices change. A stored basket carries the price
// it was added at, and the server re-derives prices at checkout - so a stale basket
// would fail verification only after the customer had filled in the whole form.
// Changing the key drops those baskets up front instead.
const BASKET_STORAGE_KEY = "gutguard-basket-v2";

const SCIENCE = [
  [
    "Probiotics - survive and seat",
    "Stable LactoSpore plus nanoshell-coated Lactobacillus and Bifidobacterium strains, selected for gut barrier, immune, and gut-brain support.",
  ],
  [
    "Prebiotics - feed and colonize",
    "FOS and inulin help feed beneficial colon bacteria so the probiotic strains can take hold.",
  ],
  [
    "Postbiotics - signal and renew",
    "Urolithin-A and L-Tryptophan support downstream signaling benefits beyond simple digestion.",
  ],
];

const PROOF = [
  ["FDA", "Registered"],
  ["MSU-IIT", "Co-developed"],
  ["USAID", "Funded science"],
  ["LactoSpore", "Spore probiotic"],
];

const FACTS = {
  serving: "1 capsule (600 mg)",
  actives: [
    ["L-Tryptophan", "100 mg"],
    ["Urolithin-A", "10 mg"],
    ["Glutathione", "250 mg"],
    ["Lutein", "250 mg"],
  ],
  macros: "Calories 0 · Total Fat 0 · Cholesterol 0 · Sodium 0 · Total Carbohydrate 0 · Sugar 0 · Protein 0",
  footnote: "** % RENI not established for these actives. % values based on PDRI 2015 (adult male, 19-29 yrs).",
};

const SCIENCE_URL = "https://gutguard.ph/#/science";

type Mode = "trial" | "protocol";
type Stage = "shop" | "saving" | "redirecting" | "payment-blocked";
type InfoModal = "inside" | "trust" | null;
type FormState = {
  email: string;
  mobile: string;
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  province: string;
  barangay: string;
  zip: string;
  provinceCode: string;
  cityMunicipalityCode: string;
  barangayCode: string;
};

const emptyForm: FormState = {
  email: "",
  mobile: "",
  firstName: "",
  lastName: "",
  address: "",
  city: "",
  province: "",
  barangay: "",
  zip: "",
  provinceCode: "",
  cityMunicipalityCode: "",
  barangayCode: "",
};

const peso = (value: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(value);

export default function Shoplet() {
  const [mode, setMode] = useState<Mode>("trial");
  const [trialId, setTrialId] = useState(TRIALS[0].id);
  const [tierId, setTierId] = useState("peak");
  const [basket, setBasket] = useState<ShopOrderItem[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [infoModal, setInfoModal] = useState<InfoModal>(null);
  const [stage, setStage] = useState<Stage>("shop");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createdCode, setCreatedCode] = useState("");
  const [createdOrderId, setCreatedOrderId] = useState("");
  const [provinces, setProvinces] = useState<ProvinceOption[]>([]);
  const [localities, setLocalities] = useState<LocalityOption[]>([]);
  const [barangays, setBarangays] = useState<BarangayOption[]>([]);
  const [addressError, setAddressError] = useState("");
  const [addressReloadKey, setAddressReloadKey] = useState(0);
  const [isLoadingProvinces, setIsLoadingProvinces] = useState(false);
  const [isLoadingLocalities, setIsLoadingLocalities] = useState(false);
  const [isLoadingBarangays, setIsLoadingBarangays] = useState(false);
  const [referralShopName, setReferralShopName] = useState("");

  const selectedTrial = TRIALS.find((item) => item.id === trialId) ?? TRIALS[0];
  const selectedTier = TIERS.find((item) => item.id === tierId) ?? TIERS[2];
  const basketCount = basket.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = basket.reduce((sum, item) => sum + item.price * item.qty, 0);
  const shippingQuote = quoteShipping(basket, {
    province: form.province,
    regionCode: getSelectedRegionCode(form, provinces),
  });
  const totalAmount = getOrderTotal(subtotal, shippingQuote.fee);
  const currentBuyLabel = mode === "trial" ? `Add ${selectedTrial.name}` : `Add ${selectedTier.name}`;
  const currentPrice = mode === "trial" ? selectedTrial.price : selectedTier.price;

  useEffect(() => {
    setReferralShopName(readReferralShopName());
  }, []);

  // Coming back from a cancelled Maya checkout should not cost the customer their basket.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(BASKET_STORAGE_KEY);
      if (saved) setBasket(JSON.parse(saved) as ShopOrderItem[]);
    } catch {
      window.localStorage.removeItem(BASKET_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (basket.length === 0) window.localStorage.removeItem(BASKET_STORAGE_KEY);
    else window.localStorage.setItem(BASKET_STORAGE_KEY, JSON.stringify(basket));
  }, [basket]);

  // Shipping is priced from the selected province, so the address always comes from the
  // official lists. If they cannot load, the customer retries rather than typing a free-text
  // address we cannot price - an unpriceable order ships at a loss.
  useEffect(() => {
    let ignore = false;
    setIsLoadingProvinces(true);
    setAddressError("");
    fetchProvinces()
      .then((items) => {
        if (!ignore) setProvinces(items);
      })
      .catch(() => {
        if (!ignore) setAddressError("Address lists could not be loaded. Check your connection and try again.");
      })
      .finally(() => {
        if (!ignore) setIsLoadingProvinces(false);
      });
    return () => {
      ignore = true;
    };
  }, [addressReloadKey]);

  useEffect(() => {
    if (!form.provinceCode) return;
    let ignore = false;
    setIsLoadingLocalities(true);
    fetchLocalities(form.provinceCode)
      .then((items) => {
        if (!ignore) {
          setLocalities(items);
          setAddressError("");
        }
      })
      .catch(() => {
        if (!ignore) setAddressError("City list could not be loaded. Please try again.");
      })
      .finally(() => {
        if (!ignore) setIsLoadingLocalities(false);
      });
    return () => {
      ignore = true;
    };
  }, [form.provinceCode]);

  useEffect(() => {
    if (!form.cityMunicipalityCode) return;
    let ignore = false;
    setIsLoadingBarangays(true);
    fetchBarangays(form.cityMunicipalityCode)
      .then((items) => {
        if (!ignore) {
          setBarangays(items);
          setAddressError("");
        }
      })
      .catch(() => {
        if (!ignore) setAddressError("Barangay list could not be loaded. Please try again.");
      })
      .finally(() => {
        if (!ignore) setIsLoadingBarangays(false);
      });
    return () => {
      ignore = true;
    };
  }, [form.cityMunicipalityCode]);

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
    setDrawerOpen(true);
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

  function chooseProvince(provinceCode: string) {
    const province = provinces.find((item) => item.code === provinceCode);
    setLocalities([]);
    setBarangays([]);
    setForm((current) => ({
      ...current,
      province: province?.name ?? "",
      provinceCode,
      city: "",
      cityMunicipalityCode: "",
      barangay: "",
      barangayCode: "",
      zip: "",
    }));
    setErrors((current) => ({ ...current, province: validateField("province", province?.name ?? "") }));
  }

  function chooseLocality(localityCode: string) {
    const locality = localities.find((item) => item.code === localityCode);
    setBarangays([]);
    setForm((current) => ({
      ...current,
      city: locality?.name ?? "",
      cityMunicipalityCode: localityCode,
      barangay: "",
      barangayCode: "",
      zip: locality?.zipCode || current.zip,
    }));
    setErrors((current) => ({
      ...current,
      city: validateField("city", locality?.name ?? ""),
      zip: locality?.zipCode ? "" : current.zip ? validateField("zip", current.zip) : current.zip,
    }));
  }

  function chooseBarangay(barangayCode: string) {
    const barangay = barangays.find((item) => item.code === barangayCode);
    setForm((current) => ({ ...current, barangay: barangay?.name ?? "", barangayCode }));
    setErrors((current) => ({ ...current, barangay: validateField("barangay", barangay?.name ?? "") }));
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
    if (shippingQuote.error) {
      setSubmitError(shippingQuote.error);
      return;
    }

    setSubmitting(true);
    setStage("saving");
    let savedOrderId = "";

    try {
      const order = await createShopOrder({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        mobile: form.mobile.replace(/\s/g, ""),
        address: form.address,
        city: form.city,
        province: form.province,
        barangay: form.barangay,
        zip: form.zip,
        provinceCode: form.provinceCode,
        cityMunicipalityCode: form.cityMunicipalityCode,
        barangayCode: form.barangayCode,
        shippingRegion: shippingQuote.label,
        shippingFee: shippingQuote.fee,
        shippingWeightGrams: shippingQuote.weightGrams,
        totalAmount,
        items: basket,
        subtotal,
        paymentMethod: "maya",
        // Read at submit, not at mount, so a referral link opened in another tab mid-session
        // still counts. Attribution is frozen into the row before the Maya redirect.
        referralSlug: readReferralSlug(),
      });
      sendShopOrderEmail(order.id).catch((emailError) => {
        console.error("Shop order email failed", emailError);
      });
      savedOrderId = order.id;
      setCreatedCode(order.order_code);
      setCreatedOrderId(order.id);
      setStage("redirecting");

      // The order is already durable at this point, so a Maya failure is recoverable:
      // keep the customer on the page with a retry instead of dropping them.
      const checkout = await startMayaCheckout(order.id);
      window.localStorage.removeItem(BASKET_STORAGE_KEY);
      window.location.assign(checkout.redirectUrl ?? checkout.orderUrl);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Something went wrong. Please try again.";
      if (savedOrderId) {
        setStage("payment-blocked");
        setSubmitError(message);
      } else {
        setStage("shop");
        setSubmitError(message || "Order could not be saved. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function retryPayment() {
    if (!createdOrderId) return;
    setSubmitting(true);
    setSubmitError("");

    try {
      const checkout = await startMayaCheckout(createdOrderId);
      window.localStorage.removeItem(BASKET_STORAGE_KEY);
      window.location.assign(checkout.redirectUrl ?? checkout.orderUrl);
    } catch (caught) {
      setSubmitError(caught instanceof Error ? caught.message : "Maya checkout could not be started.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="shop-shell">
      <section className="shop-hero">
        <nav className="shop-nav" aria-label="Shop header">
          <Link className="shop-brand" href="/">
            <Image src="/gutguard-logo.png" alt="GutGuard" width={34} height={40} priority />
            <span>GutGuard</span>
          </Link>
          <button className="shop-nav-link" type="button" onClick={() => setDrawerOpen(true)}>
            Basket ({basketCount})
          </button>
        </nav>

        <div className="shop-hero-grid">
          <section className="shop-product">
            <div className="shop-product-visual">
              <Image src="/shop/bottle.png" alt="GutGuard SynBIOTIC+ bottle" width={520} height={720} priority />
            </div>
            <div>
              {referralShopName ? (
                <p className="shop-referral-welcome">
                  {referralShopName === "Beehive"
                    ? "Welcome to the Beehive GutGuard shop."
                    : `Welcome to ${referralShopName}'s GutGuard shop.`}
                </p>
              ) : null}
              <p className="shop-kicker">FDA-registered synbiotic</p>
              <h1>SynBIOTIC+</h1>
              <p className="shop-lede">A living synbiotic that targets the inflammation aging you.</p>
              <div className="shop-proof">
                <span>Secure</span>
                <span>FDA-registered</span>
                <span>Nationwide delivery</span>
              </div>
              <div className="shop-info-actions">
                <button type="button" onClick={() => setInfoModal("inside")}>
                  What&apos;s inside
                </button>
                <button type="button" onClick={() => setInfoModal("trust")}>
                  Why trust this
                </button>
              </div>
            </div>
          </section>
        </div>
      </section>

      <section className="shop-buy-band" aria-label="Product selection">
        <div className="shop-buy-inner">
          <div className="shop-section-head">
            <div>
              <p className="shop-kicker">Choose your order</p>
              <h2>Start small or begin the protocol.</h2>
            </div>
            <button className="shop-secondary" type="button" onClick={() => setDrawerOpen(true)}>
              Open basket ({basketCount})
            </button>
          </div>

          <div className="shop-card" aria-label="Product options">
            <div className="shop-segment">
              <button type="button" className={mode === "trial" ? "active" : ""} onClick={() => setMode("trial")}>
                Try first
              </button>
              <button type="button" className={mode === "protocol" ? "active" : ""} onClick={() => setMode("protocol")}>
                Full protocol
              </button>
            </div>

            {mode === "trial" ? (
              <>
                <p className="shop-options-label">
                  <span>Start here · low risk</span>
                </p>
                <div className="shop-options trial">
                  {TRIALS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={trialId === item.id ? "shop-option active has-image" : "shop-option has-image"}
                      onClick={() => setTrialId(item.id)}
                    >
                      <Image src={item.image} alt={item.name} width={150} height={150} />
                      <span>
                        <strong>{item.name}</strong>
                        <small>
                          {item.caps} caps · {peso(Math.round(item.price / item.caps))}/cap
                        </small>
                      </span>
                      <b>{peso(item.price)}</b>
                    </button>
                  ))}
                </div>
                <p className="shop-note">
                  The same living formula as the full protocol - try it before you commit.
                </p>
              </>
            ) : (
              <>
                <p className="shop-options-label">
                  <span>When you&apos;re ready</span>
                  <em>₱120 → ₱100 / cap</em>
                </p>
                <div className="shop-options protocol">
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
                          {item.phase} · {item.caps} capsules
                        </small>
                      </span>
                      <b>{peso(item.perCap)}/cap</b>
                    </button>
                  ))}
                </div>
              </>
            )}

            <button type="button" className="shop-primary" onClick={addCurrentItem}>
              <span>
                {currentBuyLabel}
                <small>{peso(currentPrice)}</small>
              </span>
              <ArrowRightIcon />
            </button>
          </div>
        </div>
      </section>

      {drawerOpen ? (
        <div className="shop-drawer-wrap" role="presentation">
          <button
            className="shop-drawer-scrim"
            type="button"
            aria-label="Close basket"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="shop-drawer" aria-label="Basket">
            <div className="shop-drawer-head">
              <div>
                <p className="shop-kicker">Basket</p>
                <h2>Your order</h2>
              </div>
              <button type="button" onClick={() => setDrawerOpen(false)}>
                Close
              </button>
            </div>

            {stage === "redirecting" ? (
              <section className="shop-success" role="status">
                <CheckIcon />
                <h2>Order {createdCode} saved.</h2>
                <p>Opening the secure Maya checkout. Do not close this tab.</p>
              </section>
            ) : stage === "payment-blocked" ? (
              <section className="shop-success" role="status">
                <CheckIcon />
                <h2>Order {createdCode} saved.</h2>
                <p>
                  We could not open the Maya checkout just now, but nothing was lost. Try again, or open your order page
                  and pay whenever you are ready.
                </p>
                {submitError ? <div className="shop-error">{submitError}</div> : null}
                <button type="button" className="shop-primary" onClick={retryPayment} disabled={submitting}>
                  <span>
                    {submitting ? "Opening secure Maya checkout" : `Try payment again - ${peso(totalAmount)}`}
                    <small>Card, Maya wallet, QRPh or online banking</small>
                  </span>
                  <ArrowRightIcon />
                </button>
                <Link className="shop-secondary" href={`/shop/order/${createdCode}`}>
                  Open my order page
                </Link>
              </section>
            ) : (
              <>
                <CartLines basket={basket} subtotal={subtotal} shippingFee={shippingQuote.fee} total={totalAmount} onQty={setLineQty} />
                {!checkoutOpen ? (
                  <button
                    type="button"
                    className="shop-primary"
                    disabled={basket.length === 0}
                    onClick={() => setCheckoutOpen(true)}
                  >
                    <span>
                      Checkout
                      <small>{basket.length === 0 ? "Add an item first" : `${basketCount} item(s) - ${peso(subtotal)}`}</small>
                    </span>
                    <ArrowRightIcon />
                  </button>
                ) : (
                  <form className="shop-form" onSubmit={submitOrder}>
                    <div className="shop-form-grid">
                      <Field id="email" label="Email" type="email" value={form.email} error={errors.email} onChange={setField} />
                      <Field id="mobile" label="Mobile" type="tel" value={form.mobile} error={errors.mobile} onChange={setField} />
                      <Field id="firstName" label="First name" value={form.firstName} error={errors.firstName} onChange={setField} />
                      <Field id="lastName" label="Last name" value={form.lastName} error={errors.lastName} onChange={setField} />
                      <Field id="address" label="Street address" value={form.address} error={errors.address} onChange={setField} wide />
                      <SelectField
                            id="province"
                            label="Province"
                            value={form.provinceCode}
                            error={errors.province}
                            disabled={isLoadingProvinces}
                            placeholder={isLoadingProvinces ? "Loading provinces" : "Select province"}
                            options={provinces.map((item) => ({ label: item.name, value: item.code }))}
                            onChange={chooseProvince}
                          />
                          <SelectField
                            id="city"
                            label="City / Municipality"
                            value={form.cityMunicipalityCode}
                            error={errors.city}
                            disabled={!form.provinceCode || isLoadingLocalities}
                            placeholder={isLoadingLocalities ? "Loading cities" : "Select city or municipality"}
                            options={localities.map((item) => ({ label: item.name, value: item.code }))}
                            onChange={chooseLocality}
                          />
                          <SelectField
                            id="barangay"
                            label="Barangay"
                            value={form.barangayCode}
                            error={errors.barangay}
                            disabled={!form.cityMunicipalityCode || isLoadingBarangays}
                            placeholder={isLoadingBarangays ? "Loading barangays" : "Select barangay"}
                            options={barangays.map((item) => ({ label: item.name, value: item.code }))}
                            onChange={chooseBarangay}
                          />
                      <Field id="zip" label="ZIP" value={form.zip} error={errors.zip} onChange={setField} />
                    </div>
                    <div className="shop-address-tools">
                      <span>{addressError || "Shipping is calculated from Davao after province selection."}</span>
                      {addressError ? (
                        <button type="button" onClick={() => setAddressReloadKey((key) => key + 1)}>
                          Try again
                        </button>
                      ) : null}
                    </div>
                    <div className="shop-shipping-summary">
                      <span>
                        <small>Subtotal</small>
                        <strong>{peso(subtotal)}</strong>
                      </span>
                      <span>
                        <small>Shipping {shippingQuote.label ? `(${shippingQuote.label})` : ""}</small>
                        <strong>{shippingQuote.fee ? peso(shippingQuote.fee) : "Select province"}</strong>
                      </span>
                      <span>
                        <small>Estimated weight</small>
                        <strong>{shippingQuote.weightGrams}g</strong>
                      </span>
                      <span>
                        <small>Total</small>
                        <strong>{peso(totalAmount)}</strong>
                      </span>
                    </div>
                    <div className="shop-payment-note">
                      Pay securely on Maya with a credit or debit card, your Maya wallet, QRPh, or online banking. Your
                      order is saved first, so you can always come back and finish payment later.
                    </div>
                    {shippingQuote.error ? <div className="shop-error">{shippingQuote.error}</div> : null}
                    {submitError ? <div className="shop-error">{submitError}</div> : null}
                    <button type="submit" className="shop-primary" disabled={submitting}>
                      <span>
                        {stage === "saving" ? "Saving your order" : `Pay ${peso(totalAmount)} with Maya`}
                        <small>You will receive an order email and a link to track it.</small>
                      </span>
                      <ArrowRightIcon />
                    </button>
                  </form>
                )}
              </>
            )}
          </aside>
        </div>
      ) : null}

      {infoModal ? (
        <div className="shop-modal-wrap" role="presentation">
          <button className="shop-drawer-scrim" type="button" aria-label="Close details" onClick={() => setInfoModal(null)} />
          <section className="shop-modal" role="dialog" aria-modal="true" aria-labelledby="shop-info-title">
            <div className="shop-drawer-head">
              <div>
                <p className="shop-kicker">{infoModal === "inside" ? "Formula" : "Proof"}</p>
                <h2 id="shop-info-title">{infoModal === "inside" ? "What's inside" : "Why trust this"}</h2>
              </div>
              <button type="button" onClick={() => setInfoModal(null)}>
                Close
              </button>
            </div>
            {infoModal === "inside" ? <InsidePanel /> : <TrustPanel />}
          </section>
        </div>
      ) : null}
    </main>
  );
}

function CartLines({
  basket,
  subtotal,
  shippingFee,
  total,
  onQty,
}: {
  basket: ShopOrderItem[];
  subtotal: number;
  shippingFee: number;
  total: number;
  onQty: (id: string, qty: number) => void;
}) {
  if (basket.length === 0) return <p className="shop-empty">Your basket is empty. Add a trial or protocol first.</p>;

  return (
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
            <button type="button" onClick={() => onQty(item.id, item.qty - 1)} aria-label="Decrease quantity">
              -
            </button>
            <span>{item.qty}</span>
            <button type="button" onClick={() => onQty(item.id, item.qty + 1)} aria-label="Increase quantity">
              +
            </button>
          </div>
          <b>{peso(item.price * item.qty)}</b>
        </article>
      ))}
      <div className="shop-total">
        <span>Subtotal</span>
        <strong>{peso(subtotal)}</strong>
      </div>
      <div className="shop-total">
        <span>Shipping</span>
        <strong>{shippingFee ? peso(shippingFee) : "Select address"}</strong>
      </div>
      <div className="shop-total grand">
        <span>Total</span>
        <strong>{peso(total)}</strong>
      </div>
    </div>
  );
}

function InsidePanel() {
  return (
    <div className="shop-info-panel">
      {SCIENCE.map(([title, copy]) => (
        <article key={title}>
          <CheckIcon />
          <div>
            <strong>{title}</strong>
            <p>{copy}</p>
          </div>
        </article>
      ))}
      <div className="shop-facts">
        <h3>Supplement Facts</h3>
        <p className="shop-facts-serving">
          Serving size <b>{FACTS.serving}</b>
        </p>
        <p className="shop-facts-col">Amount per serving</p>
        <dl>
          {FACTS.actives.map(([name, amount]) => (
            <div key={name}>
              <dt>
                {name}
                <sup>**</sup>
              </dt>
              <dd>{amount}</dd>
            </div>
          ))}
        </dl>
        <p className="shop-facts-macros">{FACTS.macros}</p>
        <p className="shop-facts-foot">{FACTS.footnote}</p>
      </div>
      <a className="shop-facts-link" href={SCIENCE_URL} target="_blank" rel="noopener noreferrer">
        Full formulation & science
        <ArrowRightIcon />
      </a>
    </div>
  );
}

function TrustPanel() {
  return (
    <div className="shop-trust-grid">
      {PROOF.map(([title, copy]) => (
        <article key={title}>
          <strong>{title}</strong>
          <span>{copy}</span>
        </article>
      ))}
      <p>GutGuard is currently in a joint clinical study with MSU-IIT. Payments run on Maya&apos;s secure checkout, and a real person confirms every order by phone before fulfillment.</p>
    </div>
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

function SelectField({
  id,
  label,
  value,
  error,
  placeholder,
  options,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  placeholder: string;
  options: Array<{ label: string; value: string }>;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="shop-field" htmlFor={`shop-${id}`}>
      <span>{label}</span>
      <select id={`shop-${id}`} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
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
  if (key.endsWith("Code")) return "";
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

function getSelectedRegionCode(form: FormState, provinces: ProvinceOption[]) {
  return provinces.find((item) => item.code === form.provinceCode)?.regionCode ?? "";
}
