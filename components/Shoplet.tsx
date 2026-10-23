"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { ArrowRightIcon, CheckIcon } from "@/components/Icons";
import { Logo } from "@/components/GutguardSite";
import { CompareSheet, FullCompare } from "@/components/ShopCompare";
import { createShopOrder, loadShopCatalog, sendShopOrderEmail, startMayaCheckout, type ShopOrderItem } from "@/lib/api";
import {
  DEFAULT_PRODUCTS,
  formatPromoDay,
  promoPerCap,
  promoPrice,
  shopProducts,
  type Product,
  type Promo,
  type PromoPrice,
} from "@/lib/catalog";
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
  const [trialId, setTrialId] = useState("");
  const [tierId, setTierId] = useState("peak");
  const [basket, setBasket] = useState<ShopOrderItem[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [infoModal, setInfoModal] = useState<InfoModal>(null);
  // "Why this price? Compare": the sheet, then optionally the full comparison page.
  const [compare, setCompare] = useState<"sheet" | "full" | null>(null);
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
  // Set by /r/<slug> for partners whose link may not sell the Full Protocol.
  const [trialOnly, setTrialOnly] = useState(false);
  // null until loaded; the fallback list until then. See loadCatalog for failure handling.
  const [catalog, setCatalog] = useState<{ products: Product[]; promos: Promo[] } | null>(null);
  const products = catalog?.products ?? DEFAULT_PRODUCTS;
  const priceOf = (product: Product) => promoPrice(product.id, product.price, catalog?.promos ?? [], new Date());
  const trials = shopProducts(products, "trial");
  const tiers = shopProducts(products, "protocol");
  // No Full Protocol tab on a trial-only link, or when every protocol product is hidden;
  // no Try First tab when every trial is hidden. Either can be switched off in admin.
  const protocolOff = trialOnly || tiers.length === 0;
  const trialsOff = trials.length === 0;
  const showTrials = protocolOff || (mode === "trial" && !trialsOff);

  const selectedTrial = trials.find((item) => item.id === trialId) ?? trials[0];
  const selectedTier = tiers.find((item) => item.id === tierId) ?? tiers[tiers.length - 1];
  const basketCount = basket.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = basket.reduce((sum, item) => sum + item.price * item.qty, 0);
  const shippingQuote = quoteShipping(basket, { provinceCode: form.provinceCode });

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    const panel = menuPanelRef.current;
    const menuButton = menuButtonRef.current;
    const focusable = () => Array.from(panel?.querySelectorAll<HTMLElement>('a[href],button:not([disabled])') ?? []);
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => focusable()[0]?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMenuOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const nodes = focusable();
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      menuButton?.focus();
    };
  }, [menuOpen]);
  const totalAmount = getOrderTotal(subtotal, shippingQuote.fee);
  // Undefined only when admin has hidden everything this page could sell - no buy button then.
  const selectedItem: Product | undefined = showTrials ? selectedTrial : selectedTier;
  const currentPrice = selectedItem ? priceOf(selectedItem) : null;
  // Live per-capsule range of the packages, for the Compare table ("₱90–₱130").
  const tierRates = tiers.map((tier) => promoPerCap(tier, priceOf(tier)));
  const tierRateRange = tierRates.length
    ? Math.min(...tierRates) === Math.max(...tierRates)
      ? peso(tierRates[0])
      : `${peso(Math.min(...tierRates))}–${peso(Math.max(...tierRates))}`
    : "";

  useEffect(() => {
    setReferralShopName(readReferralShopName());
    setTrialOnly(new URLSearchParams(window.location.search).has("trial"));
  }, []);

  useEffect(() => {
    loadShopCatalog().then(setCatalog);
  }, []);

  // A saved basket carries the price, capsules and name it was added with; admin edits and
  // promos change those, so bring it up to date or checkout would reject it after the
  // customer filled in the form. Products no longer for sale - or protocol packs on a
  // trial-only link - drop out.
  useEffect(() => {
    if (!catalog) return;
    const trialOnlyLink = new URLSearchParams(window.location.search).has("trial");
    setBasket((current) =>
      current.flatMap((item) => {
        const product = catalog.products.find((entry) => entry.id === item.id && entry.status === "active");
        if (!product || (trialOnlyLink && product.kind !== "trial")) return [];
        const price = promoPrice(product.id, product.price, catalog.promos, new Date()).price;
        return [{ ...item, name: `SynBIOTIC+ ${product.name}`, caps: product.caps, price }];
      }),
    );
  }, [catalog]);

  // Coming back from a cancelled Maya checkout should not cost the customer their basket.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(BASKET_STORAGE_KEY);
      if (saved) {
        // Re-priced and filtered once the catalog loads (see above).
        setBasket(JSON.parse(saved) as ShopOrderItem[]);
      }
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
    fetchBarangays(form.provinceCode, form.cityMunicipalityCode)
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
  }, [form.provinceCode, form.cityMunicipalityCode]);

  function addCurrentItem() {
    const source = selectedItem;
    if (!source) return;

    setBasket((current) => {
      const existing = current.find((item) => item.id === source.id);
      if (existing) {
        return current.map((item) => (item.id === source.id ? { ...item, qty: Math.min(item.qty + 1, 20) } : item));
      }
      const price = priceOf(source).price;
      return [...current, { id: source.id, name: `SynBIOTIC+ ${source.name}`, caps: source.caps, price, qty: 1 }];
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
      <header className="shop-site-header">
        <nav className="shop-site-nav-inner" aria-label="Primary">
          <Link className="shop-site-brand" href="/" aria-label="GutGuard home">
            <Logo h={29} />
          </Link>
          <div className="shop-site-links">
            <Link href="/#why-now">Why GutGuard</Link>
            <Link href="/system">How It Works</Link>
            <Link href="/science">Science</Link>
            <Link href="/testimonials">Stories</Link>
            <Link href="/shop" aria-current="page">Shop</Link>
            <Link href="/physicians">For Physicians</Link>
          </div>
          <div className="shop-site-actions">
            <Link className="shop-site-login" href="/partner">Log in</Link>
            <button className="shop-site-basket" type="button" onClick={() => setDrawerOpen(true)}>
              Basket ({basketCount})
            </button>
          </div>
          <button className="shop-site-basket-mobile" type="button" onClick={() => setDrawerOpen(true)}>
            Basket ({basketCount})
          </button>
          <button
            ref={menuButtonRef}
            className="shop-site-menu-button"
            type="button"
            aria-label="Open menu"
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            aria-controls="shop-mobile-menu"
            onClick={() => setMenuOpen(true)}
          >
            <Menu size={20} />
          </button>
        </nav>
      </header>
      <div
        id="shop-mobile-menu"
        ref={menuPanelRef}
        className={"shop-site-menu" + (menuOpen ? " open" : "")}
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
      >
        <button className="shop-site-menu-button shop-site-menu-close" type="button" aria-label="Close menu" onClick={() => setMenuOpen(false)}>
          <X size={20} />
        </button>
        <Link href="/#why-now" onClick={() => setMenuOpen(false)}>Why GutGuard</Link>
        <Link href="/system" onClick={() => setMenuOpen(false)}>How It Works</Link>
        <Link href="/science" onClick={() => setMenuOpen(false)}>Science</Link>
        <Link href="/testimonials" onClick={() => setMenuOpen(false)}>Stories</Link>
        <Link href="/shop" aria-current="page" onClick={() => setMenuOpen(false)}>Shop</Link>
        <Link href="/physicians" onClick={() => setMenuOpen(false)}>For Physicians</Link>
        <Link className="shop-site-menu-login" href="/partner" onClick={() => setMenuOpen(false)}>Already a partner? Log in →</Link>
      </div>
      <section className="shop-hero">
        <div className="shop-hero-grid">
          <section className="shop-product">
            <div className="shop-product-visual">
              <Image src="/shop/bottle.png" alt="GutGuard SynBIOTIC+ bottle" width={520} height={720} priority />
            </div>
            <div>
              {referralShopName ? (
                <p className="shop-referral-welcome">{`Welcome to the ${referralShopName} GutGuard shop.`}</p>
              ) : null}
              <p className="shop-kicker">FDA-registered synbiotic</p>
              <h1>SynBIOTIC+</h1>
              <p className="shop-lede">A living synbiotic that targets the inflammation aging you.</p>
              <div className="shop-proof">
                <span>Secure</span>
                <span>FDA-registered</span>
                <span>Nationwide delivery</span>
              </div>
              <div className="shop-info-actions" id="composition">
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

      <section className="shop-buy-band" id="flagship" aria-label="Product selection">
        <div className="shop-buy-inner">
          <div className="shop-section-head">
            <div>
              <p className="shop-kicker">Choose your order</p>
              <h2>{protocolOff ? "Start small - try it first." : "Start small or begin the protocol."}</h2>
            </div>
            <button className="shop-secondary" type="button" onClick={() => setDrawerOpen(true)}>
              Open basket ({basketCount})
            </button>
          </div>

          {/* Wait for the real catalog: the built-in fallback prices would flash for a moment. */}
          {catalog ? (
          <div className="shop-card" aria-label="Product options">
            {protocolOff || trialsOff ? null : (
              <div className="shop-segment">
                <button type="button" className={showTrials ? "active" : ""} onClick={() => setMode("trial")}>
                  Try first
                </button>
                <button type="button" className={showTrials ? "" : "active"} onClick={() => setMode("protocol")}>
                  Full protocol
                </button>
              </div>
            )}

            {showTrials ? (
              <>
                <p className="shop-options-label">
                  <span>Start here · low risk</span>
                </p>
                <div className="shop-options trial">
                  {trials.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`shop-option has-image${trialId === item.id ? " active" : ""}${priceOf(item).promo ? " has-promo" : ""}`}
                      onClick={() => setTrialId(item.id)}
                    >
                      <Image src={item.image} alt={item.name} width={150} height={150} />
                      <span>
                        <strong>{item.name}</strong>
                        <small>
                          {item.caps} caps · {peso(promoPerCap(item, priceOf(item)))}/cap
                        </small>
                      </span>
                      <PriceTag product={item} value={priceOf(item)} />
                    </button>
                  ))}
                </div>
                {protocolOff ? null : (
                  <p className="shop-note">
                    The same living formula as the full protocol - try it before you commit.
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="shop-options-label">
                  <span>When you&apos;re ready</span>
                </p>
                {/* Package cards from the boss's Full Protocol mockup (13 Oct 2026). */}
                <div className="shop-options shop-tiers" role="radiogroup" aria-label="Full protocol packages">
                  {tiers.map((item) => {
                    const pricing = priceOf(item);
                    const active = tierId === item.id || (!tiers.some((tier) => tier.id === tierId) && item === selectedTier);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        className={`shop-option shop-tier${active ? " active" : ""}`}
                        onClick={() => setTierId(item.id)}
                      >
                        <span className="shop-tier-row">
                          <span>
                            <strong>
                              {item.name}
                              {item.tag ? <em>{item.tag}</em> : null}
                            </strong>
                            <small className="shop-tier-size">
                              {item.phase} · {item.caps} capsules
                            </small>
                            {item.dosage ? <small>{item.dosage}</small> : null}
                          </span>
                          <span className="shop-price">
                            <b className="shop-tier-rate">
                              {peso(promoPerCap(item, pricing))}
                              <i> / capsule</i>
                            </b>
                            <span className="shop-price-row">
                              <span className="shop-price-now">{peso(pricing.price)} total</span>
                              {pricing.promo ? <LimitedOffer /> : null}
                            </span>
                            {pricing.promo ? (
                              <span className="shop-price-compare">Standard {peso(item.perCap)} / capsule · Program rate</span>
                            ) : null}
                          </span>
                        </span>
                        {item.includes.length || item.includesNote ? (
                          <span className="shop-tier-more">
                            {item.includes.length ? (
                              <span className="shop-tier-incl">
                                <span className="shop-tier-incl-h">What&apos;s included</span>
                                {item.includes.map((line) => (
                                  <span className="shop-tier-li" key={line}>
                                    <CheckIcon />
                                    {line}
                                  </span>
                                ))}
                              </span>
                            ) : null}
                            {item.includesNote ? <small className="shop-tier-last">{item.includesNote}</small> : null}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {selectedItem && currentPrice ? (
            <button type="button" className="shop-primary" onClick={addCurrentItem}>
              <span>
                {`Add ${selectedItem.name}`}
                {/* "₱4,500 SRP → ₱3,999" / "Until Dec 31, 2026 only" (no "bonus value" - boss, 15 Oct) */}
                <small>
                  {currentPrice.promo ? `${peso(currentPrice.basePrice)} SRP → ` : null}
                  <strong>{peso(currentPrice.price)}</strong>
                </small>
                {currentPrice.promo ? (
                  currentPrice.promo.ends_on ? (
                    <small className="shop-primary-bonus">Until {formatPromoDate(currentPrice.promo.ends_on)} only</small>
                  ) : null
                ) : null}
              </span>
              <ArrowRightIcon />
            </button>
            ) : null}
            {showTrials ? null : (
              <>
                <p className="shop-note shop-tier-proof">FDA-registered · Made in an ISO-certified facility</p>
                <button type="button" className="shop-facts-link shop-compare-link" onClick={() => setCompare("sheet")}>
                  Why this price? Compare
                  <ArrowRightIcon />
                </button>
              </>
            )}
          </div>
          ) : (
            <div className="shop-card" aria-busy="true">
              <p className="shop-note">Loading prices…</p>
            </div>
          )}
        </div>
      </section>

      {compare === "sheet" ? (
        <CompareSheet rateRange={tierRateRange} onClose={() => setCompare(null)} onFull={() => setCompare("full")} />
      ) : null}
      {compare === "full" ? <FullCompare rateRange={tierRateRange} onClose={() => setCompare(null)} /> : null}

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

/** "Dec 31, 2026" from a YYYY-MM-DD promo date. */
const formatPromoDate = (day: string) => `${formatPromoDay(day)}, ${day.slice(0, 4)}`;

/**
 * A package's price: the regular price struck through, then the promo price, highlighted.
 * perCap shows per-capsule prices. No %, promo names or "bonus value" (boss's requests).
 */
function PriceTag({ product, value, perCap = false }: { product: Product; value: PromoPrice; perCap?: boolean }) {
  const suffix = perCap ? "/cap" : "";
  const show = (pricing: PromoPrice) => `${peso(perCap ? promoPerCap(product, pricing) : pricing.price)}${suffix}`;
  const regular = `${peso(perCap ? product.perCap : product.price)}${suffix}`;
  if (!value.promo) {
    return (
      <b className="shop-price">
        <span className="shop-price-now">{regular}</span>
      </b>
    );
  }
  return (
    <b className="shop-price">
      <span className="shop-price-compare">
        <s>{regular}</s>
      </span>
      {/* Pill on the left, price on the right like the packs without a promo (Naj, 16 Oct). */}
      <span className="shop-price-row">
        <LimitedOffer />
        <span className="shop-price-now">{show(value)}</span>
      </span>
    </b>
  );
}

/** "LIMITED TIME OFFER" beside the promo price, on each pack that has a live promo (not the whole tab). */
const LimitedOffer = () => <em className="shop-lto">Limited time offer</em>;

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
