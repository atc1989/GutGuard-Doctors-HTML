"use client";
/* Generated with GutguardSite.jsx by docs/prototype/port_site.py. The Shop page, loaded on demand. */
import { useState, useEffect, useRef } from "react";
import CITIES from "@/lib/psgc_cities.json"; /* PSGC 2025-2Q, cities only (small): [province, island M|V|L, [city…]]. Barangays load on demand (below). Production: an address API, barangays per city */
import { About, Bottle, DEMO, EMAIL_RE, FACTS, GOALS, Ico, LIFESTYLE_HOME, LIFESTYLE_URL, MONTHLY, PROOF, QUARTERLY, SCIENCE, SL_RECOMMENDED, SL_TIERS, SL_TRIALS, bringIntoView, focusNext, isMember, joinUrl, linkTo, memberUrl, peso, useVisitor } from "./GutguardSite.jsx";
/* Barangays (the big part of PSGC) are NOT in the page. They load from psgc_brgy.json when the checkout opens: { "City|Province": [barangays] } */
let BRGY = null, BRGY_P = null;
const loadBrgy = () => BRGY_P || (BRGY_P = fetch("/psgc_brgy.json").then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).then((d) => (BRGY = d)).catch(() => { BRGY = false; }));
const shopApi = () => import("@/lib/api");
import { readReferralSlug } from "@/lib/referral";

const ORDER_SHIP = 150; /* PLACEHOLDER flat shipping for one-time items — same value as the Lifestyle Page. CSA to confirm */
const SAME_SITE = true; /* production: true — links open in the same tab (same domain). Demo: the pages are separate artifacts */
function useWideShop() {
  const q = "(min-width: 900px)";
  const [w, setW] = useState(false); /* set after load, so the server and browser first render match */
  useEffect(() => { const m = window.matchMedia(q); const f = () => setW(m.matches); f(); m.addEventListener ? m.addEventListener("change", f) : m.addListener(f); return () => (m.removeEventListener ? m.removeEventListener("change", f) : m.removeListener(f)); }, []);
  return w;
}
/* ───────── Option C: buy on the website, use in the Lifestyle Page ─────────
   Shop → Basket → Checkout (one sheet) → Done. The free Lifestyle card is made from the checkout details. */
