"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon, CheckIcon } from "@/components/Icons";
import { createShopOrder, sendShopOrderEmail, type ShopOrderItem } from "@/lib/api";
import {
  fetchBarangays,
  fetchLocalities,
  fetchProvinces,
  type BarangayOption,
  type LocalityOption,
  type ProvinceOption,
} from "@/lib/philippines-address";
import { getOrderTotal, quoteShipping } from "@/lib/shipping";

const MAYA_URL = "https://paymaya.me/ASIAPAC";

const TIERS = [
  { id: "start", name: "Start", phase: "30-day", days: 30, caps: 135, perCap: 120, price: 16200 },
  { id: "grow", name: "Grow", phase: "60-day", days: 60, caps: 270, perCap: 110, price: 29700, tag: "Popular" },
  { id: "peak", name: "Peak", phase: "90-day", days: 90, caps: 400, perCap: 100, price: 39999, tag: "Best rate" },
];

const TRIALS = [
  { id: "trial-blister", name: "Blister Trial", caps: 10, price: 1299, image: "/shop/blister.png" },
  { id: "trial-bottle", name: "Bottle Trial", caps: 30, price: 3799, image: "/shop/bottle.png" },
];

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

type Mode = "trial" | "protocol";
type Stage = "shop" | "redirecting";
type InfoModal = "inside" | "trust" | null;
type FormState = {
  email: string;
  mobile: string;
  name: string;
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
  name: "",
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
  const [provinces, setProvinces] = useState<ProvinceOption[]>([]);
  const [localities, setLocalities] = useState<LocalityOption[]>([]);
  const [barangays, setBarangays] = useState<BarangayOption[]>([]);
  const [addressMode, setAddressMode] = useState<"api" | "manual">("api");
  const [addressNotice, setAddressNotice] = useState("");
  const [isLoadingProvinces, setIsLoadingProvinces] = useState(false);
  const [isLoadingLocalities, setIsLoadingLocalities] = useState(false);
  const [isLoadingBarangays, setIsLoadingBarangays] = useState(false);

  const selectedTrial = TRIALS.find((item) => item.id === trialId) ?? TRIALS[0];
  const selectedTier = TIERS.find((item) => item.id === tierId) ?? TIERS[2];
  const basketCount = basket.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = basket.reduce((sum, item) => sum + item.price * item.qty, 0);
  const shippingQuote = quoteShipping(basket, {
    province: form.province,
    regionCode: getSelectedRegionCode(form, provinces),
    manualAddress: addressMode === "manual",
  });
  const totalAmount = getOrderTotal(subtotal, shippingQuote.fee);
  const currentBuyLabel = mode === "trial" ? `Add ${selectedTrial.name}` : `Add ${selectedTier.name}`;
  const currentPrice = mode === "trial" ? selectedTrial.price : selectedTier.price;
  const savings = Math.max(0, selectedTier.caps * 120 - selectedTier.price);

  useEffect(() => {
    let ignore = false;
    setIsLoadingProvinces(true);
    fetchProvinces()
      .then((items) => {
        if (!ignore) setProvinces(items);
      })
      .catch(() => {
        if (!ignore) {
          setAddressMode("manual");
          setAddressNotice("Address dropdowns are unavailable right now. Enter the delivery address manually and admin will review shipping.");
        }
      })
      .finally(() => {
        if (!ignore) setIsLoadingProvinces(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (addressMode !== "api" || !form.provinceCode) return;
    let ignore = false;
    setIsLoadingLocalities(true);
    fetchLocalities(form.provinceCode)
      .then((items) => {
        if (!ignore) setLocalities(items);
      })
      .catch(() => {
        if (!ignore) {
          setAddressMode("manual");
          setAddressNotice("City and barangay lists could not be loaded. Enter the delivery address manually and admin will review shipping.");
        }
      })
      .finally(() => {
        if (!ignore) setIsLoadingLocalities(false);
      });
    return () => {
      ignore = true;
    };
  }, [addressMode, form.provinceCode]);

  useEffect(() => {
    if (addressMode !== "api" || !form.cityMunicipalityCode) return;
    let ignore = false;
    setIsLoadingBarangays(true);
    fetchBarangays(form.cityMunicipalityCode)
      .then((items) => {
        if (!ignore) setBarangays(items);
      })
      .catch(() => {
        if (!ignore) {
          setAddressMode("manual");
          setAddressNotice("Barangay list could not be loaded. Enter the delivery address manually and admin will review shipping.");
        }
      })
      .finally(() => {
        if (!ignore) setIsLoadingBarangays(false);
      });
    return () => {
      ignore = true;
    };
  }, [addressMode, form.cityMunicipalityCode]);

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

  function useManualAddress() {
    setAddressMode("manual");
    setAddressNotice("Manual delivery address enabled. Admin will review the shipping fee before fulfillment.");
    setLocalities([]);
    setBarangays([]);
    setForm((current) => ({ ...current, provinceCode: "", cityMunicipalityCode: "", barangayCode: "" }));
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
    try {
      const order = await createShopOrder({
        customerName: form.name,
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
      });
      sendShopOrderEmail(order.id).catch((emailError) => {
        console.error("Shop order email failed", emailError);
      });
      setCreatedCode(order.order_code);
      setStage("redirecting");
      window.setTimeout(() => {
        window.location.assign(getMayaPaymentUrl(totalAmount));
      }, 900);
    } catch (caught) {
      setSubmitError(caught instanceof Error ? caught.message : "Order could not be saved. Please try again.");
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
              <p className="shop-kicker">FDA-registered synbiotic</p>
              <h1>SynBIOTIC+ for daily gut support</h1>
              <p className="shop-lede">
                Order details are saved first, then you continue to Maya. After payment, our admin team confirms the
                order and calls you before fulfillment.
              </p>
              <div className="shop-proof">
                <span>Free shipping</span>
                <span>MSU-IIT co-developed</span>
                <span>Manual payment confirmation</span>
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
                      <small>{item.caps} capsules</small>
                    </span>
                    <b>{peso(item.price)}</b>
                  </button>
                ))}
              </div>
            ) : (
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
                <p>Redirecting you to Maya. After payment, our admin team will confirm the order and call you.</p>
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
                      <Field id="name" label="Full name" value={form.name} error={errors.name} onChange={setField} wide />
                      <Field id="address" label="Street address" value={form.address} error={errors.address} onChange={setField} wide />
                      {addressMode === "api" ? (
                        <>
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
                        </>
                      ) : (
                        <>
                          <Field id="province" label="Province" value={form.province} error={errors.province} onChange={setField} />
                          <Field id="city" label="City" value={form.city} error={errors.city} onChange={setField} />
                          <Field id="barangay" label="Barangay" value={form.barangay} error={errors.barangay} onChange={setField} />
                        </>
                      )}
                      <Field id="zip" label="ZIP" value={form.zip} error={errors.zip} onChange={setField} />
                    </div>
                    <div className="shop-address-tools">
                      {addressNotice ? <span>{addressNotice}</span> : <span>Shipping is calculated from Davao after province selection.</span>}
                      {addressMode === "api" ? (
                        <button type="button" onClick={useManualAddress}>
                          Enter manually
                        </button>
                      ) : null}
                    </div>
                    <div className="shop-shipping-summary">
                      <span>
                        <small>Subtotal</small>
                        <strong>{peso(subtotal)}</strong>
                      </span>
                      <span>
                        <small>Shipping {shippingQuote.manualReview ? "(review)" : shippingQuote.label ? `(${shippingQuote.label})` : ""}</small>
                        <strong>{shippingQuote.manualReview ? "Review" : peso(shippingQuote.fee)}</strong>
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
                      Payment method: Maya. Your details are saved first, then you continue to the secure Maya payment link.
                    </div>
                    {shippingQuote.error ? <div className="shop-error">{shippingQuote.error}</div> : null}
                    {submitError ? <div className="shop-error">{submitError}</div> : null}
                    <button type="submit" className="shop-primary" disabled={submitting}>
                      <span>
                        {submitting ? "Saving order" : `Continue to Maya - ${peso(totalAmount)}`}
                        <small>You will receive an order processing email.</small>
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
        <dl>
          <div>
            <dt>Serving size</dt>
            <dd>1 capsule (600 mg)</dd>
          </div>
          <div>
            <dt>L-Tryptophan</dt>
            <dd>100 mg</dd>
          </div>
          <div>
            <dt>Urolithin-A</dt>
            <dd>10 mg</dd>
          </div>
          <div>
            <dt>Glutathione</dt>
            <dd>250 mg</dd>
          </div>
          <div>
            <dt>Lutein</dt>
            <dd>250 mg</dd>
          </div>
        </dl>
      </div>
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
      <p>GutGuard is currently in a joint clinical study with MSU-IIT. Payment is manually reconciled through Maya so a real person can confirm every order before fulfillment.</p>
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

function getMayaPaymentUrl(amount: number) {
  const url = new URL(MAYA_URL);
  url.searchParams.set("amt", String(amount));
  return url.toString();
}

function getSelectedRegionCode(form: FormState, provinces: ProvinceOption[]) {
  return provinces.find((item) => item.code === form.provinceCode)?.regionCode ?? "";
}