const DELIVERY_DAYS = { M: "2–4", V: "3–5", L: "3–6" }; /* PLACEHOLDER courier times by island group — CSA to confirm */
const etaFor = (province) => { const p = CITIES.find((x) => x[0] === province); return p ? `Arrives in ${DELIVERY_DAYS[p[1]]} working days` : "Arrives in 2–6 working days, depending on where you are"; };
/* one search field for the city; the province fills itself */
const CITY_INDEX = CITIES.flatMap((p) => p[2].map((c) => ({ city: c, province: p[0], key: c.toLowerCase().replace(/^city of /, "") })));
const findCities = (q) => {
  const t = q.trim().toLowerCase().replace(/^city of /, ""); if (t.length < 2) return [];
  const out = [];
  CITY_INDEX.forEach((c) => {
    const words = c.key.split(/[\s(.]+/);
    const rank = c.key.startsWith(t) ? 0 : words.some((w) => w.startsWith(t)) ? 2 : (c.key + " " + c.province.toLowerCase()).includes(t) ? 4 : -1;
    if (rank >= 0) out.push([rank + (/ city$/i.test(c.city) ? 0 : 1), c]); /* cities before towns */
  });
  return out.sort((x, y) => x[0] - y[0] || x[1].city.localeCompare(y[1].city)).slice(0, 5).map((x) => x[1]); /* 5 fit above the phone keyboard */
};
const PTS = { watch: 1, blister: 1, bottle: 3, start: 3, grow: 9, peak: 33 };
const TRIAL_CREDIT = 499;
/* Savings: one base for everything — the Blister, ₱1,499 for 10 capsules (₱149.90 per capsule). Rounded DOWN. The 5-Night Watch has no tag (it is a trial). */
const BASE_CAP = 149.9;
const pctOff = (price, caps) => Math.max(0, Math.floor((1 - price / (caps * BASE_CAP)) * 100));
const capsOf = (it) => (it.kind === "daily" ? GOALS.find((q) => q.id === it.goal).mo * 10 : ((SL_TIERS.find((t) => t.id === it.id) || SL_TRIALS.find((t) => t.id === it.id) || {}).caps || 0));
const savedOn = (it) => (it.kind === "watch" ? 0 : Math.max(0, Math.round(capsOf(it) * BASE_CAP - it.price)) * it.qty);
const TRIAL_DOSE = [["Night 1", "1 capsule at Taps"], ["Days 2 to 5", "1 at Reveille, 1 at Taps"], ["Day 6", "Your last capsule, at Reveille"]];
const ME_DEMO = { name: "Rey Aquino", mobile: "0917 111 2233", province: "South Cotabato", city: "General Santos City", brgy: "Lagao", street: "12 Rizal St." };
const PAYS = [["card", "Card", "Visa or Mastercard"], ["gcash", "GCash", "We open GCash to pay"], ["maya", "Maya", "Pay with your Maya wallet"], ["cod", "Cash on Delivery", "Pay in cash when it arrives"], ["install", "Instalments", "3 or 6 months · Peak only"]];
/* Live: one button. Maya's page offers the channels enabled on the merchant account (GCash, cards, Maya wallet). */
const PAYS_LIVE = [["maya", "Maya", "GCash, card or Maya wallet, on Maya's secure page"]];
const FAIL_TEXT = { cancel: "The payment was cancelled.", card: "Your card was declined.", gcash: "The GCash payment was cancelled or timed out.", maya: "The Maya payment did not go through.", install: "The instalment application was not approved." };
const fmtMobile = (v) => { const d = v.replace(/\D/g, "").slice(0, 11); return [d.slice(0, 4), d.slice(4, 7), d.slice(7, 11)].filter(Boolean).join(" "); };
const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-PH", { day: "numeric", month: "short" }); };
const firstName = (n) => (n.trim().split(/\s+/)[0] || "");
const stageFor = (who) => (who === "trial" ? "ordered" : who === "card" ? "card" : "member");

function Shop({ params = {} }) {
  const { who, setWho, failNext, setFailNext, usedBefore } = useVisitor();
  const member = isMember(who);
  const [numberUsed, setNumberUsed] = useState(false); /* the verified mobile has ordered before (server check) */
  const firstOrder = (who === "guest" || who === "card") && !numberUsed; /* the 5-Night Watch is for a first order only: one per mobile number */
  const wide = useWideShop();
  const trials = SL_TRIALS.filter((t) => !(t.first && !firstOrder));
  const [mode, setMode] = useState("trial");
  const [sel, setSel] = useState(SL_RECOMMENDED);
  const [trialSel, setTrialSel] = useState(firstOrder ? "watch" : "blister");
  const [goal, setGoal] = useState("better");
  const [basket, setBasket] = useState([]);
  useEffect(() => { try { const b = JSON.parse(localStorage.getItem("gg-shop-basket") || "[]"); if (Array.isArray(b) && b.length) setBasket((cur) => (cur.length ? cur : b)); } catch (e) {} }, []); /* load after mount, before the save below */
  useEffect(() => { try { localStorage.setItem("gg-shop-basket", JSON.stringify(basket)); } catch (e) {} }, [basket]);
  const [conflict, setConflict] = useState(null);
  const [stage, setStage] = useState("shop"); // shop | cart | checkout | done
  const [info, setInfo] = useState("");
  /* checkout */
  const blank = { mobile: "", name: "", first: "", last: "", email: "", province: "", city: "", brgy: "", street: "", zip: "" };
  const [form, setForm] = useState(member ? ME_DEMO : blank);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [verified, setVerified] = useState(member);
  const [editAddr, setEditAddr] = useState(!member);
  const [pay, setPay] = useState("card");
  const [months, setMonths] = useState(3);
  const [subAgree, setSubAgree] = useState(false);
  const [refOpen, setRefOpen] = useState(false);
  const [refCode, setRefCode] = useState("");
  const [paying, setPaying] = useState(false);
  const [payFail, setPayFail] = useState(null);
  const [tried, setTried] = useState(false);
  const [order, setOrder] = useState(null);
  const [smsOk, setSmsOk] = useState(false);
  const [cityQ, setCityQ] = useState("");
  const sheetRef = useRef(null);
  useEffect(() => { if (member) { setForm((f) => (f.name ? f : ME_DEMO)); setVerified(true); setEditAddr(false); } }, [member]);
  useEffect(() => { if (!firstOrder) { setTrialSel((t) => (t === "watch" ? "blister" : t)); setBasket((b) => b.filter((x) => x.kind !== "watch")); } }, [firstOrder]);
  /* First-order check: when a guest verifies the mobile number, the server looks it up. If that number has used a 5-Night Watch
     before, or has any order in the last 12 months, the Watch becomes a Blister and the Watch is hidden. Demo: DEMO chip "Mobile ordered before". */
  const [swapNote, setSwapNote] = useState(false);
  /* Buying for someone else: one plan per person who takes the capsules; one payer can pay for many people.
     The other person gets their own free card by SMS and joins under the payer. E-Points go to the payer. */
  const [forOther, setForOther] = useState(false);
  const [rcp, setRcp] = useState({ name: "", mobile: "" });
  const [myAddr, setMyAddr] = useState(null);
  const rcpDigits = rcp.mobile.replace(/\D/g, "").length;
  const pickFor = (other) => {
    if (other === forOther) return;
    if (other) { setMyAddr({ province: form.province, city: form.city, brgy: form.brgy, street: form.street }); setForm((f) => ({ ...f, province: "", city: "", brgy: "", street: "" })); setEditAddr(true); }
    else { if (myAddr) setForm((f) => ({ ...f, ...myAddr })); setEditAddr(!(myAddr && myAddr.street)); }
    setForOther(other); setCityQ("");
  };
  /* live: ask the server about the number of the person who takes the capsules */
  const [srvUsed, setSrvUsed] = useState(false);
  const takerMobile = forOther ? rcp.mobile : form.mobile;
  useEffect(() => {
    if (DEMO || numberUsed || !basket.some((x) => x.kind === "watch")) return;
    const d = takerMobile.replace(/\D/g, ""); if (d.length !== 11) return;
    const ac = new AbortController();
    fetch("/api/shop/first-buyer?mobile=" + d, { signal: ac.signal }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (j && j.eligible === false) setSrvUsed(true); }).catch(() => {});
    return () => ac.abort();
  }, [takerMobile, basket, numberUsed]);
  const usedNow = DEMO ? usedBefore : srvUsed;
  useEffect(() => {
    /* the Watch rule checks the number of the person who takes it */
    if (forOther) { if (rcpDigits !== 11 || !usedNow || numberUsed) return; }
    else if (!verified || member || !usedNow || numberUsed) return;
    setNumberUsed(true);
    setBasket((b) => { if (!b.some((x) => x.kind === "watch")) return b; setSwapNote(true); const bl = SL_TRIALS.find((t) => t.id === "blister"); return put(b.filter((x) => x.kind !== "watch"), { id: "blister", kind: "once", name: "SynBIOTIC+ · Blister", sub: bl.caps + " caps · " + peso(bl.price) + " each", price: bl.price }); });
  }, [verified, usedNow, member, numberUsed, forOther, rcpDigits]);

  /* links from the nav, the footer offer and the Lifestyle Page: ?start=watch · ?tab=subscribe&goal=better · ?tab=protocol */
  useEffect(() => {
    if (params.tab === "subscribe") { setMode("subscribe"); if (GOALS.find((g) => g.id === params.goal)) setGoal(params.goal); }
    else if (params.tab === "protocol") setMode("protocol");
    if (params.start === "watch" && firstOrder) { setMode("trial"); setTrialSel("watch"); setBasket([{ id: "watch", kind: "watch", name: "5-Night Watch", sub: "10 caps · 5 nights · new buyers", price: 499, qty: 1 }]); setStage("checkout"); }
  }, [params._k]);
  /* SMS code fills itself on Android (Web OTP). The SMS must end with: @gutguard.ph #123456 */
  useEffect(() => {
    if (!codeSent || verified || typeof window === "undefined" || !("OTPCredential" in window)) return;
    const ac = new AbortController();
    navigator.credentials.get({ otp: { transport: ["sms"] }, signal: ac.signal }).then((o) => { if (o && o.code) { setCode(o.code.slice(0, 6)); setVerified(true); focusNext("co-n"); } }).catch(() => {});
    return () => ac.abort();
  }, [codeSent, verified]);

  const pt = SL_TIERS.find((t) => t.id === sel);
  const trial = trials.find((t) => t.id === trialSel) || trials[0];
  const g = GOALS.find((x) => x.id === goal);
  const link = SAME_SITE ? {} : { target: "_blank", rel: "noopener" };

  const itemFor = () => {
    if (mode === "trial" && trial.first) return { id: "watch", kind: "watch", name: "5-Night Watch", sub: "10 caps · 5 nights · new buyers", price: trial.price };
    if (mode === "trial") return { id: trial.id, kind: "once", name: "SynBIOTIC+ · " + trial.name, sub: trial.caps + " caps · " + peso(trial.price) + " each", price: trial.price };
    if (mode === "protocol") return { id: pt.id, kind: "once", name: "SynBIOTIC+ · " + pt.name, sub: pt.caps + " caps · " + (pt.id === "peak" ? "90-Day Protocol" : peso(pt.price) + " each"), price: pt.price };
    return { id: "daily", kind: "daily", goal, name: "Gutguard Daily · " + g.goal, sub: g.perDay + " a day · " + g.mo + " blisters a month", price: g.mo * MONTHLY };
  };
  /* The Watch and the plan are one per order: when the one on screen is already in, the buy button says so */
  const inOrder = (mode === "trial" && trial.first && basket.some((x) => x.kind === "watch")) || (mode === "subscribe" && basket.some((x) => x.kind === "daily" && x.goal === goal));
  const put = (b, item) => {
    if (item.kind === "watch") return b.some((x) => x.kind === "watch") ? b : [...b, { ...item, qty: 1 }]; /* one Watch per order; it can share the box with one-time items */
    if (item.kind === "daily") return [...b.filter((x) => x.kind !== "daily"), { ...item, qty: 1 }];
    const e = b.find((x) => x.id === item.id);
    return e ? b.map((x) => (x.id === item.id ? { ...x, qty: Math.min(x.qty + 1, 20) } : x)) : [...b, { ...item, qty: 1 }];
  };
  const onBuy = () => {
    if (inOrder) { setStage("checkout"); return; } /* this exact item is already in the order: just go back */
    const item = itemFor();
    /* Only one pair clashes: the Watch (a trial before a plan) and Gutguard Daily (the plan itself) */
    const hasWatch = basket.some((x) => x.kind === "watch"), hasDaily = basket.some((x) => x.kind === "daily");
    if ((item.kind === "watch" && hasDaily) || (item.kind === "daily" && hasWatch)) setConflict(item);
    else { setConflict(null); setBasket((b) => put(b, item)); }
    setStage("checkout"); setTimeout(() => { if (sheetRef.current) sheetRef.current.scrollTop = 0; }, 0);
  };
  const keepWatch = () => { setBasket((b) => put(b.filter((x) => x.kind !== "daily"), conflict.kind === "watch" ? conflict : b.find((x) => x.kind === "watch"))); setConflict(null); };
  const keepPlan = () => { setBasket((b) => put(b.filter((x) => x.kind !== "watch"), conflict.kind === "daily" ? conflict : b.find((x) => x.kind === "daily"))); setConflict(null); };
  const setLineQty = (id, q) => setBasket((b) => (q <= 0 ? b.filter((x) => x.id !== id) : b.map((x) => (x.id === id ? { ...x, qty: Math.min(q, 20) } : x))));

  const basketCount = basket.reduce((s, x) => s + x.qty, 0);
  const hasOnce = basket.some((x) => x.kind === "once");
  const daily = basket.find((x) => x.kind === "daily");
  const hasWatch = basket.some((x) => x.kind === "watch");
  const isWatch = basket.length === 1 && hasWatch; /* the Watch alone: free shipping */
  const hasPeak = basket.some((x) => x.id === "peak");
  const ship = hasOnce ? ORDER_SHIP : 0;
  const itemsTotal = basket.reduce((s, x) => s + x.price * x.qty, 0);
  const credit = daily && who === "trial" && !forOther ? TRIAL_CREDIT : 0; /* the trial credit is for the trial member's own plan */
  const totalToday = itemsTotal + ship - credit;
  const saved = basket.reduce((s, x) => s + savedOn(x), 0);
  const pts = basket.reduce((s, x) => s + (x.kind === "daily" ? GOALS.find((q) => q.id === x.goal).mo : (PTS[x.id] || 0) * x.qty), 0);
  const allowCOD = basket.length > 0 && !daily && !hasWatch && !forOther; /* no COD with a ₱499 trial in the order, or when it goes to someone else */
  const allowInstall = allowCOD && hasPeak;
  const payOptions = DEMO ? PAYS.filter(([k]) => (k === "cod" ? allowCOD : k === "install" ? allowInstall : true)) : PAYS_LIVE;
  const payKey = payOptions.some(([k]) => k === pay) ? pay : payOptions[0][0];
  const perMonth = Math.ceil(totalToday / months);
  const addrOk = !!(form.street.trim() && form.brgy && form.city && form.province && (DEMO || /^\d{4}$/.test(form.zip || "")));
  const nameOk = DEMO ? form.name.trim().length > 1 : !!((form.first || "").trim() && (form.last || "").trim() && EMAIL_RE.test((form.email || "").trim()));
  const hasPlanNow = who === "sub"; /* demo: this member already has Gutguard Daily */
  const planForMe = daily && hasPlanNow && !forOther; /* a second plan for the same person is not allowed */
  const rcpOk = !forOther || (rcp.name.trim().length > 1 && rcpDigits === 11 && rcp.mobile.replace(/\D/g, "") !== form.mobile.replace(/\D/g, ""));
  const contactOk = verified && nameOk && rcpOk && !planForMe;
  const canPay = basket.length > 0 && contactOk && addrOk && (!daily || subAgree);
  const shipText = mode === "subscribe" ? "Free delivery" : mode === "trial" && trial.first ? "Free shipping" : "Shipping " + peso(ORDER_SHIP);
  const bar = inOrder ? <>In your order · Back to checkout</>
    : mode === "trial" && trial.first ? <>Start my 5 nights<span className="p">· {peso(trial.price)}</span></>
    : mode === "trial" ? <>Try it first<span className="p">· {peso(trial.price)}</span></>
    : mode === "protocol" ? <>Begin {pt.name}<span className="p">· {peso(pt.price)}</span></>
    : <>Subscribe<span className="p">· {peso(g.mo * MONTHLY)}/mo</span></>;
  const payLabel = paying ? (payKey === "cod" ? "Placing order…" : "Confirming payment…")
    : payKey === "cod" ? <>Place order · pay on delivery</>
    : payKey === "install" ? <>Continue · {peso(perMonth)}/mo × {months}</>
    : payKey === "gcash" ? <>Pay {peso(totalToday)} with GCash</>
    : payKey === "maya" ? <>Pay {peso(totalToday)} with Maya</> : <>Pay {peso(totalToday)}</>;
  const close = () => { setStage("shop"); setConflict(null); };
  /* "+ Add more items": back to the Shop on something that can still be added (not the Watch or the plan already in the order) */
  const addMore = () => {
    close();
    if (mode === "trial" && basket.some((x) => x.kind === "watch")) setTrialSel((packs[0] || {}).id || "blister");
    if (mode === "subscribe" && basket.some((x) => x.kind === "daily")) setMode("protocol");
  };
  const sheetOpen = stage !== "shop" || info !== "";
  const toTop = () => { if (sheetRef.current) sheetRef.current.scrollTop = 0; };

  const sendCode = () => { if (form.mobile.replace(/\D/g, "").length === 11) { setCodeSent(true); setCode(""); } };
  const afterVerify = () => focusNext(!nameOk ? (DEMO ? "co-n" : "co-fn") : forOther ? "co-rn" : "co-cityq");
  const typeCode = (v) => { const c = v.replace(/\D/g, "").slice(0, 6); setCode(c); if (c.length === 6) { setVerified(true); afterVerify(); } /* demo: any 6 digits */ };
  /* ── live payment ─────────────────────────────────────────────────────────────
     1. POST /api/shop/order (ids + details; the server prices everything)  2. /api/maya/checkout
     3. Maya sends the buyer back to /shop?order=CODE&p=success|failure|cancel (effect below) */
  const [payErr, setPayErr] = useState("");
  const summaryFor = () => {
    const doseGoal = daily ? daily.goal : hasPeak ? "full" : "keep";
    return { lines: basket, pts, total: totalToday, pay: payKey, months, isWatch: hasWatch, withOthers: hasWatch && basket.length > 1, daily, peak: hasPeak, newMember: who === "guest", name: form.name, province: form.province, doseGoal, credit: 0, ref: refCode.trim(), forOther, rcpName: rcp.name.trim(), becameGuardian: !forOther && !hasWatch && (who === "guest" || who === "card" || who === "trial") };
  };
  const payLive = async () => {
    setPayErr("");
    const items = basket.map((x) => ({ id: x.kind === "daily" ? "plan-" + x.goal + "-monthly" : x.id, qty: x.qty }));
    const details = { firstName: form.first.trim(), lastName: form.last.trim(), email: form.email.trim(), mobile: form.mobile, street: form.street.trim(), barangay: form.brgy, city: form.city, province: form.province, zip: form.zip, items, forOther, recipient: forOther ? { name: rcp.name.trim(), mobile: rcp.mobile } : undefined, referral: refCode.trim() || readReferralSlug(), planAgree: subAgree };
    const sig = JSON.stringify(details);
    try {
      let pend = null; try { pend = JSON.parse(sessionStorage.getItem("gg-pending-order") || "null"); } catch (e) {}
      if (!pend || pend.sig !== sig) {
        const r = await fetch("/api/shop/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(details) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) {
          if (j.code === "watch_not_eligible") { setSrvUsed(true); setPaying(false); return; }
          throw new Error(j.error || "Your order could not be saved. Please try again.");
        }
        pend = { id: j.id, code: j.orderCode, sig };
        try { sessionStorage.setItem("gg-pending-order", JSON.stringify(pend)); } catch (e) {}
        shopApi().then((m) => m.sendShopOrderEmail(j.id)).catch(() => {});
      }
      try { sessionStorage.setItem("gg-order-summary", JSON.stringify({ code: pend.code, summary: summaryFor() })); } catch (e) {}
      const co = await (await shopApi()).startMayaCheckout(pend.id);
      window.location.assign(co.redirectUrl || co.orderUrl);
    } catch (err) {
      setPaying(false);
      const m = err && err.message ? err.message : "The payment could not start. Please try again.";
      /* the saved order can no longer be paid: the next try makes a new one */
      if (/5-Night Watch|replaced|could not be verified/.test(m)) { try { sessionStorage.removeItem("gg-pending-order"); } catch (e) {} }
      if (/5-Night Watch is for new buyers/.test(m)) { setSrvUsed(true); return; }
      setPayErr(m);
    }
  };
  /* back from Maya */
  useEffect(() => {
    if (DEMO || !params.order) return;
    const code = params.order;
    let saved = null; try { saved = JSON.parse(sessionStorage.getItem("gg-order-summary") || "null"); } catch (e) {}
    const summary = saved && saved.code === code ? saved.summary : null;
    if (params.p === "success") {
      shopApi().then((m) => m.reconcileMayaPayment(code)).catch(() => {});
      const done = (s) => { setOrder(s); setBasket([]); setPayFail(null); setTried(false); setStage("done"); try { sessionStorage.removeItem("gg-pending-order"); sessionStorage.removeItem("gg-order-summary"); } catch (e) {} };
      if (summary) done(summary);
      else shopApi().then((m) => m.getPublicShopOrder(code)).then((o) => { if (o) done({ lines: [], pts: 0, total: o.total_amount, pay: "maya", months: 3, isWatch: o.items.some((x) => x.id === "watch"), withOthers: false, daily: null, peak: o.items.some((x) => x.id === "peak"), newMember: true, name: o.first_name || "", province: o.province, doseGoal: "keep", credit: 0, ref: "", forOther: false, rcpName: "", becameGuardian: false }); }).catch(() => {});
    } else if (params.p === "failure" || params.p === "cancel") {
      setPayFail(params.p === "cancel" ? "cancel" : "maya"); setStage("checkout");
    }
    try { window.history.replaceState(null, "", "/shop"); } catch (e) {}
  }, [params.order]);
  const tryPay = () => {
    setTried(true);
    if (!canPay || paying) {
      const id = !basket.length ? "co-items" : planForMe ? "co-for" : !verified ? "co-mobile" : !nameOk ? "co-name" : !rcpOk ? "co-rcp" : !addrOk ? "co-addr" : "co-agree";
      /* take the buyer straight to the first missing field */
      const field = !basket.length || planForMe ? null : !verified ? (codeSent ? "co-code" : "co-m") : !nameOk ? (DEMO ? "co-n" : !(form.first || "").trim() ? "co-fn" : !(form.last || "").trim() ? "co-ln" : "co-em") : !rcpOk ? (rcp.name.trim().length < 2 ? "co-rn" : "co-rm") : !addrOk ? (!form.city ? "co-cityq" : !form.brgy ? "co-brgy" : !form.street.trim() ? "co-st" : "co-zip") : null;
      if (field && document.getElementById(field)) { focusNext(field); return; }
      const el = document.getElementById(id); if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); const f = /^(INPUT|SELECT)$/.test(el.tagName) ? el : el.querySelector("input:not([type=checkbox]):not([disabled]), select:not([disabled])"); if (f && !f.value) setTimeout(() => { try { f.focus({ preventScroll: true }); } catch (e) {} }, 350); }
      return;
    }
    setPaying(true);
    if (!DEMO) { payLive(); return; }
    setTimeout(() => {
      setPaying(false);
      if (failNext && payKey !== "cod") { setFailNext(false); setPayFail(payKey); toTop(); return; }
      const newMember = who === "guest"; /* the payer gets a card too: the E-Points go there */
      /* Gut Guardian: earned by finishing the 5-Night Watch, or by starting with any pack or plan */
      const becameGuardian = !forOther && !hasWatch && (who === "guest" || who === "card" || who === "trial");
      const doseGoal = daily ? daily.goal : hasPeak ? "full" : "keep";
      setOrder({ lines: basket, pts, total: totalToday, pay: payKey, months, isWatch: hasWatch, withOthers: hasWatch && basket.length > 1, daily, peak: hasPeak, newMember, name: form.name, province: form.province, doseGoal, credit, ref: refCode.trim(), forOther, rcpName: rcp.name.trim(), becameGuardian });
      setBasket([]); setPayFail(null); setTried(false); setStage("done"); toTop();
      if (forOther) { setWho(who === "guest" ? "card" : who); pickFor(false); setRcp({ name: "", mobile: "" }); }
      else setWho(hasWatch ? "trial" : daily ? "sub" : hasPeak ? "peak" : who === "guest" ? "card" : who);
    }, 900);
  };

  const basketBtn = <button className="sl-cart" onClick={() => setStage("cart")} aria-label={`Basket, ${basketCount} items`}>{Ico.basket(20)}{basketCount > 0 ? <span className="n">{basketCount}</span> : null}</button>;
  const prow = (
    <div className="sl-prow">
      <Bottle s={wide ? 104 : 62} />
      <div><div className="nm">SynBIOTIC+</div><div className="tg">A living synbiotic that targets the inflammation aging you.</div></div>
    </div>
  );
  const insideBody = (<>
    {SCIENCE.map(([t, d], i) => <div className="sl-line" key={t} style={{ borderTop: i === 0 ? "none" : "" }}><div style={{ flex: "none", color: "var(--recovery-deep)", paddingTop: 2 }}>{Ico.check(16)}</div><div><div className="ln">{t}</div><div style={{ fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.45, marginTop: 2 }}>{d}</div></div></div>)}
    <div className="fx">
      <div className="fx-h">Supplement Facts</div>
      <div className="fx-serv"><span>Serving size <b>{FACTS.serving}</b></span></div>
      <div className="fx-rule" />
      <div className="fx-col">Amount per serving</div>
      {FACTS.actives.map(([n, v]) => <div className="fx-row" key={n}><span>{n}<sup>**</sup></span><b>{v}</b></div>)}
      <div className="fx-rule" />
      <div className="fx-macros">{FACTS.macros}</div>
      <div className="fx-foot">{FACTS.footnote}</div>
    </div>
    <a className="sl-detbtn" style={{ marginTop: 16 }} href="#/science" onClick={() => setInfo("")}>Full formulation &amp; science {Ico.arrow(13)}</a>
  </>);
  const proofBody = (<>
    <div className="co-grp">Built to be trusted</div>
    <div className="sl-proof-grid">{PROOF.map(([b, l]) => <div className="pf" key={l}><b>{b}</b><span>{l}</span></div>)}</div>
    <div style={{ fontSize: 11.5, color: "var(--ink-3)", fontStyle: "italic", textAlign: "center", margin: "10px 0 0" }}>Currently in a joint clinical study with MSU-IIT.</div>
  </>);
  const watch = trials.find((t) => t.first);
  const packs = trials.filter((t) => !t.first);
  const buyBox = (<>
    <div className="sl-toggle x3">
      <button className={mode === "trial" ? "on" : ""} onClick={() => setMode("trial")}>Try first</button>
      <button className={mode === "protocol" ? "on" : ""} onClick={() => setMode("protocol")}>Full protocol</button>
      <button className={mode === "subscribe" ? "on" : ""} onClick={() => setMode("subscribe")}>Subscribe</button>
    </div>
    {mode === "trial" ? (
      <>
        <div className="sl-lab"><span>Start here · low risk</span></div>
        {watch ? (
          <button className={"sl-topt sl-wide-opt" + (trial.id === watch.id ? " on" : "")} onClick={() => setTrialSel(watch.id)} aria-pressed={trial.id === watch.id}>
            <div><div className="tn">{watch.name}</div><div className="tc">10 caps · 5 nights · new buyers</div></div>
            <div className="wr"><div className="tp">{peso(watch.price)}</div><span className="tfree">{basket.some((x) => x.kind === "watch") ? "✓ In your order" : "Free shipping"}</span></div>
          </button>
        ) : null}
        <div className="sl-topts">
          {packs.map((t) => (
            <button key={t.id} className={"sl-topt" + (trial.id === t.id ? " on" : "")} onClick={() => setTrialSel(t.id)} aria-pressed={trial.id === t.id}>
              <div className="tn">{t.name}</div><div className="tc">{t.caps} caps{pctOff(t.price, t.caps) ? <> · <span className="sv">Save {pctOff(t.price, t.caps)}%</span></> : ""}</div><div className="tp">{peso(t.price)}</div>
            </button>
          ))}
        </div>
        <div className="sl-note">{Ico.pulse(13)} {trial.first ? "Your 5 nights start the day your pack arrives. The ₱499 comes off your first monthly plan." : "The same living formula as the full protocol — try it before you commit."}</div>
      </>
    ) : mode === "protocol" ? (
      <>
        <div className="sl-lab"><span>When you&rsquo;re ready</span><span className="save">Save up to {pctOff(SL_TIERS[2].price, SL_TIERS[2].caps)}%</span></div>
        <div className="sl-chips">
          {SL_TIERS.map((t) => (
            <button key={t.id} className={"sl-chip" + (sel === t.id ? " on" : "")} onClick={() => setSel(t.id)} aria-pressed={sel === t.id}>
              {t.tag ? <span className="ctag">{t.tag}</span> : null}
              {sel === t.id ? <span className="cmk">{Ico.check(14)}</span> : null}
              <span className="cn">{t.name}</span><span className={"cpc sv" + (t.id === "peak" ? " svp" : "")}>Save {pctOff(t.price, t.caps)}%</span><span className="cd">{t.phase}</span>
            </button>
          ))}
        </div>
        <div className="sl-stats">
          <div className="sl-stat hl"><b key={sel + "p"}>{peso(pt.price)}</b><span>you save {peso(Math.round(pt.caps * BASE_CAP - pt.price))}</span></div>
          <div className="sl-stat"><b key={sel + "d"}>{pt.days}</b><span>days</span></div>
          <div className="sl-stat"><b key={sel + "c"}>{pt.caps}</b><span>capsules</span></div>
        </div>
        <div className="sl-note">{Ico.info(13)} {pt.id === "peak" ? "90 days on the 90-Day Protocol dose, which steps down as your score improves. Cash on Delivery or instalments available." : "Days at 2 capsules a day. Cash on Delivery available."}</div>
      </>
    ) : (
      <>
        <div className="sl-lab"><span>Gutguard Daily · Monthly</span><span className="save">Save {pctOff(MONTHLY, 10)}%</span></div>
        <div className="sl-chips">
          {GOALS.map((x) => (
            <button key={x.id} className={"sl-chip" + (goal === x.id ? " on" : "")} onClick={() => setGoal(x.id)} aria-pressed={goal === x.id}>
              {x.id === "better" ? <span className="ctag">Popular</span> : null}
              {goal === x.id ? <span className="cmk">{Ico.check(14)}</span> : null}
              <span className="cn sm">{x.goal}</span><span className="cpc">{x.perDay} a day</span><span className="cd">{x.mo} blisters</span>
            </button>
          ))}
        </div>
        <div className="sl-stats">
          <div className="sl-stat hl"><b key={goal + "m"}>{peso(g.mo * MONTHLY)}</b><span>you save {peso(Math.round(g.mo * 10 * BASE_CAP - g.mo * MONTHLY))}</span></div>
          <div className="sl-stat"><b key={goal + "b"}>{peso(MONTHLY)}</b><span>per blister</span></div>
          <div className="sl-stat"><b key={goal + "c"}>{g.mo * 10}</b><span>capsules</span></div>
        </div>
        {hasPlanNow ? <div className="co-planhint" style={{ marginTop: 0, marginBottom: 10 }}>You have Gutguard Daily. Change it in your <a {...linkTo(memberUrl("manage", who))}>Lifestyle page</a>, or buy a plan for someone else.</div> : null}
        <div className="sl-note">{Ico.pulse(13)} {who === "trial" ? "Your ₱499 trial credit comes off the first month. " : ""}Change, skip or cancel anytime. Every 3 months: {peso(QUARTERLY)} per blister (save {pctOff(QUARTERLY, 10)}%).</div>
      </>
    )}
    <div className="sl-trustline">
      <span className="t">{Ico.lock(12)} Secure</span>
      <span className="t">{Ico.shield(12)} FDA-registered</span>
      <span className="t">{Ico.pulse(12)} {shipText}</span>
    </div>
    {!member ? <a className="sl-free" href={joinUrl("shop")} {...link}>Not buying today? Join the movement with a free Lifestyle card</a> : null}
  </>);

  const lineRow = (it, edit) => (
    <div className="sl-line" key={it.id}>
      <div className="lc"><i /></div>
      <div><div className="ln">{it.name}</div><div className="ld">{it.sub}</div></div>
      {edit ? (it.kind === "once"
        ? <div className="sl-mq"><button onClick={() => setLineQty(it.id, it.qty - 1)} aria-label="Decrease">−</button><span className="q">{it.qty}</span><button onClick={() => setLineQty(it.id, it.qty + 1)} aria-label="Increase">+</button></div>
        : <button className="sl-rm" onClick={() => setLineQty(it.id, 0)}>Remove</button>) : <span className="sl-qx">× {it.qty}</span>}
      <div className="sl-lp">{peso(it.price * it.qty)}{it.kind === "daily" ? "/mo" : ""}</div>
    </div>
  );
  /* "+ Add more items" opens a short list inside the checkout. The buyer never leaves the checkout. */
  /* while typing a city, lift the field to the top of the sheet so the suggestions show above the keyboard */
  useEffect(() => {
    if (cityQ.trim().length < 2) return; const el = document.getElementById("co-cityq"); const sc = el && el.closest(".sl-co.on"); if (!sc || document.activeElement !== el) return;
    requestAnimationFrame(() => { const d = el.getBoundingClientRect().top - sc.getBoundingClientRect().top - 12; if (Math.abs(d) > 20) sc.scrollTop = sc.scrollTop + d; }); /* instant: typing cancels a smooth scroll */
  }, [cityQ]);
  const [addOpen, setAddOpen] = useState(false);
  const [justAdded, setJustAdded] = useState("");
  const addChoices = [
    ...(firstOrder && !basket.some((x) => x.kind === "watch") && !basket.some((x) => x.kind === "daily") ? [{ id: "watch", kind: "watch", name: "5-Night Watch", sub: "10 caps · 5 nights · new buyers", price: 499, caps: 10 }] : []),
    ...SL_TRIALS.filter((t) => !t.first).map((t) => ({ id: t.id, kind: "once", name: "SynBIOTIC+ · " + t.name, short: t.name, sub: t.caps + " caps · " + peso(t.price) + " each", price: t.price, caps: t.caps })),
    ...SL_TIERS.map((t) => ({ id: t.id, kind: "once", name: "SynBIOTIC+ · " + t.name, short: t.name + " · " + t.phase, sub: t.caps + " caps · " + (t.id === "peak" ? "90-Day Protocol" : peso(t.price) + " each"), price: t.price, caps: t.caps })),
  ];
  const quickAdd = (c) => { const { short, caps, ...item } = c; setBasket((b) => put(b, item)); setJustAdded(c.id); setTimeout(() => setJustAdded((x) => (x === c.id ? "" : x)), 1400); };
  const addList = addOpen ? (
    <div className="co-add">
      {addChoices.map((c) => { const off = c.kind === "watch" ? 0 : pctOff(c.price, c.caps); const n = (basket.find((x) => x.id === c.id) || {}).qty || 0; return (
        <div className="co-add-row" key={c.id}>
          <div><b>{c.short || c.name}</b><small>{c.caps} caps{off ? <> · <span className="sv">Save {off}%</span></> : null}{n ? <> · {n} in order</> : null}</small></div>
          <span className="pr">{peso(c.price)}</span>
          <button onClick={() => quickAdd(c)} aria-label={"Add " + (c.short || c.name)}>{justAdded === c.id ? "✓" : "+ Add"}</button>
        </div>); })}
      <div className="co-add-foot"><button className="co-link" style={{ marginTop: 0 }} onClick={() => setAddOpen(false)}>Done adding</button>{!basket.some((x) => x.kind === "daily") ? <button className="co-link" style={{ marginTop: 0 }} onClick={() => { setAddOpen(false); close(); setMode("subscribe"); }}>Add a monthly plan ›</button> : null}</div>
    </div>
  ) : null;
  const sel2 = (k, label, opts, disabled, ph) => (
    <div className="co-f">
      <label htmlFor={"co-" + k}>{label}</label>
      <select id={"co-" + k} value={form[k]} disabled={disabled} onChange={(e) => { setForm(k === "province" ? { ...form, province: e.target.value, city: "", brgy: "" } : k === "city" ? { ...form, city: e.target.value, brgy: "" } : { ...form, [k]: e.target.value }); if (k === "brgy" && e.target.value) focusNext("co-st"); }}>
        <option value="">{ph}</option>
        {opts.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
  const [, setBrgyTick] = useState(0);
  useEffect(() => { if (stage === "checkout" && BRGY === null) loadBrgy().then(() => setBrgyTick((n) => n + 1)); }, [stage]);
  const brgyList = BRGY ? BRGY[form.city + "|" + form.province] || [] : null; /* null = still loading; BRGY false = could not load → type it */
  const trustLine = (
    <div className="sl-trust2"><span>{Ico.check(12)} FDA-registered</span><span>{Ico.lock(12)} Secure payment by PayMongo</span><a href="#/legal" onClick={close}>Refund policy</a></div>
  );

  return (
    <>
      <h1 className="vh">Shop SynBIOTIC+</h1>
      {wide ? (
        <div className="sl sl-page sl-wide" id="buy">
          <div className="slw-left">
            {prow}
            <h3 className="slw-h">What&rsquo;s inside</h3>
            <div className="sl-dets">{insideBody}</div>
            <h3 className="slw-h">Why trust this</h3>
            <div className="sl-dets">{proofBody}</div>
          </div>
          <div className="slw-right">
            <div className="slw-card">
              <div className="sl-top slw-top"><span className="slw-t">Choose how to start</span>{basketBtn}</div>
              {buyBox}
              <button className="btn-primary slw-buy" onClick={onBuy}>{bar}</button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="sl sl-page" id="buy">
            <div className="sl-top">{prow}{basketBtn}</div>
            {buyBox}
            <div className="sl-detrow">
              <button className="sl-detbtn" onClick={() => setInfo("inside")}>{Ico.info(12)} What&rsquo;s inside</button>
              <button className="sl-detbtn" onClick={() => setInfo("proof")}>{Ico.shield(12)} Why trust this</button>
            </div>
            <div className="sl-spacer" />
          </div>
          <div className="sl-bar"><button className="btn-primary" onClick={onBuy}>{bar}</button></div>
        </>
      )}

      <div className={"sl-scrim" + (sheetOpen ? " on" : "")} onClick={() => { setInfo(""); if (stage !== "done") close(); }} />
      {!wide ? (<>
        <div className={"sl-sheet sl-dets" + (info === "inside" ? " on" : "")} role="dialog" aria-label="What's inside">
          <div className="sl-grip" />
          <div className="sl-sh-h">What&rsquo;s inside <button onClick={() => setInfo("")} aria-label="Close">{Ico.x(22)}</button></div>
          {insideBody}
        </div>
        <div className={"sl-sheet sl-dets" + (info === "proof" ? " on" : "")} role="dialog" aria-label="Why trust this">
          <div className="sl-grip" />
          <div className="sl-sh-h">Why trust this <button onClick={() => setInfo("")} aria-label="Close">{Ico.x(22)}</button></div>
          {proofBody}
        </div>
      </>) : null}

      {/* 1 · basket */}
      <div className={"sl-sheet" + (stage === "cart" ? " on" : "")} role="dialog" aria-label="Basket">
        <div className="sl-grip" />
        <div className="sl-sh-h">Your basket <button onClick={close} aria-label="Close">{Ico.x(22)}</button></div>
        {conflict ? (
          <div className="sl-conflict" role="alert">
            <b>You don&rsquo;t need the trial if your plan starts now.</b>
            <span>The 5-Night Watch is for trying before a plan. Which do you want to keep?</span>
            <div className="cf-btns">
              <button onClick={keepPlan}>Keep my plan</button>
              <button onClick={keepWatch}>Keep 5-Night Watch</button>
            </div>
          </div>
        ) : null}
        {basket.length === 0 ? <div className="sl-empty">Your basket is empty.</div> : (
          <>
            {basket.map((it) => lineRow(it, true))}
            <div className="sl-ship"><span>Shipping</span><span>{hasOnce ? peso(ORDER_SHIP) : isWatch ? "Free shipping" : "Free delivery"}</span></div>
            <div className="sl-eta">{Ico.pulse(12)} {etaFor(form.province)}</div>
            {credit ? <div className="sl-ship" style={{ borderTop: "none", paddingTop: 4, marginTop: 4 }}><span>₱499 trial credit</span><span style={{ color: "var(--recovery-deep)" }}>−{peso(credit)}</span></div> : null}
            {saved ? <div className="sl-ship" style={{ borderTop: "none", paddingTop: 4, marginTop: 4 }}><span>You save</span><span style={{ color: "var(--recovery-deep)", fontWeight: 600 }}>{peso(saved)}</span></div> : null}
            <div className="sl-tot"><span>Total today</span><span className="amt">{peso(totalToday)}</span></div>
            {daily ? <div className="sl-conote" style={{ marginTop: -4, marginBottom: 10 }}>Then {peso(daily.price)} a month, free delivery. Change, skip or cancel anytime.</div> : null}
            <button className="btn-primary" onClick={() => { setStage("checkout"); toTop(); }}>Checkout {Ico.arrow(18)}</button>
            {trustLine}
            <div className="sl-conote" style={{ marginTop: 4 }}>Your basket is saved on this device.</div>
          </>
        )}
      </div>

      {/* 2 · checkout — one sheet: contact, delivery, payment */}
      <div ref={stage === "checkout" ? sheetRef : null} className={"sl-sheet sl-co" + (stage === "checkout" ? " on" : "")} role="dialog" aria-label="Checkout">
        <div className="sl-grip" />
        <div className="sl-sh-h"><span className="bk">Checkout</span><button onClick={close} aria-label="Close">{Ico.x(22)}</button></div>
        {payFail ? (
          <div className="co-fail" role="alert">
            <b>{FAIL_TEXT[payFail] || "The payment did not go through."} Nothing was charged.</b>
            <span>Your order and details are saved. Try again, or choose another way to pay.</span>
            <div className="cf-btns">
              <button onClick={() => { setPayFail(null); tryPay(); }}>Try again</button>
              <button onClick={() => { setPayFail(null); const el = document.getElementById("co-pay"); if (el) el.scrollIntoView({ behavior: "smooth", block: "center" }); }}>Pay another way</button>
            </div>
          </div>
        ) : null}
        {conflict ? (
          <div className="sl-conflict" role="alert">
            <b>You don&rsquo;t need the trial if your plan starts now.</b>
            <span>The 5-Night Watch is for trying before a plan. Which do you want to keep?</span>
            <div className="cf-btns">
              <button onClick={keepPlan}>Keep my plan</button>
              <button onClick={keepWatch}>Keep 5-Night Watch</button>
            </div>
          </div>
        ) : null}
        <div className="co-grp" style={{ marginTop: 0 }}>Your order</div>
        <div className="co-items" id="co-items">
          {basket.length ? basket.map((it) => lineRow(it, true)) : <div className="sl-empty" style={{ padding: "14px 0" }}>Nothing here yet.</div>}
          <button className="co-link" style={{ marginTop: 8 }} onClick={() => { setAddOpen((v) => !v); if (!addOpen) setTimeout(() => { const el = document.querySelector(".sl-co.on .co-add"); if (el) bringIntoView(el); }, 60); }} aria-expanded={addOpen}>{addOpen ? "− Hide the list" : "+ Add more items"}</button>
          {addList}
        </div>

        <div className="co-grp" id="co-for">Who is it for?</div>
        <div className="co-for" role="radiogroup" aria-label="Who is it for?">
          <button role="radio" aria-checked={!forOther} className={!forOther ? "on" : ""} onClick={() => pickFor(false)}>Me</button>
          <button role="radio" aria-checked={forOther} className={forOther ? "on" : ""} onClick={() => pickFor(true)}>Someone else</button>
        </div>
        {planForMe ? <div className={"co-planhint" + (tried ? " err" : "")}>You already have Gutguard Daily. Change it in your <a {...linkTo(memberUrl("manage", who))}>Lifestyle page</a>, or choose <b>Someone else</b>.</div> : null}

        <div className="co-grp">{forOther ? "You (paying)" : "You"}</div>
        {member && !codeSent && verified ? (
          <div className="co-saved"><span><b>{form.name}</b> · {form.mobile} <em>{Ico.check(12)} Lifestyle member</em></span></div>
        ) : (<>
          <div className={"co-f" + (tried && !verified ? " err" : "")} id="co-mobile">
            <label htmlFor="co-m">Mobile number</label>
            <div className="co-inline">
              <input id="co-m" type="tel" inputMode="tel" autoComplete="tel" placeholder="0917 123 4567" value={form.mobile} disabled={DEMO && verified} onChange={(e) => { const v = fmtMobile(e.target.value); const full = v.replace(/\D/g, "").length === 11; setForm({ ...form, mobile: v }); setCode(""); if (DEMO) { setVerified(false); setCodeSent(full); if (full) focusNext("co-code"); } else { setVerified(full); setCodeSent(false); if (full) focusNext("co-fn"); } }} />
              {DEMO && verified ? <span className="co-ok2">{Ico.check(14)} Verified</span> : null}
            </div>
            {codeSent && !verified ? (
              <div style={{ marginTop: 8 }}>
                <input id="co-code" className="co-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6-digit code" value={code} onChange={(e) => typeCode(e.target.value)} aria-label="6-digit code" />
                <span className="fe" style={{ color: "var(--ink-3)" }}>Code sent to {form.mobile}. On most phones it fills in by itself. <button className="co-again" onClick={sendCode}>Send again</button> · Demo: type any 6 digits.</span>
              </div>
            ) : !verified ? <span className="fe" style={{ color: tried ? "var(--heat-text)" : "var(--ink-3)" }}>{DEMO ? "We text you a code as soon as the number is complete. " : ""}Your free Lifestyle card uses this number.</span> : null}
          </div>
          {DEMO ? (
          <div className={"co-f" + (tried && form.name.trim().length < 2 ? " err" : "")} id="co-name">
            <label htmlFor="co-n">Full name</label>
            <input id="co-n" autoComplete="name" placeholder="Juan dela Cruz" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          ) : (<div id="co-name">
          <div className="co-two">
            <div className={"co-f" + (tried && !(form.first || "").trim() ? " err" : "")}>
              <label htmlFor="co-fn">First name</label>
              <input id="co-fn" autoComplete="given-name" placeholder="Juan" value={form.first} onChange={(e) => setForm({ ...form, first: e.target.value, name: (e.target.value + " " + form.last).trim() })} />
            </div>
            <div className={"co-f" + (tried && !(form.last || "").trim() ? " err" : "")}>
              <label htmlFor="co-ln">Last name</label>
              <input id="co-ln" autoComplete="family-name" placeholder="dela Cruz" value={form.last} onChange={(e) => setForm({ ...form, last: e.target.value, name: (form.first + " " + e.target.value).trim() })} />
            </div>
          </div>
          <div className={"co-f" + (tried && !EMAIL_RE.test((form.email || "").trim()) ? " err" : "")}>
            <label htmlFor="co-em">Email</label>
            <input id="co-em" type="email" inputMode="email" autoComplete="email" placeholder="juan@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <span className="fe" style={{ color: "var(--ink-3)" }}>For your receipt, and the link to finish your free Lifestyle card.</span>
          </div>
          </div>)}
        </>)}
        {forOther ? (<div id="co-rcp">
          <div className="co-grp">Their details</div>
          <div className={"co-f" + (tried && rcp.name.trim().length < 2 ? " err" : "")}>
            <label htmlFor="co-rn">Their full name</label>
            <input id="co-rn" autoComplete="off" placeholder="e.g. Lorna Aquino" value={rcp.name} onChange={(e) => setRcp({ ...rcp, name: e.target.value })} />
          </div>
          <div className={"co-f" + (tried && !rcpOk && rcp.name.trim().length > 1 ? " err" : "")}>
            <label htmlFor="co-rm">Their mobile number</label>
            <input id="co-rm" type="tel" inputMode="tel" autoComplete="off" placeholder="0917 123 4567" value={rcp.mobile} onChange={(e) => { const v = fmtMobile(e.target.value); setRcp({ ...rcp, mobile: v }); if (v.replace(/\D/g, "").length === 11) focusNext("co-cityq"); }} />
            <span className="fe" style={{ color: "var(--ink-3)" }}>{rcpDigits === 11 && rcp.mobile.replace(/\D/g, "") === form.mobile.replace(/\D/g, "") ? "This is your own number. Choose Me instead." : (DEMO ? "Guard your family too. We text them their own free Lifestyle card, and they join under you." : "Guard your family too. They can get their own free Lifestyle card with this number.")}</span>
          </div>
        </div>) : null}
        {swapNote ? (
          <div className="co-swap" role="status">
            <b>This number has a recent order with us.</b>
            The 5-Night Watch is for new buyers, and for anyone with no order in the last 12 months. Your order now has a Blister ({peso(1499)}, 10 capsules) instead.
            <div><button onClick={() => { setSwapNote(false); setStage("shop"); setMode("subscribe"); }}>Or choose a monthly plan and save {pctOff(MONTHLY, 10)}%</button></div>
          </div>
        ) : null}

        <div className="co-grp" id="co-addr">{forOther ? "Deliver to " + (firstName(rcp.name) || "them") : "Deliver to"}</div>
        {!editAddr && addrOk ? (
          <div className="co-saved"><span>{form.street}, {form.brgy}, {form.city}, {form.province}{form.zip ? " " + form.zip : ""}<em className="eta">{etaFor(form.province)}</em></span><button onClick={() => setEditAddr(true)}>Change</button></div>
        ) : (<div className={tried && !addrOk ? "co-need" : ""}>
          <div className="co-f co-city">
            <label htmlFor="co-cityq">City or municipality</label>
            {form.city ? (
              <div className="co-pick"><span><b>{form.city}</b> · {form.province}</span><button onClick={() => { setForm({ ...form, city: "", province: "", brgy: "" }); setCityQ(""); setTimeout(() => { const el = document.getElementById("co-cityq"); if (el) el.focus(); }, 0); }}>Change</button></div>
            ) : (<>
              <input id="co-cityq" autoComplete="off" placeholder="Type your city, e.g. General Santos" value={cityQ} onChange={(e) => setCityQ(e.target.value)} />
              {findCities(cityQ).length ? (
                <div className="co-sugg" role="listbox">
                  {findCities(cityQ).map((c) => <button key={c.city + c.province} role="option" onClick={() => { setForm({ ...form, city: c.city, province: c.province, brgy: "" }); setCityQ(""); focusNext("co-brgy"); }}><b>{c.city}</b><span>{c.province}</span></button>)}
                </div>
              ) : cityQ.trim().length >= 2 ? <span className="fe" style={{ color: "var(--ink-3)" }}>No match yet. Try the first letters of your city or town.</span> : null}
            </>)}
          </div>
          {form.city ? (BRGY === false || (brgyList && !brgyList.length)
            ? <div className="co-f"><label htmlFor="co-brgy">Barangay</label><input id="co-brgy" autoComplete="address-level3" placeholder="Type your barangay" value={form.brgy} onChange={(e) => setForm({ ...form, brgy: e.target.value })} /></div>
            : sel2("brgy", "Barangay", brgyList || [], !brgyList, brgyList ? "Choose barangay" : "Loading barangays…")) : null}
          {form.city ? <div className="co-f"><label htmlFor="co-st">House no. and street</label><input id="co-st" autoComplete="address-line1" placeholder="e.g. 12 Rizal St." value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} /></div> : null}
          {form.city && !DEMO ? <div className={"co-f co-zip" + (tried && !/^\d{4}$/.test(form.zip || "") ? " err" : "")}><label htmlFor="co-zip">ZIP code</label><input id="co-zip" inputMode="numeric" autoComplete="postal-code" maxLength={4} placeholder="9500" value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value.replace(/\D/g, "").slice(0, 4) })} /></div> : null}
          {form.province ? <div className="sl-eta">{Ico.pulse(12)} {etaFor(form.province)}</div> : null}
        </div>)}

        <div className="co-grp" id="co-pay">Pay with</div>
        <div className="co-pays">
          {payOptions.map(([k, l, n]) => (
            <button key={k} className={"co-pay" + (payKey === k ? " on" : "")} onClick={() => setPay(k)} aria-pressed={payKey === k}><span className="rd" /><span><b>{l}</b><small>{n}</small></span></button>
          ))}
        </div>
        {payKey === "install" ? (
          <div className="co-install">
            <div className="co-months" style={{ gridTemplateColumns: "1fr 1fr" }}>{[3, 6].map((m) => <button key={m} className={"co-mo" + (months === m ? " on" : "")} onClick={() => setMonths(m)} aria-pressed={months === m}>{m} months</button>)}</div>
            <div className="co-morow"><span>About, per month</span><b>{peso(perMonth)}</b></div>
            <div className="co-monote">Shown at 0% to help you plan. The final terms and any interest come from the instalment provider when you apply.</div>
          </div>
        ) : null}
        {payKey === "cod" ? <div className="co-cardnote">{Ico.info(13)} Please have {peso(totalToday)} ready in cash for the courier.</div> : null}
        {(payKey === "gcash" || payKey === "maya") ? <div className="co-cardnote">{Ico.lock(13)} {DEMO ? <>You confirm in the {payKey === "gcash" ? "GCash" : "Maya"} app. Your details stay saved here.</> : <>You pay on Maya&apos;s secure page, then come back here. Your details stay saved.</>}</div> : null}
        {payKey === "card" ? <div className="co-cardnote">{Ico.lock(13)} Card details go straight to PayMongo. They never touch our servers.</div> : null}

        <div className="co-tots">
          <div><span>Items</span><span>{peso(itemsTotal)}</span></div>
          {credit ? <div><span>₱499 trial credit</span><span className="good">−{peso(credit)}</span></div> : null}
          {saved ? <div><span>You save <small style={{ color: "var(--ink-3)" }}>vs. buying Blisters</small></span><span className="good">{peso(saved)}</span></div> : null}
          <div><span>{hasOnce ? "Shipping" : "Delivery"}</span><span>{ship ? peso(ship) : "Free"}</span></div>
          <div><span>E-Points you earn</span><span className="gold">+{pts}</span></div>
          <div className="big"><span>{payKey === "cod" ? "Pay on delivery" : payKey === "install" ? "Total, in instalments" : "Total today"}</span><b>{peso(totalToday)}</b></div>
          {daily ? <div className="then">Then {peso(daily.price)} a month from {addDays(30)}.</div> : null}
        </div>
        {daily ? (
          <label className={"co-agree" + (tried && !subAgree ? " err" : "")} id="co-agree"><input type="checkbox" checked={subAgree} onChange={(e) => setSubAgree(e.target.checked)} /><span>{forOther ? "This plan renews every month until I cancel. I pay for it." : "My plan renews every month until I cancel."} I agree to the <u>Subscription Terms</u>.</span></label>
        ) : null}
        {!member ? (refOpen
          ? <div className="co-f" style={{ marginTop: 12 }}><label htmlFor="co-ref">Referral code · optional</label><input id="co-ref" placeholder="e.g. ANACRUZ" value={refCode} onChange={(e) => setRefCode(e.target.value.toUpperCase())} /></div>
          : <button className="co-link" onClick={() => setRefOpen(true)}>Have a referral code?</button>) : null}
        <div className="co-paywrap">
          <button className="btn-primary co-paybtn" onClick={tryPay} disabled={paying}>{payLabel}</button>
          {payErr ? <div className="co-hint" role="alert">{payErr}</div> : null}
          {tried && !canPay ? <div className="co-hint">{!basket.length ? "Your order is empty. Add an item first." : planForMe ? "You already have a plan. Choose Someone else, or change your plan in your Lifestyle page." : !verified ? (DEMO ? "Confirm your mobile number first." : "Add your 11-digit mobile number.") : !nameOk ? (DEMO ? "Add your full name." : "Add your first and last name, and your email.") : !rcpOk ? "Add their full name and mobile number." : !addrOk ? "Add your delivery address." : "Tick the renewal box."}</div> : null}
        </div>
        {trustLine}
        <div className="sl-conote" style={{ marginTop: 6 }}>By paying, you agree to the <u>Terms of Sale</u> and the <u>Privacy Notice</u>.{!member ? (DEMO ? " Your free Lifestyle card is made from these details." : " After paying, you finish your free Lifestyle card in one step.") : ""}</div>
      </div>

      {/* 3 · done */}
      <div ref={stage === "done" ? sheetRef : null} className={"sl-sheet sl-co" + (stage === "done" ? " on" : "")} role="dialog" aria-label="Order placed">
        <div className="sl-grip" />
        {order ? (
          <div className="co-ok">
            <div className="ic">{Ico.check(30)}</div>
            <h3>{order.pay === "cod" ? "Order placed." : order.pay === "install" ? "Instalments approved." : "Payment confirmed."}</h3>
            <p>{order.forOther ? <>Your order for <b>{order.rcpName}</b> is in.{order.newMember ? (DEMO ? " Your Lifestyle card is ready too." : " Finish your own free Lifestyle card below.") : ""}</> : order.becameGuardian ? <>Welcome, Gut Guardian. {DEMO ? <>Your card is ready, <b>{firstName(order.name)}</b>.</> : <>Your card is waiting, <b>{firstName(order.name)}</b>.</>} <i className="cry-in">We Gut You.</i></> : order.newMember ? <>Your Lifestyle card is {DEMO ? "ready" : "waiting"}, <b>{firstName(order.name)}</b>.</> : <>Thank you, <b>{firstName(order.name)}</b>.</>}</p>
            {order.newMember || order.becameGuardian ? (
              <div className="mini-card"><span className="mc-l">{order.becameGuardian ? "GUT GUARDIAN" : "LIFESTYLE MEMBER"}</span><span className="mc-n">{order.name.toUpperCase()}</span><span className="mc-p"><b>+{order.pts}</b> E-Points</span></div>
            ) : <div className="co-pts"><b>+{order.pts}</b> E-Points</div>}
            <div className="co-next">
              <div className="sl-line" style={{ borderTop: "none" }}><div className="nx">01</div><div><div className="ln">{order.forOther ? `We ship to ${firstName(order.rcpName)}` : order.isWatch ? "Your pack is on its way" : "We prepare and ship"}</div><div className="ld2">{etaFor(order.province)}.{order.withOthers ? " Your other items come in the same box." : ""}{DEMO ? " We text you when it ships." : " We emailed your order details."}{order.pay === "cod" ? ` Pay ${peso(order.total)} in cash to the courier.` : ""}{order.pay === "install" ? ` About ${peso(Math.ceil(order.total / order.months))} a month for ${order.months} months, paid to the provider.` : ""}</div></div></div>
              <div className="sl-line"><div className="nx">02</div><div><div className="ln">{order.forOther ? (order.isWatch ? "Night 1 starts when it arrives" : "Their daily dose") : order.isWatch ? "Night 1 starts by itself" : order.peak ? "Your starting dose" : "Your daily dose"}</div><div className="ld2">{order.isWatch ? TRIAL_DOSE.map(([a, b]) => a + ": " + b).join(" · ") + "." + (order.forOther ? "" : " Finish your 5 nights and you become a Gut Guardian.") : (() => { const q = GOALS.find((x) => x.id === order.doseGoal); return (q.mid ? `${q.rev} at Reveille, ${q.mid} at Midday, ${q.taps} at Taps.` : `${q.rev} at Reveille, ${q.taps} at Taps.`) + (q.mid ? " You can adjust it in Settings." : " You can adjust it, or add a Midday dose, in Settings.") + (order.peak ? " It steps down as your score improves." : ""); })()}</div></div></div>
              {order.forOther
                ? <div className="sl-line"><div className="nx">03</div><div><div className="ln">{firstName(order.rcpName)} gets a free Lifestyle card</div><div className="ld2">{DEMO ? <>We sent it by SMS. They track their doses there and join under you. The E-Points are yours{order.daily ? `. You manage their plan in your Lifestyle page` : ""}.</> : <>They sign up free on the Lifestyle page with their own number, then track their doses there.</>}</div></div></div>
                : (order.newMember && !DEMO
                  ? <div className="sl-line"><div className="nx">03</div><div><div className="ln">Finish your free Lifestyle card</div><div className="ld2">Tap the button below and sign up with the same email. Already a member? Log in there instead. Then track doses, reminders and E-Points{order.daily ? `, and your next refill on ${addDays(30)}` : ""}.</div></div></div>
                  : <div className="sl-line"><div className="nx">03</div><div><div className="ln">Track it in your Lifestyle page</div><div className="ld2">Doses, reminders, E-Points{order.daily ? `, and your next refill on ${addDays(30)}` : ""}.</div></div></div>)}
            </div>
            {DEMO ? <label className="co-agree" style={{ marginTop: 0, textAlign: "left" }}><input type="checkbox" checked={smsOk} onChange={(e) => setSmsOk(e.target.checked)} /><span style={{ textAlign: "left" }}>Send me Gutguard tips and offers by SMS (optional)</span></label> : null}
            <a className="btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 14 }} href={DEMO ? LIFESTYLE_HOME + "#" + (order.forOther ? (order.newMember ? "card" : "member") : order.isWatch ? "ordered" : "member") + (order.becameGuardian ? "~guardian" : "~welcome") : order.newMember ? LIFESTYLE_URL + "/?join=shop" : LIFESTYLE_HOME + "?do=" + (order.becameGuardian ? "guardian" : "welcome")} {...link}>{order.newMember && !DEMO ? "Finish my Lifestyle card" : "Open my Lifestyle page"} {Ico.arrow(18)}</a>
            <button className="co-link" style={{ display: "block", margin: "12px auto 0" }} onClick={() => { setStage("shop"); setOrder(null); }}>Back to the shop</button>
          </div>
        ) : null}
      </div>
    </>
  );
}


export default Shop;
