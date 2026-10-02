"use client";
import "./GutguardSite.css";
import { Logo } from "./GutguardLogo.jsx";
export { Logo };
import { useState, useEffect, useRef, useContext, createContext, lazy, Suspense } from "react";
import { ArrowRight, Play, Menu, X, Check, ShoppingBag, Lock, ChevronDown, ArrowLeft } from "lucide-react";
/* the shop API (and the database client inside it) loads only when someone pays: not on every page */

/* ────────────────────────────────────────────────────────────
   Gutguard — Multi-page site (Home · Science · System · Shop · Physicians · About)
   Sept 2026 build: Addenda 01–03. Buying moved to the Lifestyle landing (guests) and the Lifestyle page (members).
   Self-contained hash router + shared shell. Accessibility complete:
   skip link · landmarks · logical headings · focus-trapped dialog
   (Esc to close, focus restored) · route-change focus · dark focus rings.
   Port note: routes → real router pages; CSS string → global layer.
   ──────────────────────────────────────────────────────────── */



/* Production port (Addendum 05). DEMO=1 brings back the prototype controls: visitor switcher, any-6-digit SMS code, fake payments. */
const DEMO = process.env.NEXT_PUBLIC_PROTOTYPE_DEMO === "1";
const LIFESTYLE_URL = (process.env.NEXT_PUBLIC_LIFESTYLE_URL || "https://lifestyle.gutguard.ph").replace(/\/$/, "");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAV = [
  ["Home", "/"],
  ["The Science", "/science"],
  ["The System", "/system"],
  ["Shop", "/shop"],
  ["About", "/about"],
];
const APP_URL = "https://app.gutguard.ph"; /* BioScan / GLIS app — the logged-in product surface */
const DISEASE_FACTORY_URL = "/disease-factory.html"; /* standalone interactive — opens in its own page */

/* ───────────── Pricing and dose — one source (Addendum 01 §9, updated by Addenda 02–03) ─────────────
   Production: move to config/pricing.ts. The server recalculates every price; the page only displays. */
const PROTO_LABEL = "90-Day Protocol"; /* was "Cellular Regeneration & Anti-Aging Program" — pending Dr. Sinchioco */
const LIFESTYLE_JOIN = LIFESTYLE_URL + "/"; /* Lifestyle landing: free card and log-in */
const LIFESTYLE_HOME = LIFESTYLE_URL + "/app"; /* the member page */
/* Links: a page on this site stays in this tab; another page (Lifestyle, landing) opens in a new tab. */
/* Forms: the field being filled is always in view, and the next field comes up by itself. */
const focusNext = (id) => setTimeout(() => { const el = document.getElementById(id); if (el && !el.disabled) { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } bringIntoView(el); } }, 80);
const bringIntoView = (el) => {
  const vv = window.visualViewport; const vh = vv ? vv.height : window.innerHeight;
  const r = el.getBoundingClientRect(); const pay = document.querySelector(".sl-co.on .co-paywrap"); const bottomGap = (pay ? pay.offsetHeight : 0) + 24;
  if (r.top >= 90 && r.bottom <= vh - bottomGap) return;
  const sc = el.closest(".sl-co.on");
  if (sc) { /* inside the checkout sheet: put the field about a third of the way down the space above the Pay button */
    const sr = sc.getBoundingClientRect(); const room = Math.min(vh, (pay ? pay.getBoundingClientRect().top : vh)) - sr.top;
    sc.scrollTo({ top: sc.scrollTop + (r.top - sr.top) - Math.max(16, room * 0.3), behavior: "smooth" });
  } else el.scrollIntoView({ block: "center", behavior: "smooth" });
};
const linkTo = (h) => (/^https?:/.test(h) && !h.startsWith(LIFESTYLE_URL) ? { href: h, target: "_blank", rel: "noopener" } : { href: h });
/* The artifact viewer passes only a plain #word to a linked page (letters, digits . _ ~ -), so links from the Lifestyle pages
   use tokens: #shop~who-sub~tab-protocol → /shop?who=sub&tab=protocol. Production: normal URLs on one domain. */
const normHash = (h) => { h = (h || "").replace(/^#/, ""); if (/^shop(~|$)/.test(h)) { const q = h.split("~").slice(1).map((x) => x.replace("-", "=")).join("&"); return "/shop" + (q ? "?" + q : ""); } return h || "/"; };
const joinUrl = (from) => LIFESTYLE_JOIN + "?from=" + from;      /* from: footer | shop | login */
/* member links carry the member's stage (demo only) and one action: member | continue | plan-keep | buy-peak …
   production: /lifestyle reads the stage from the session and the action from the hash */
const memberUrl = (hash, who) => (DEMO ? LIFESTYLE_HOME + "#" + (who === "trial" ? "trial" : "member") + "~" + hash : LIFESTYLE_HOME + "?do=" + hash);

const GOALS = [
  { id: "keep",   goal: "Keep healthy",  level: "Maintenance", glis: "Moderate",      perDay: 2, rev: 1, mid: 0, taps: 1, mo: 6,  q: 18 },
  { id: "better", goal: "Feel better",   level: "Support",     glis: "Slightly High", perDay: 4, rev: 2, mid: 0, taps: 2, mo: 12, q: 36 },
  { id: "full",   goal: "Full recovery", level: "Intensive",   glis: "High",          perDay: 6, rev: 2, mid: 2, taps: 2, mo: 18, q: 54 },
];
const MONTHLY = 989, QUARTERLY = 890; /* Every 3 months sits on the ₱89/capsule price floor, same as Peak */               /* per blister; 1 blister = 10 capsules */
const TRIAL_OFFER = { price: 499, caps: 10, nights: 5 };   /* first purchase only · free shipping */
const PEAK = { price: 29369, caps: 330, perCap: 89 };      /* ₱88.997 → shown ₱89; buyer pays shipping */
const OTHER = [
  { id: "blister", name: "1 blister", caps: 10, price: 1499 },
  { id: "bottle",  name: "Bottle",    caps: 30, price: 3799 },
  { id: "start",   name: "Start",     caps: 30, price: 3999 },
  { id: "grow",    name: "Grow",      caps: 90, price: 10999 },
];
const PHASES = [
  ["Repair", "Weeks 1–4. Start at your level.", "Reseat the gut microbiome and support the barrier — the foundation."],
  ["Calm", "Weeks 5–8. Your dose steps down as your score improves.", "As the gut settles, systemic inflammation eases — where your GLIS begins to move."],
  ["Regenerate", "Weeks 9–12. Hold your gains.", "With inflammation down, the Gut-Mitochondrial Axis re-engages — recovery, powered."],
];
const peso = (n) => "₱" + n.toLocaleString("en-PH");

/* ---- visitor state ---- production: read from the session. The demo chip switches it. */
const VisitorCtx = createContext({ who: "guest", setWho: () => {}, failNext: false, setFailNext: () => {}, usedBefore: false, setUsedBefore: () => {} });
const useVisitor = () => useContext(VisitorCtx);
const VISITORS = [
  ["guest", "New visitor"],
  ["card", "Card-only member (no order yet)"],
  ["trial", "Trial member (no plan yet)"],
  ["sub", "Gutguard Daily subscriber"],
  ["peak", "Peak buyer"],
];
const isMember = (who) => who !== "guest";

/* signature motion: measurement numbers resolve into view (the "we measure" feel) */
function CountUp({ to, from = 0, prefix = "", suffix = "", dur = 1300 }) {
  const [val, setVal] = useState(from);
  const ref = useRef(null);
  const done = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setVal(to); return; }
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && !done.current) {
          done.current = true;
          const t0 = performance.now();
          const tick = (now) => {
            const p = Math.min(1, (now - t0) / dur);
            const eased = 1 - Math.pow(1 - p, 3);
            setVal(Math.round(from + (to - from) * eased));
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      });
    }, { threshold: 0.6 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [to, from, dur]);
  return <span ref={ref}>{prefix}{val}{suffix}</span>;
}

/* brand iconography — one rounded line language with node accents that echo the logo molecule */
function Svg({ size = 24, sw = 1.7, children }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}
const IconGuard = ({ size }) => <Svg size={size}><path d="M12 2.6 L19.4 5.6 V11 C19.4 15.7 16.1 19.1 12 21.3 C7.9 19.1 4.6 15.7 4.6 11 V5.6 Z" /><path d="M8.7 11.7 L11 14 L15.4 9.3" /></Svg>;
const IconClinical = ({ size }) => <Svg size={size}><circle cx="12" cy="12" r="8.4" /><path d="M12 8 V16 M8 12 H16" /></Svg>;
const IconPeople = ({ size }) => <Svg size={size}><circle cx="8.6" cy="8" r="3" /><circle cx="15.4" cy="8" r="3" /><path d="M3.8 19 C3.8 15.4 5.9 13.8 8.6 13.8 C9.7 13.8 10.6 14.1 11.3 14.7" /><path d="M12.7 14.7 C13.4 14.1 14.3 13.8 15.4 13.8 C18.1 13.8 20.2 15.4 20.2 19" /></Svg>;
const IconNetwork = ({ size }) => <Svg size={size}><path d="M6 6.4 L18 6.4 M6 6.4 L12 17.3 M18 6.4 L12 17.3" /><circle cx="6" cy="6.4" r="2.35" fill="currentColor" stroke="none" /><circle cx="18" cy="6.4" r="2.35" fill="currentColor" stroke="none" /><circle cx="12" cy="17.3" r="2.35" fill="currentColor" stroke="none" /></Svg>;
const IconPin = ({ size }) => <Svg size={size}><path d="M12 21.2 C12 21.2 5.6 14.6 5.6 9.6 A6.4 6.4 0 0 1 18.4 9.6 C18.4 14.6 12 21.2 12 21.2 Z" /><circle cx="12" cy="9.6" r="2.2" fill="currentColor" stroke="none" /></Svg>;
const IconPulse = ({ size }) => <Svg size={size}><path d="M2.5 12.5 H6.6 L9.2 6 L12.9 17.6 L15.4 12.5 H21.5" /><circle cx="21.5" cy="12.5" r="1.5" fill="currentColor" stroke="none" /></Svg>;

/* signature illustration — the SynBIOTIC+ capsule: inflammation (heat) → recovery (blue), bridged by the biotic molecule */
function IllustCapsule({ className, style }) {
  return (
    <svg className={className} style={style} viewBox="52 78 376 124" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="capHeat" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FF8A6B" /><stop offset="1" stopColor="#E24A22" /></linearGradient>
        <linearGradient id="capRec" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4FA3DE" /><stop offset="1" stopColor="#1E6FB8" /></linearGradient>
        <clipPath id="capPill"><rect x="70" y="95" width="340" height="90" rx="45" /></clipPath>
      </defs>
      <g clipPath="url(#capPill)">
        <rect x="70" y="95" width="172" height="90" fill="url(#capHeat)" />
        <rect x="238" y="95" width="172" height="90" fill="url(#capRec)" />
        <ellipse cx="150" cy="120" rx="90" ry="16" fill="#fff" opacity="0.22" />
        <ellipse cx="320" cy="120" rx="90" ry="16" fill="#fff" opacity="0.22" />
        <g stroke="#FCFAF5" strokeWidth="3" fill="#FCFAF5">
          <line x1="205" y1="140" x2="240" y2="128" /><line x1="240" y1="128" x2="275" y2="150" /><line x1="240" y1="128" x2="248" y2="108" />
          <circle cx="205" cy="140" r="8" /><circle cx="240" cy="128" r="10" /><circle cx="275" cy="150" r="8" /><circle cx="248" cy="108" r="6" />
        </g>
        <rect x="238" y="95" width="4" height="90" fill="#FCFAF5" />
      </g>
      <rect x="70" y="95" width="340" height="90" rx="45" fill="none" stroke="#141019" strokeOpacity="0.14" strokeWidth="2" />
    </svg>
  );
}

/* signature molecular constellation — the node motif as ambient texture (logo → icons → data-viz → decoration) */
function Constellation() {
  return (
    <svg className="constellation" viewBox="0 0 100 58" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="ggNode" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FF5E3A" /><stop offset=".5" stopColor="#B08D5B" /><stop offset="1" stopColor="#2F86C9" />
        </linearGradient>
      </defs>
      <g stroke="#2F86C9" strokeWidth="0.18" opacity="0.42">
        <line x1="12" y1="14" x2="27" y2="9" /><line x1="12" y1="14" x2="20" y2="30" /><line x1="27" y1="9" x2="38" y2="22" />
        <line x1="20" y1="30" x2="38" y2="22" /><line x1="38" y1="22" x2="50" y2="12" /><line x1="38" y1="22" x2="46" y2="38" />
        <line x1="50" y1="12" x2="63" y2="26" /><line x1="46" y1="38" x2="63" y2="26" /><line x1="63" y1="26" x2="74" y2="15" />
        <line x1="63" y1="26" x2="70" y2="44" /><line x1="74" y1="15" x2="87" y2="30" /><line x1="70" y1="44" x2="84" y2="50" />
        <line x1="87" y1="30" x2="84" y2="50" /><line x1="46" y1="38" x2="34" y2="48" /><line x1="34" y1="48" x2="52" y2="52" />
        <line x1="52" y1="52" x2="70" y2="44" /><line x1="20" y1="30" x2="34" y2="48" />
      </g>
      <g fill="#2F86C9" opacity="0.5">
        <circle cx="12" cy="14" r="0.6" /><circle cx="27" cy="9" r="0.5" /><circle cx="20" cy="30" r="0.55" />
        <circle cx="50" cy="12" r="0.6" /><circle cx="74" cy="15" r="0.55" /><circle cx="87" cy="30" r="0.6" />
        <circle cx="34" cy="48" r="0.5" /><circle cx="84" cy="50" r="0.55" /><circle cx="70" cy="44" r="0.5" />
      </g>
      <g fill="url(#ggNode)" className="cn-hero">
        <circle cx="38" cy="22" r="1.5" /><circle cx="63" cy="26" r="1.7" /><circle cx="46" cy="38" r="1.3" /><circle cx="52" cy="52" r="1.2" />
      </g>
    </svg>
  );
}

/* modern-lifestyle inflammation triggers (PH-localized) */
const TRIGGERS = [
  ["01", "Ultra-processed food", "+50% heart-disease death", "Energy-dense meals and sweet drinks flood the liver faster than it can clear.", "Visceral fat & inflammatory load"],
  ["02", "Chronic stress", "≈2× heart-attack risk", "Money worries, work that never switches off, and a mind that won't stop at night.", "Cortisol keeps the fire lit"],
  ["03", "Too little sleep", "+48% heart-disease risk", "Most of us run below the 7–9 hours the body needs to repair.", "Repair never finishes"],
  ["04", "Sedentary days", "up to +59% mortality risk", "Eight-plus hours seated, in office and screen culture.", "Less cellular renewal"],
  ["05", "Environmental load", "99% breathe unsafe air", "Air pollution now exceeds safe limits for almost everyone on Earth.", "Oxidative stress"],
  ["06", "Gut disruptors", "9 gut species still gone at 6 months", "One course of antibiotics can strip beneficial microbes that don't fully return.", "Gut–mitochondria axis disrupted"],
];

/* SynBIOTIC+ composition — 17 live strains. Wellness / structure-function language only; no disease claims. */
const STRAINS = [
  ["L. acidophilus", "A cornerstone strain; supports healthy gut microflora and everyday digestion."],
  ["L. rhamnosus", "Supports the gut lining and a healthy inflammatory response."],
  ["L. plantarum", "Helps maintain gut balance, including during antibiotic use, and supports nutrient absorption."],
  ["L. casei", "Supports digestive regularity and immune balance."],
  ["L. paracasei", "Supports digestive function and gut microbial balance."],
  ["L. bulgaricus", "A classic yogurt culture; supports a settled, balanced gut."],
  ["L. reuteri", "Supports the gut's natural balance and everyday immune resilience."],
  ["L. gasseri", "Supports immune balance and healthy digestion."],
  ["L. salivarius", "Supports gut microbial balance and calmer inflammatory signaling."],
  ["L. fermentum", "Supports good digestive activity and antioxidant defense."],
  ["L. brevis", "A resilient lactic-acid strain that supports a balanced gut."],
  ["B. coagulans (LactoSpore®)", "The spore-forming strain (formerly named L. sporogenes); its spore coat survives stomach acid to reach the gut."],
  ["L. helveticus", "Studied for the gut–brain axis; supports a balanced stress response."],
  ["L. sakei", "Supports the body's natural microbial balance."],
  ["L. buchneri", "A fermentation strain that adds to the formula's microbial diversity."],
  ["L. iners", "A naturally occurring, human-associated strain contributing to microbial diversity."],
  ["L. jensenii", "A naturally occurring, human-associated strain that supports microbial balance."],
];

/* per-page section jump-nav — shown persistently under the nav */
const SECTIONS = {
  "/": [["Why now", "why-now"], ["The cost", "cost"], ["Protocol", "protocol"], ["Your dose", "dose"], ["Evidence", "evidence"]],
  "/science": [["Mechanism", "mechanism"], ["Triggers", "triggers"], ["Measure", "measure"], ["Standard", "standard"]],
  "/system": [["The Stack", "stack"], ["Proof", "proof"], ["Two Reads", "readings"]],
};

/* full site map — pages + their sections, for the footer overview + "you are here" */
const SITEMAP = [
  ["Home", "/", [["Why now", "why-now"], ["The cost", "cost"], ["The protocol", "protocol"], ["Your dose", "dose"], ["Evidence", "evidence"]]],
  ["The Science", "/science", [["Mechanism", "mechanism"], ["Triggers", "triggers"], ["How we measure", "measure"], ["The standard", "standard"]]],
  ["The System", "/system", [["The stack", "stack"], ["Proof", "proof"], ["Two reads", "readings"]]],
  ["Shop", "/shop", [["Buy SynBIOTIC+", "buy"]]],
  ["For Physicians", "/physicians", [["What you'd practice", "practice"], ["Recovery rationale", "rationale"]]],
  ["About", "/about", [["Mission", "mission"], ["What we do", "what"], ["Credentials", "credentials"], ["People", "people"]]],
];

const Arrow = () => <span className="arr"><ArrowRight size={13} /></span>;

/* ── reveal-on-scroll, re-run whenever the route changes ── */
function useReveal(dep) {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const els = Array.from(document.querySelectorAll(".reveal:not(.in)"));
    if (reduce) { els.forEach((e) => e.classList.add("in")); return; }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }),
      { threshold: 0.15, rootMargin: "0px 0px -6% 0px" }
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [dep]);
}

function Nav({ route, scrolled, open, setOpen, sheetRef, burgerRef }) {
  const here = (SITEMAP.find(([, r]) => r === route) || [])[0];
  const { who } = useVisitor();
  const member = isMember(who);
  return (
    <>
      <nav className={"nav" + (scrolled ? " scrolled" : "")} aria-label="Primary">
        <div className="nav-inner">
          <div className="nav-lead">
            {route !== "/" && <button className="nav-back" aria-label="Go back to the previous screen" onClick={() => window.history.back()}><ArrowLeft size={18} /></button>}
            <a className="brand" href="#/" aria-label="Gutguard home"><Logo h={26} /></a>
            {here && <span className="nav-here" aria-hidden="true">{here}</span>}
          </div>
          <div className="nav-links">
            {NAV.map(([l, r]) => (
              <a key={r} href={"#" + r} aria-current={route === r ? "page" : undefined}>{l}</a>
            ))}
          </div>
          {!member && <a className="nav-login" href={joinUrl("login")} target="_blank" rel="noopener" aria-label="Log in to your Lifestyle page">Log in</a>}
          <a className="nav-cta" {...linkTo(member ? memberUrl("member", who) : "#/shop?start=watch")}>{member ? "My Lifestyle" : "Start my 5 nights"} <ArrowRight size={14} /></a>
          <button ref={burgerRef} className="burger" aria-label="Open menu" aria-haspopup="dialog" aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen(true)}>
            <Menu size={20} />
          </button>
        </div>
      </nav>
      <div id="mobile-menu" ref={sheetRef} className={"sheet" + (open ? " open" : "")} role="dialog" aria-modal="true" aria-label="Site menu">
        <button className="burger sheet-close" aria-label="Close menu" onClick={() => setOpen(false)}><X size={20} /></button>
        {NAV.map(([l, r], i) => (
          <a key={r} href={"#" + r} aria-current={route === r ? "page" : undefined} onClick={() => setOpen(false)}>
            <em>{String(i + 1).padStart(2, "0")}</em>{l}
          </a>
        ))}
        <a className="nav-cta" {...linkTo(member ? memberUrl("member", who) : "#/shop?start=watch")} onClick={() => setOpen(false)}>{member ? "My Lifestyle" : "Start my 5 nights · ₱499"} <ArrowRight size={16} /></a>
        {!member && <a className="sheet-login" href={joinUrl("login")} target="_blank" rel="noopener">Already a member? Log in to your Lifestyle page →</a>}
      </div>
    </>
  );
}

function Footer({ route, goTo }) {
  return (
    <footer>
      <div className="wrap">
        <nav className="sitemap" aria-label="Site map">
          {SITEMAP.map(([label, r, secs]) => (
            <div className={"smap-col" + (route === r ? " here" : "")} key={r}>
              <a className="smap-head" href={"#" + r} aria-current={route === r ? "page" : undefined}>
                {label}
                {route === r && <span className="smap-you">You are here</span>}
              </a>
              <ul className="smap-list">
                {secs.map(([sl, id]) => (
                  <li key={id}><button type="button" className="smap-sec" onClick={() => goTo(r, id)}>{sl}</button></li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="foot-inner">
          <div className="foot-brand">
            <Logo h={30} />
            <div className="cry">We Gut You.</div>
          </div>
          <nav className="foot-nav" aria-label="Footer">
            <a href="#/about">About Gutguard</a>
            <a href={joinUrl("login")} target="_blank" rel="noopener">Log in to your Lifestyle page</a>
            <a href="#/legal">Terms of Sale · Subscription Terms · Refund Policy · Privacy Notice</a>
          </nav>
          <div className="foot-legal">
            GUTGUARD CORPORATION<br />
            FDA CPR No. FR-40000015571456 · LTO-30000007262499<br />
            Davao City · Philippines · 20 branches
          </div>
        </div>
      </div>
    </footer>
  );
}

function TrustStrip() {
  const items = [["FDA", "Registered · CPR FR-400…456"], ["USAID", "Funded science"], ["MSU-IIT", "Co-developed R&D"], ["20", "Branches nationwide"], ["80B", "CFU · 17 strains"]];
  return (
    <section className="trust"><div className="wrap"><div className="trust-grid reveal">
      {items.map(([n, l]) => <div className="trust-item" key={l}><div className="n">{n}</div><div className="l">{l}</div></div>)}
    </div></div></section>
  );
}

function Compliance() {
  return (
    <section className="section" style={{ paddingTop: 0 }}><div className="wrap">
      <div className="compliance reveal">
        <div className="comp-seal"><IconGuard size={26} /></div>
        <div className="comp-txt">
          <h3>Honest by design</h3>
          <div className="b">Across every page, we describe effects on <em>inflammation, not disease</em>, and we don’t overstate what the product does. For personal health decisions, consult a licensed physician.</div>
        </div>
      </div>
    </div></section>
  );
}

function MeasureSection({ heading = true }) {
  return (
    <section className="section measure"><Constellation /><div className="wrap">
      {heading && (
        <div className="reveal">
          <div className="sec-label" id="your-number"><span className="num">03</span> Your number</div>
          <h2 className="sec">One number you’ll remember: <em>your MiAge.</em></h2>
          <p className="sec-sub">From the lab tests you already have, we read two things. Your Lifestyle Inflammation Score (GLIS) measures low-grade chronic systemic inflammation — what doctors track with markers like hs-CRP, and what science calls inflammaging as it builds with age.<sup><a href="#ref2">2</a></sup> It reads as a cardiometabolic composite: not just inflammatory markers, but the metabolic sources that fuel them, like visceral fat and insulin resistance. Your MiAge then translates that into a biological age in years, set against your real age.</p>
        </div>
      )}
      <div className="miage-block reveal">
        <div className="miage-hero">
          <span className="mh-label">MiAge · Mitochondrial Age <span className="mh-beta">Beta</span></span>
          <div className="mh-num"><CountUp to={48} /><span>yrs</span></div>
          <p className="mh-desc">Mitochondria are your cells’ engine and repair system. Chronic inflammation wears them down, and worn mitochondria fuel more inflammation — a loop aging science treats as a core driver of how fast we age.<sup><a href="#ref9">9</a></sup> Because mitochondrial decline is a hallmark of that aging,<sup><a href="#ref11">11</a></sup> we name your biological age after it. Calendar age 41, MiAge 48 means your body may be running about seven years ahead — a gap to close, not a diagnosis.</p>
        </div>
        <div className="miage-supports">
          <div className="ms-card">
            <span className="ms-name">Blood Scan <small>BioScan</small></span>
            <p>Upload or photograph the blood test results you already have. The system reads your biomarkers from a routine, affordable panel — no special kit, no partner lab, and none of the costly DNA testing other biological-age clocks require.</p>
          </div>
          <div className="ms-card">
            <span className="ms-name">Lifestyle Inflammation Score <small>GLIS</small></span>
            <p>A 0–100 read of that inflammation across inflammatory, metabolic and adiposity markers, with a confidence rating. The signal your MiAge is built on.</p>
          </div>
        </div>
      </div>
      <div className="miage-method reveal">
        <span className="mm-label">How MiAge is derived</span>
        <p>MiAge is a validated-method biological age from a routine, affordable blood test — no expensive DNA lab. Where your panel is complete, it’s anchored on the PhenoAge algorithm<sup><a href="#ref10">10</a>,<a href="#ref14">14</a></sup> and extended with cardiometabolic markers standard clocks leave out — insulin resistance, uric acid, adiposity.<sup><a href="#ref12">12</a>,<a href="#ref13">13</a></sup> Confidence rises with how complete your panel is. MiAge is in Beta — it runs on our v1 formulary while an independent clinical study is ongoing. A wellness indicator, not a diagnostic.</p>
      </div>
      <a className="measure-link reveal" href={DISEASE_FACTORY_URL} target="_blank" rel="noopener">See the mechanism behind your MiAge — the Disease Factory: how gut leakage drives inflammation and mitochondrial aging <ArrowRight size={15} /></a>
      <Trajectory note={<>Every re-test is a checkpoint you can see. Watching your own MiAge fall — a measurement, not a promise — is what carries people through all 90 days.</>} />
    </div></section>
  );
}

/* MiAge trajectory — one point per scan. Edit these to real numbers when available. */
const TRAJ = {
  calendarAge: 41,
  scans: [
    ["Day 0", 48, "Baseline"],
    ["Day 30", 46, ""],
    ["Day 60", 44, ""],
    ["Day 90", 42, "Re-test"],
  ],
};

/* interpolate hex colour a→b by t∈[0,1] — graduates the dots heat→recovery */
function lerpHex(a, b, t) {
  const ch = (h, i) => parseInt(h.slice(i, i + 2), 16);
  const mix = (x, y) => Math.round(x + (y - x) * t).toString(16).padStart(2, "0");
  return `#${mix(ch(a, 1), ch(b, 1))}${mix(ch(a, 3), ch(b, 3))}${mix(ch(a, 5), ch(b, 5))}`;
}

function Trajectory({ note }) {
  const HEAT = "#FF5E3A", REC = "#2F86C9";
  const { calendarAge, scans } = TRAJ;
  const vals = scans.map((s) => s[1]);
  const yMax = Math.max(...vals, calendarAge) + 1;
  const yMin = Math.min(...vals, calendarAge) - 1;
  const xP = (i) => 5 + (i / (scans.length - 1)) * 90;
  const yP = (v) => 8 + ((yMax - v) / (yMax - yMin)) * 78;
  const pts = scans.map((s, i) => [xP(i), yP(s[1])]);
  const line = pts.map((p) => `${p[0]},${p[1]}`).join(" ");
  const area = "M " + pts.map((p) => `${p[0]},${p[1]}`).join(" L ") + ` L ${pts[pts.length - 1][0]},96 L ${pts[0][0]},96 Z`;
  const first = scans[0][1], last = scans[scans.length - 1][1];
  const calY = yP(calendarAge);
  return (
    <div className="traj reveal">
      <div className="traj-top">
        <span className="t">The 90-day trajectory</span>
        <span className="traj-lbi">↓ lower is better</span>
      </div>

      <div className="traj-delta">
        <div className="td-main"><b>−{first - last}</b><span>MiAge years<br />across the scans</span></div>
        <div className="td-flow">{first}<ArrowRight size={14} />{last}
          <small>The gap to your calendar age narrows from {first - calendarAge} to {last - calendarAge} years.</small>
        </div>
      </div>

      <div className="traj-plot">
        <svg className="traj-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="trajLine" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="100" y2="0">
              <stop offset="0" stopColor={HEAT} /><stop offset="1" stopColor={REC} />
            </linearGradient>
            <linearGradient id="trajFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={HEAT} stopOpacity="0.16" /><stop offset="1" stopColor={REC} stopOpacity="0.015" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#trajFill)" />
          <line x1="0" y1={calY} x2="100" y2={calY} stroke="#8598AE" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" vectorEffect="non-scaling-stroke" />
          <polyline points={line} pathLength="1" fill="none" stroke="url(#trajLine)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>

        <span className="traj-cal" style={{ top: `${calY}%` }}>Calendar age {calendarAge}</span>

        {scans.map((s, i) => {
          const col = lerpHex(HEAT, REC, i / (scans.length - 1));
          const isLast = i === scans.length - 1;
          return (
            <div key={i} className={"traj-pt" + (isLast ? " last" : "")} style={{ left: `${pts[i][0]}%`, top: `${pts[i][1]}%` }}>
              <span className="tp-val" style={{ color: col }}>{s[1]}</span>
              <span className="tp-dot" style={{ borderColor: col, background: isLast ? col : "var(--slate-2)" }} />
            </div>
          );
        })}
      </div>

      <div className="traj-x">
        {scans.map((s, i) => {
          const isFirst = i === 0, isLast = i === scans.length - 1;
          return (
            <span key={i} style={{ left: `${pts[i][0]}%`, transform: `translateX(${isFirst ? "0" : isLast ? "-100%" : "-50%"})`, alignItems: isFirst ? "flex-start" : isLast ? "flex-end" : "center" }}>
              {s[0]}{s[2] && <small>{s[2]}</small>}
            </span>
          );
        })}
      </div>

      <p className="traj-ex">Illustrative example · individual results vary. Your real scans are tracked in the Gutguard app.</p>
      {note && <p className="traj-note">{note}</p>}
    </div>
  );
}

/* ───────────────────────── PAGES ───────────────────────── */

/* Story of Hope — a real, consented member replaces this before launch. Felt results only:
   no MiAge, GLIS or lab numbers in testimony while MiAge is in Beta. */
const STORY = {
  name: "[Member name]",
  realAge: "[age]",
  city: "[City]",
  months: 3,
  quoteShort: "[Their words, in one line]",
  quoteOpen: "[How they felt before starting, in their words]",
  felt: [
    ["Week 3", "[First change they noticed]", "Self-reported"],
    ["Week 6", "[Second change]", "Self-reported"],
    ["Week 9", "[The change they tell people about]", "Self-reported"],
  ],
  placeholder: true,
};

function StoryOfHope() {
  const s = STORY;
  return (
    <section className="section soh-section"><div className="wrap">
      <div className="soh reveal">
        <div className="soh-portrait">
          <span className="soh-eyebrow">Story of Hope</span>
          <div className="soh-photo" aria-label="Portrait placeholder"><span>Portrait</span></div>
          <p className="soh-q">“{s.quoteShort}”</p>
          <span className="soh-rule" />
          <div className="soh-name">{s.name}</div>
          <div className="soh-metar">Age <b>{s.realAge}</b> · {s.city}</div>
          {s.placeholder && <div className="soh-ph">Placeholder · a real, consented member is added before launch</div>}
        </div>
        <div className="soh-proof">
          <h3 className="soh-h">What they <em>felt.</em></h3>
          <div className="soh-tether">In their own words, over {s.months} months on the protocol</div>
          <p className="soh-long">&ldquo;{s.quoteOpen}&rdquo;</p>
          <div className="soh-felt">
            {s.felt.map(([wk, quote, sub]) => (
              <div className="soh-fr" key={wk}>
                <div className="soh-wk">{wk}</div>
                <div><p className="soh-ft">&ldquo;{quote}&rdquo;</p><div className="soh-fs">{sub}</div></div>
              </div>
            ))}
          </div>
          <p className="soh-caveat">These are self-reported experiences, not clinical outcomes, and individual results vary. Gutguard does not treat, cure or prevent any disease.</p>
        </div>
      </div>
    </div></section>
  );
}

/* Primary call to action — follows the visitor state */
function StartCTA({ anchor }) {
  const { who } = useVisitor();
  const m = isMember(who);
  const extra = anchor ? { "data-buyanchor": true } : {};
  return <a className="btn-primary" {...linkTo(m ? (who === "trial" ? "#/shop?tab=subscribe" : memberUrl("member", who)) : "#/shop?start=watch")} {...extra}>{m ? (who === "trial" ? "Continue your plan" : "Open my Lifestyle page") : "Start my 5 nights · ₱499"} <Arrow /></a>;
}

function Home() {
  const signals = [
    ["Cardiovascular", "Arterial damage, silently", "Chronic inflammation is a recognized driver of vascular damage — accumulating for years before a single symptom shows.", 5],
    ["Metabolic", "Insulin resistance", "A central force behind the metabolic decline that runs ahead of type 2 diabetes.", 6],
    ["Cognitive", "An aging brain", "“Inflammaging” is increasingly tied to memory and cognitive loss as the years compound.", 7],
  ];
  return (
    <>
      <header className="hero" id="top">
        <div className="wrap"><div className="hero-grid">
          <div className="hero-copy reveal">
            <span className="eyebrow">Science-backed · FDA-registered</span>
            <h1>Your body’s silently aging toward disease. <em>Take back control.</em></h1>
            <p className="hero-lede">Chronic inflammation drives that aging — silently, for years before symptoms. <strong>Now you can control it.</strong> A blood scan shows the 90-day protocol can bring it down. <strong>Progress you can see.</strong></p>
            <div className="hero-actions">
              <StartCTA />
              <a className="btn-ghost" href="#/system"><span className="ring"><ArrowRight size={13} /></span>See how it works</a>
            </div>
            <ul className="hero-proof reveal" aria-label="Why this is credible">
              <li>FDA-registered formula</li>
              <li>Research with MSU-IIT</li>
              <li>Physician-led clinical program</li>
              <li>20 branches nationwide</li>
            </ul>
          </div>
          <div className="hero-visual reveal">
            <div className="portrait" role="img" aria-label="A Gutguard member in warm daylight (graded photography placeholder)">
              <div className="grade" aria-hidden="true" /><div className="grain" aria-hidden="true" /><div className="vig" aria-hidden="true" />
              <span className="ph" aria-hidden="true">Portrait · warm duotone treatment</span>
            </div>
            <div className="bioscan reveal" aria-label="Example Blood Scan readout">
              <div className="bs-top"><span className="bs-label">Blood Scan</span><span className="bs-beta">Beta test</span></div>
              <div className="bs-reads">
                <div className="bs-read"><small>hs-CRP</small><span className="v">4.8</span></div>
                <div className="bs-read now"><small>Inflammation</small><span className="v"><CountUp to={62} /></span></div>
                <div className="bs-read"><small>Level</small><span className="v" style={{ fontSize: 20 }}>High</span></div>
              </div>
              <div className="bs-bars">
                <div className="bs-bar"><span className="k">Inflammation</span><div className="bs-track"><div className="bs-fill heat" style={{ "--w": "62%" }} aria-hidden="true" /></div></div>
                <div className="bs-bar"><span className="k">Restored</span><div className="bs-track"><div className="bs-fill rec" style={{ "--w": "38%" }} aria-hidden="true" /></div></div>
              </div>
              <span className="bs-sample">Sample readout · not yet live</span>
            </div>
          </div>
        </div></div>
      </header>

      <hr className="seam" />

      <section className="section" style={{ paddingBottom: 0 }}><div className="wrap">
        <TrialBand id="trial" />
      </div></section>

      <section className="section younger"><div className="wrap">
        <div className="reveal">
          <div className="sec-label" id="why-now"><span className="num">01</span> Why now</div>
          <h2 className="sec">The body can age faster than the calendar — and it’s <em>starting younger.</em></h2>
          <p className="sec-sub">Ultra-processed food, chronic stress, and too little sleep drive chronic low-grade inflammation.<sup><a href="#ref1">1</a></sup> Once tied to later life, it now shows up in the 20s and 30s.</p>
        </div>
        <div className="stat-row reveal">
          <div className="stat"><span className="stat-n">20s–30s</span><span className="stat-l">when inflammation-driven wear now commonly begins</span></div>
          <div className="stat"><span className="stat-n">+10<small>yrs</small></span><span className="stat-l">how far biological age can run ahead of your real age</span></div>
          <div className="stat"><span className="stat-n">1 in 3</span><span className="stat-l">young adults already carrying early metabolic strain</span></div>
        </div>
        <p className="stat-note reveal">Illustrative figures — to be replaced with your verified, cited data.</p>
        <p className="sec-body reveal" style={{ marginTop: 28 }}>You can’t feel low-grade inflammation. You can measure it — and the earlier you do, the more time you have to act.</p>

        <figure className="review reveal">
          <div className="review-q">“I’m 23 and felt completely fine — my first number said otherwise. Three months in, watching it drop was proof I didn’t know I needed.”</div>
          <figcaption className="review-who">
            <div className="review-av" aria-hidden="true">—</div>
            <div><div className="review-nm">[Name], 23</div><div className="review-role">[City] · placeholder — drop in your real consented review</div></div>
          </figcaption>
        </figure>
      </div></section>

      <section className="section" style={{ background: "var(--paper)", borderTop: "1px solid var(--rule)", borderBottom: "1px solid var(--rule)" }}>
        <div className="wrap">
          <div className="reveal">
            <div className="sec-label" id="cost"><span className="num">02</span> The cost of not knowing</div>
            <h2 className="sec">What chronic inflammation does <em>before symptoms appear.</em></h2>
            <p className="sec-sub">Unmeasured, it builds for years — and it’s now linked to the leading causes of death and disability worldwide.<sup><a href="#ref1">1</a></sup></p>
            <p className="sec-body">Most people never measure it, so they learn of it only once a diagnosis names it.</p>
          </div>
          <p className="reveal" style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--heat-text)", marginTop: 48, marginBottom: 0 }}>Left unchecked, it’s linked to —</p>
          <div className="grid3 reveal" style={{ marginTop: 18 }}>
            {signals.map(([tag, h, b, r]) => (
              <div className="symptom" key={h}><div className="tag">{tag}</div><h3>{h}</h3><div className="b">{b}<sup><a href={"#ref" + r}>{r}</a></sup></div></div>
            ))}
          </div>
        </div>
      </section>

      <MeasureSection />
      <StoryOfHope />

      <section className="section"><div className="wrap">
        <div className="reveal">
          <div className="sec-label" id="protocol"><span className="num">04</span> The protocol</div>
          <h2 className="sec">Three steps. Ninety days. <em>One</em> flagship.</h2>
          <p className="sec-sub">SynBIOTIC+ — the Gut-Mitochondrial Axis, powered.</p>
          <p className="sec-body" style={{ marginTop: 10 }}>Take it at <b>Reveille</b> (first thing in the morning, empty stomach) and at <b>Taps</b> (just before bedtime). Your dose follows your goal — see <a href="#/" onClick={(e) => { e.preventDefault(); const el = document.getElementById("dose"); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 116, behavior: "smooth" }); }} style={{ color: "var(--blue)", fontWeight: 600 }}>Find your dose</a>.</p>
        </div>
        <div className="proto-grid reveal">
          <div className="product" role="img" aria-label="SynBIOTIC+ (illustration)">
            <IllustCapsule className="prod-cap" />
            <div className="bottle">SynBIOTIC+</div>
            <div className="plus">Pre · Pro · Post Biotics</div>
            <div className="spec">80 Billion CFU · 17 strains · Urolithin-A + L-Tryptophan</div>
          </div>
          <div className="steps">
            {[["I", "Repair the gut environment", <>Pre-, pro- and postbiotics support the gut lining — including replenishing beneficial bacteria after a course of antibiotics<sup><a href="#ref8">8</a></sup> — where much of the body’s inflammatory signaling begins.</>],
              ["II", "Lower systemic inflammation", "As gut function improves, systemic inflammatory load can fall."],
              ["III", "Activate cellular renewal", <>The postbiotic Urolithin-A triggers mitophagy — the cell’s renewal of its mitochondria. In clinical trials, urolithin-A improved biomarkers of mitochondrial health in adults.<sup><a href="#ref3">3</a>,<a href="#ref4">4</a></sup></>]].map(([n, h, p]) => (
              <div className="step-row" key={n}><div className="step-n" aria-hidden="true">{n}</div><div className="step-tx"><h3>{h}</h3><p>{p}</p></div></div>
            ))}
          </div>
        </div>
      </div></section>


      <PhasesBlock />
      <DoseBlock num="05" />

      <TrustStrip />

      <section className="section"><div className="wrap">
        <div className="reveal">
          <div className="sec-label" id="doors"><span className="num">06</span> Other doors</div>
          <h2 className="sec">Here for a different reason? <em>These doors open soon.</em></h2>
        </div>
        <div className="doors-soon reveal">
          <span className="soon-badge">Under construction</span>
          <h3>Pathways for physicians, partners, and organizations</h3>
          <p>Dedicated entry points are opening after launch — check back soon.</p>
        </div>
      </div></section>

      <section className="section refs"><div className="wrap">
        <div className="sec-label reveal" id="evidence">Evidence</div>
        <p className="ev-intro reveal"><b>The science this builds on.</b> The research below establishes what Gutguard measures — that chronic, low-grade inflammation is real, measurable, and drives how fast we age — and the rationale behind the protocol’s design.</p>
        <ol className="ref-list reveal">
          <li id="ref1">Kotas ME, Medzhitov R. Homeostasis, inflammation, and disease susceptibility. <i>Cell</i>. 2015;160(5):816–827. doi:10.1016/j.cell.2015.02.010</li>
          <li id="ref2">Franceschi C, Bonafè M, Valensin S, et al. Inflamm-aging: an evolutionary perspective on immunosenescence. <i>Annals of the New York Academy of Sciences</i>. 2000;908:244–254. doi:10.1111/j.1749-6632.2000.tb06651.x</li>
          <li id="ref3">Singh A, D’Amico D, Andreux PA, et al. Urolithin A improves muscle strength, exercise performance, and biomarkers of mitochondrial health in a randomized trial in middle-aged adults. <i>Cell Reports Medicine</i>. 2022;3(5):100633. doi:10.1016/j.xcrm.2022.100633</li>
          <li id="ref4">Liu S, D’Amico D, Shankland E, et al. Effect of urolithin A supplementation on muscle endurance and mitochondrial health in older adults: a randomized clinical trial. <i>JAMA Network Open</i>. 2022;5(1):e2144279. doi:10.1001/jamanetworkopen.2021.44279</li>
          <li id="ref5">Ridker PM, Everett BM, Thuren T, et al.; CANTOS Trial Group. Antiinflammatory therapy with canakinumab for atherosclerotic disease. <i>New England Journal of Medicine</i>. 2017;377(12):1119–1131. doi:10.1056/NEJMoa1707914</li>
          <li id="ref6">Pradhan AD, Manson JE, Rifai N, Buring JE, Ridker PM. C-reactive protein, interleukin 6, and risk of developing type 2 diabetes mellitus. <i>JAMA</i>. 2001;286(3):327–334. doi:10.1001/jama.286.3.327</li>
          <li id="ref7">Walker KA, Gottesman RF, Wu A, et al. Systemic inflammation during midlife and cognitive change over 20 years: the ARIC Study. <i>Neurology</i>. 2019;92(11):e1256–e1267. doi:10.1212/WNL.0000000000007094</li>
          <li id="ref8">Hempel S, Newberry SJ, Maher AR, et al. Probiotics for the prevention and treatment of antibiotic-associated diarrhea: a systematic review and meta-analysis. <i>JAMA</i>. 2012;307(18):1959–1969. doi:10.1001/jama.2012.3507</li>
          <li id="ref9">Li Y, Berliocchi L, Li Z, Rasmussen LJ. Interactions between mitochondrial dysfunction and other hallmarks of aging: paving a path toward interventions that promote healthy old age. <i>Aging Cell</i>. 2024;23(1):e13942. doi:10.1111/acel.13942</li>
          <li id="ref10">Levine ME, Lu AT, Quach A, et al. An epigenetic biomarker of aging for lifespan and healthspan. <i>Aging (Albany NY)</i>. 2018;10(4):573–591. doi:10.18632/aging.101414</li>
          <li id="ref11">López-Otín C, Blasco MA, Partridge L, Serrano M, Kroemer G. The hallmarks of aging. <i>Cell</i>. 2013;153(6):1194–1217. doi:10.1016/j.cell.2013.05.039</li>
          <li id="ref12">Kresovich JK, Garval EL, Martinez Lopez AM, et al. Associations of body composition and physical activity level with multiple measures of epigenetic age acceleration. <i>American Journal of Epidemiology</i>. 2021;190(6):984–993. doi:10.1093/aje/kwaa251</li>
          <li id="ref13">Tucker LA. Insulin resistance and biological aging: the role of body mass, waist circumference, and inflammation. <i>BioMed Research International</i>. 2022;2022:2146596. doi:10.1155/2022/2146596</li>
          <li id="ref14">Liu Z, Kuo P-L, Horvath S, Crimmins E, Ferrucci L, Levine M. A new aging measure captures morbidity and mortality risk across diverse subpopulations from NHANES IV: a cohort study. <i>PLoS Medicine</i>. 2018;15(12):e1002718. doi:10.1371/journal.pmed.1002718</li>
        </ol>

        <div className="sec-label reveal" style={{ marginTop: 46 }}>Our own evidence</div>
        <p className="ev-intro reveal">The studies above establish the problem. The evidence below is how we show what Gutguard does about it — our population, our protocol, speaking to the product directly. It’s being built now.</p>
        <ul className="own-ev reveal">
          <li>
            <span className="ev-status">Study in progress</span>
            <h4>Autism spectrum clinical study</h4>
            <p>A joint research study and partnership with Beehive Brain Developmental Center, in collaboration with MSU-IIT as the research institution — a 12-week protocol evaluating change in inflammatory and gut-axis markers. <span className="ev-ph">[Add the public trial-registration ID and published results here once available.]</span></p>
          </li>
          <li>
            <span className="ev-status">Pilot underway</span>
            <h4>Lead Clinical Adopter outcomes</h4>
            <p>Before-and-after inflammation readings from patients on the protocol under physician supervision. <span className="ev-ph">[Add aggregate pilot outcomes and physician count here once collected.]</span></p>
          </li>
        </ul>
        <p className="ref-note reveal">Entries above describe evidence Gutguard is generating; bracketed items are placeholders to be completed with real data before publication. Nothing here is a therapeutic claim.</p>
      </div></section>

      <FinalCTA />
      <Compliance />
    </>
  );
}

function Science() {
  return (
    <>
      <header className="hero">
        <div className="wrap"><div className="narrow reveal" style={{ maxWidth: 760 }}>
          <span className="eyebrow">The Science</span>
          <h1>The science, <em>in plain sight.</em></h1>
          <p className="hero-lede">No black box. Here is exactly how inflammation compounds into the way you feel — and how the right repair runs it in reverse.</p>
          <div className="hero-actions"><StartCTA /></div>
        </div></div>
      </header>

      <hr className="seam" />

      <section className="section"><div className="wrap">
        <div className="reveal" style={{ marginBottom: 8 }}>
          <div className="sec-label" id="mechanism"><span className="num">01</span> The mechanism</div>
          <h2 className="sec">How a leaky gut quietly becomes a <em>tired body.</em></h2>
          <p className="sec-body" style={{ marginTop: 14 }}>When the gut barrier weakens, bacterial fragments leak into the bloodstream. The immune system reacts, inflammation spreads body-wide, and it wears down the mitochondria that power your cells — which fuels still more inflammation.<sup><a href="#mref1">1</a>,<a href="#mref2">2</a>,<a href="#mref3">3</a></sup> This is what your MiAge measures; the Disease Factory below walks it stage by stage.</p>
        </div>
        <div className="teaser reveal">
          <a className="teaser-art" href={DISEASE_FACTORY_URL} target="_blank" rel="noopener" aria-label="Open the Disease Factory interactive explainer (opens in a new tab)"><span className="teaser-play" aria-hidden="true"><Play size={30} fill="currentColor" /></span></a>
          <div className="teaser-body">
            <h3>The Disease Factory</h3>
            <p>Walk the nine stages: how gut leakage compounds into inflammation and mitochondrial aging — the very process your MiAge measures — and how the protocol runs it in reverse. An interactive explainer on its own page.</p>
            <a className="btn-ghost" href={DISEASE_FACTORY_URL} target="_blank" rel="noopener"><span className="ring"><ArrowRight size={13} /></span>Enter the Disease Factory</a>
          </div>
        </div>
        <ol className="ref-list reveal" style={{ marginTop: 26 }}>
          <li id="mref1">Camilleri M. Leaky gut: mechanisms, measurement and clinical implications in humans. <i>Gut</i>. 2019;68(8):1516–1526. doi:10.1136/gutjnl-2019-318427</li>
          <li id="mref2">Fasano A. All disease begins in the (leaky) gut: role of zonulin-mediated gut permeability in the pathogenesis of some chronic inflammatory diseases. <i>F1000Research</i>. 2020;9:69. doi:10.12688/f1000research.20510.1</li>
          <li id="mref3">Li Y, Berliocchi L, Li Z, Rasmussen LJ. Interactions between mitochondrial dysfunction and other hallmarks of aging: paving a path toward interventions that promote healthy old age. <i>Aging Cell</i>. 2024;23(1):e13942. doi:10.1111/acel.13942</li>
        </ol>
      </div></section>

      <section className="section"><div className="wrap">
        <div className="reveal">
          <div className="sec-label" id="triggers"><span className="num">02</span> The triggers</div>
          <h2 className="sec">Modern life keeps the fire <em>lit.</em></h2>
          <p className="sec-sub">Everyday pressures — especially here — that quietly feed chronic inflammation.</p>
          <p className="sec-body">Your biology hasn’t changed in millennia; your environment has. These are the forces measurably pushing inflammation up, day after day.</p>
        </div>
        <div className="triggers reveal">
          {TRIGGERS.map(([n, h, stat, ctx, imp], i) => (
            <div className="trigger" key={n}>
              <div className="tnum">{n}</div>
              <h3>{h}</h3>
              <div className="tstat">{stat}<sup><a href={"#tref" + (i + 1)}>{i + 1}</a></sup></div>
              <div className="ctx">{ctx}</div>
              <div className="impact">{imp}</div>
            </div>
          ))}
        </div>
        <ol className="ref-list reveal" style={{ marginTop: 32 }}>
          <li id="tref1">Lane MM, Gamage E, Du S, et al. Ultra-processed food exposure and adverse health outcomes: umbrella review of epidemiological meta-analyses. <i>BMJ</i>. 2024;384:e077310. doi:10.1136/bmj-2023-077310</li>
          <li id="tref2">Rosengren A, Hawken S, Ôunpuu S, et al. Association of psychosocial risk factors with risk of acute myocardial infarction in 11 119 cases and 13 648 controls from 52 countries (the INTERHEART study): case-control study. <i>The Lancet</i>. 2004;364(9438):953–962. doi:10.1016/S0140-6736(04)17019-0</li>
          <li id="tref3">Cappuccio FP, Cooper D, D’Elia L, Strazzullo P, Miller MA. Sleep duration predicts cardiovascular outcomes: a systematic review and meta-analysis of prospective studies. <i>European Heart Journal</i>. 2011;32(12):1484–1492. doi:10.1093/eurheartj/ehr007</li>
          <li id="tref4">Ekelund U, Steene-Johannessen J, Brown WJ, et al. Does physical activity attenuate the association of sitting time with mortality? A harmonised meta-analysis of data from more than 1 million men and women. <i>The Lancet</i>. 2016;388(10051):1302–1310. doi:10.1016/S0140-6736(16)30370-1</li>
          <li id="tref5">World Health Organization. Billions of people still breathe unhealthy air: new WHO data. Geneva: WHO; 2022.</li>
          <li id="tref6">Palleja A, Mikkelsen KH, Forslund SK, et al. Recovery of gut microbiota of healthy adults following antibiotic exposure. <i>Nature Microbiology</i>. 2018;3(11):1255–1265. doi:10.1038/s41564-018-0257-9</li>
        </ol>
      </div></section>

      <section className="section" style={{ background: "var(--paper)", borderTop: "1px solid var(--rule)", borderBottom: "1px solid var(--rule)" }}><div className="wrap">
        <div className="reveal">
          <div className="sec-label" id="measure"><span className="num">03</span> How we measure</div>
          <h2 className="sec">Belief needs <em>proof.</em> Proof needs a method.</h2>
          <p className="sec-body">Understanding the biology is only half of it. The other half is measuring it — repeatably, from routine lab markers, the same way every time.</p>
          <div className="hero-actions" style={{ marginTop: 24 }}>
            <a className="btn-primary" href="#/system">See the measurement system <Arrow /></a>
          </div>
        </div>
      </div></section>

      <section className="section"><div className="wrap">
        <div className="reveal">
          <div className="sec-label" id="standard"><span className="num">04</span> The standard we hold</div>
          <h2 className="sec">Filipino-authored, <em>global-standard</em> science.</h2>
          <p className="sec-body">Built with MERAV and MSU-IIT, registered with the FDA, and supported by USAID — the measurement stack uses routine, accessible lab markers so the science stays grounded and repeatable.</p>
        </div>
      </div></section>

      <TrustStrip />
      <Compliance />
    </>
  );
}

/* Shop — the SynBIOTIC+ Shoplet (gutguard-shoplet, CSA's original design): one screen, buy bar, basket sheet.
   Changed only: Addendum 01 products and prices, the 5-Night Watch in "Try first", a "Subscribe" tab (Gutguard Daily),
   and checkout hands off to the Lifestyle landing (guests) or the Lifestyle page (members). The website takes no payment. */
const SL_RECOMMENDED = "peak";
const SL_TIERS = [
  { id: "start", name: "Start", phase: "15-day", days: 15, caps: 30, perCap: 133, price: 3999 },
  { id: "grow", name: "Grow", phase: "45-day", days: 45, caps: 90, perCap: 122, price: 10999, tag: "Popular" },
  { id: "peak", name: "Peak", phase: "90-day", days: 90, caps: 330, perCap: 89, price: 29369, tag: "Best rate" },
];
const SL_TRIALS = [
  { id: "watch", name: "5-Night Watch", caps: 10, price: 499, first: true }, /* first order only, guests */
  { id: "blister", name: "Blister", caps: 10, price: 1499 },
  { id: "bottle", name: "Bottle", caps: 30, price: 3799 },
];
const PROOF = [["FDA", "Registered"], ["MSU-IIT", "Co-developed"], ["USAID", "Funded science"], ["LactoSpore®", "Spore probiotic"]];
const SCIENCE = [
  ["Probiotics — survive & seat", "Stable LactoSpore® (Bacillus coagulans) plus nanoshell-coated Lactobacillus and Bifidobacterium strains, chosen for gut barrier, immunity and the gut-brain axis."],
  ["Prebiotics — feed & colonize", "Patented FOS + Inulin feed the beneficial colon bacteria so the strains take hold."],
  ["Postbiotics — signal & renew", "Metabolic signaling molecules — Urolithin-A and L-Tryptophan — carry the benefit through to the cell."],
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
  footnote: "** % RENI not established for these actives. % values based on PDRI 2015 (adult male, 19–29 yrs).",
};
const Bottle = ({ s = 60 }) => (
  <svg width={s} height={s * 170 / 140} viewBox="0 0 140 170" fill="none" aria-hidden="true">
    <ellipse cx="70" cy="161" rx="41" ry="7" fill="#141019" opacity="0.08" />
    <rect x="34" y="40" width="72" height="121" rx="19" fill="url(#b1)" stroke="#D8D2C2" />
    <rect x="47" y="20" width="46" height="26" rx="8" fill="#141019" /><rect x="52" y="13" width="36" height="11" rx="5" fill="#141019" />
    <rect x="34.5" y="75" width="71" height="60" rx="3" fill="#FCFAF5" /><rect x="34.5" y="75" width="71" height="6" fill="url(#b2)" />
    <rect x="47" y="92" width="46" height="7" rx="3.5" fill="#141019" opacity="0.9" /><rect x="47" y="106" width="32" height="4" rx="2" fill="#6B6B7A" /><rect x="47" y="114" width="40" height="4" rx="2" fill="#6B6B7A" /><rect x="47" y="124" width="17" height="7.5" rx="3.75" fill="url(#b2)" />
    <defs><linearGradient id="b1" x1="0" y1="40" x2="0" y2="161" gradientUnits="userSpaceOnUse"><stop stopColor="#FCFAF5" /><stop offset="1" stopColor="#EBE4D7" /></linearGradient><linearGradient id="b2" x1="34" y1="0" x2="106" y2="0" gradientUnits="userSpaceOnUse"><stop stopColor="#B5431F" /><stop offset="1" stopColor="#1E6FB8" /></linearGradient></defs>
  </svg>
);
const Ico = {
  basket: (s = 21) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 11h14l-1 9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z" /><path d="M9 11 12 4l3 7" /><line x1="3" y1="11" x2="21" y2="11" /></svg>),
  check: (s = 16) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>),
  lock: (s = 13) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>),
  shield: (s = 13) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>),
  pulse: (s = 13) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>),
  x: (s = 22) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>),
  arrow: (s = 18) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>),
  back: (s = 20) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>),
  info: (s = 13) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>),
};


function Physicians() {
  const offers = [
    ["Upstream framing", "Read inflammation with GLIS, before it becomes a labelled condition."],
    ["Filipino-authored, global-standard science", "Co-developed with MSU-IIT and MERAV, registered with the FDA."],
    ["Clinical dosing guidance", "A structured protocol and doctor-facing tools, not a sales script."],
    ["A founding circle", "Among the first 100 licensed Filipino physicians practising at the upstream."],
  ];
  return (
    <>
      <header className="lca-hero dark">
        <div className="wrap"><div className="narrow reveal" style={{ maxWidth: 760 }}>
          <span className="eyebrow">For Physicians · Lead Clinical Adopters</span>
          <h1>Practice medicine at the <em>upstream.</em></h1>
          <p className="hero-lede">An invitation to the first 100 founding Filipino physicians treating mitochondrial dysfunction and inflammaging — with measurement, not guesswork.</p>
          <div className="hero-actions"><a className="btn-primary" href="#/physicians">Request the program brief <Arrow /></a></div>
        </div></div>
      </header>

      <hr className="seam" />

      <section className="section"><div className="wrap">
        <div className="reveal">
          <div className="sec-label" id="practice"><span className="num">01</span> What you’d practice</div>
          <h2 className="sec">Inflammation you can <em>read</em> — and act on early.</h2>
          <p className="sec-body">The GLIS composite turns routine lab markers into one upstream signal — so you can act before downstream conditions take hold.</p>
        </div>
        <div className="offer-grid reveal">
          {offers.map(([h, p]) => (
            <div className="offer" key={h}><span className="ck" aria-hidden="true"><Check size={15} /></span><div><h3>{h}</h3><p>{p}</p></div></div>
          ))}
        </div>
      </div></section>

      <section className="section" style={{ background: "var(--slate)", position: "relative", overflow: "hidden" }}><Constellation /><div className="wrap">
        <div className="reveal">
          <div className="sec-label" id="rationale" style={{ color: "var(--slate-mut)" }}><span className="num">02</span> The recovery rationale</div>
          <h2 className="sec" style={{ color: "#F4F1EA" }}>A layered <em>recovery</em> system — not just a probiotic.</h2>
          <p className="sec-body" style={{ color: "#B8C6D6" }}>SynBIOTIC+ pairs a spore-forming probiotic with prebiotic, postbiotic and antioxidant layers — a layered design, uncommon among probiotics, positioned as post-antibiotic gut and cellular recovery. Described as support, not the treatment or prevention of any disease.</p>
        </div>
        <div className="layers comp-layers reveal">
          <div className="layer"><span className="lyr-tag">Prebiotic</span><div><h3>FOS (fructo-oligosaccharides)</h3><p>Feeds beneficial microbes and supports recolonisation of the gut after antibiotic exposure.</p></div></div>
          <div className="layer"><span className="lyr-tag">Probiotic</span><div><h3>Spore-forming <i>Bacillus coagulans</i> (LactoSpore®)</h3><p>Its spore coat survives gastric acid to reach the gut, helping restore microbiome balance and resilience during and after antibiotics. Similar Bacillus and multi-strain formulations have shown benefit in antibiotic-associated diarrhoea<sup><a href="#pref1">1</a></sup>, with modulation of gut microbiota and inflammatory cytokines<sup><a href="#pref2">2</a></sup>; broader meta-analyses report a reduced risk of <i>C. difficile</i>-associated diarrhoea in patients receiving antibiotics<sup><a href="#pref3">3</a></sup>.</p></div></div>
          <div className="layer"><span className="lyr-tag">Postbiotic</span><div><h3>Urolithin-A + L-Tryptophan</h3><p>Urolithin-A supports mitochondrial renewal (mitophagy); L-tryptophan is a precursor in gut–immune and gut–brain signalling — extending recovery from the microbiome to cellular energy.</p></div></div>
          <div className="layer"><span className="lyr-tag">Antioxidant</span><div><h3>Glutathione + Lutein</h3><p>Help buffer the oxidative stress that accompanies inflammation and tissue repair.</p></div></div>
        </div>
        <ol className="ref-list dark reveal">
          <li id="pref1">Hempel S, Newberry SJ, Maher AR, et al. Probiotics for the prevention and treatment of antibiotic-associated diarrhea: a systematic review and meta-analysis. <i>JAMA</i>. 2012;307(18):1959–1969. doi:10.1001/jama.2012.3507</li>
          <li id="pref2">Madempudi RS, Ahire JJ, Neelamraju J, Tripathi A, Nanal S. Randomized clinical trial: the effect of probiotic Bacillus coagulans Unique IS2 vs. placebo on the symptoms management of irritable bowel syndrome in adults. <i>Scientific Reports</i>. 2019;9:12210. doi:10.1038/s41598-019-48554-x</li>
          <li id="pref3">Goldenberg JZ, Yap C, Lytvyn L, et al. Probiotics for the prevention of Clostridioides difficile-associated diarrhea in adults and children. <i>Cochrane Database of Systematic Reviews</i>. 2017;12:CD006095. doi:10.1002/14651858.CD006095.pub4</li>
        </ol>
      </div></section>

      <TrustStrip />

      <FinalCTA label="The founding 100" title={<>Read the inflammation. <em>Practise the upstream.</em></>} body="Request the LCA program brief and clinical dosing guidance for licensed Filipino physicians." cta="Request the program brief" />
      <Compliance />
    </>
  );
}

function FinalCTA({ label = "Measured, not guessed.", title = <>Your first number is the start of <em>the story.</em></>, body = "Start with five nights and a free Lifestyle card. Your BioScan checkpoints come at Day 30, 60 and 90 (Beta).", cta = "Start my 5 nights", href, external }) {
  const { who } = useVisitor();
  const m = isMember(who);
  const to = href || (m ? memberUrl("member", who) : "#/shop?start=watch");
  const out = external || !href;
  const label2 = !href && m ? "Open my Lifestyle page" : cta;
  return (
    <section className="final"><div className="wrap final-in reveal">
      <div className="lab">{label}</div>
      <h2>{title}</h2>
      <p>{body}</p>
      <a className="btn-bone" href={to} {...(out ? { target: "_blank", rel: "noopener" } : {})}>{label2} <span className="arr"><ArrowRight size={14} /></span></a>
    </div></section>
  );
}

function System() {
  const layers = [
    ["01", "BioScan", "Sample", "You provide your own blood test results — upload the file or photograph it. The system scans a defined set of biomarkers from any standard lab test, then rates data confidence.", "who", "Input"],
    ["02", "GLIS", "Score", "Gutguard Lifestyle Inflammation Score — a 0–100 reading of low-grade chronic systemic inflammation (inflammaging) across inflammatory, metabolic, adiposity and organ-function markers, with a data-confidence rating. Scattered markers become one signal.", "who md", "Physician-facing"],
    ["03", "MiAge", "Translate", "MiAge says the science in years — one number you feel, with the gap you can close. Re-tested over time, so every scan shows direction, not just a snapshot.", "who pt", "Patient-facing"],
  ];
  return (
    <>
      <header className="hero">
        <div className="wrap"><div className="narrow reveal" style={{ maxWidth: 760 }}>
          <span className="eyebrow">The System</span>
          <h1>Three layers between a <em>sample</em> and an answer.</h1>
          <p className="hero-lede">No single number tells the whole story. Gutguard reads inflammation through a measured stack — a sample, a composite score, and a translation you can actually feel.</p>
          <div className="hero-actions">
            <StartCTA />
            <a className="btn-ghost" href="#/physicians"><span className="ring"><ArrowRight size={13} /></span>For physicians</a>
          </div>
        </div></div>
      </header>

      <hr className="seam" />

      <section className="section"><div className="wrap">
        <div className="reveal">
          <div className="sec-label" id="stack"><span className="num">01</span> The stack</div>
          <h2 className="sec">From your lab results to <em>meaning.</em></h2>
          <p className="sec-sub">Built on routine, accessible lab markers — repeatable anywhere.</p>
        </div>
        <div className="layers reveal">
          {layers.map(([n, name, sub, p, whoCls, who]) => (
            <div className="layer" key={name}>
              <div className="lnum" aria-hidden="true">{n}</div>
              <div><h3>{name}<span className="sub">{sub}</span></h3><p>{p}</p></div>
              <div className={whoCls}>{who}</div>
            </div>
          ))}
        </div>

        <div className="reveal" style={{ marginTop: 56 }}>
          <h3 className="sub-h">How the Blood Scan works</h3>
          <p className="sec-body" style={{ marginBottom: 26 }}>No kit, no partner lab. The Blood Scan (BioScan) reads the blood test results you already have — you just upload or photograph them.</p>
        </div>
        <div className="howscan reveal">
          {[["1", "Bring your lab results", "Use a recent blood test you already have, or get a standard one anywhere. No special kit or partner lab required."],
            ["2", "Upload or photograph it", "Load the file or simply take a picture. The Blood Scan reads it for you."],
            ["3", "The system scans your biomarkers", "It extracts a defined set of biomarkers across inflammation, metabolism, and organ function — and rates your data confidence by how complete they are."],
            ["4", "Get your score", "Your biomarkers generate two reads: your Lifestyle Inflammation Score (GLIS) — your inflammaging — and your MiAge, your biological age from the same markers, via the PhenoAge method. Re-test by scanning new results at Day 30, 60, and 90."]].map(([n, h, p]) => (
            <div className="howstep" key={n}><div className="hs-n" aria-hidden="true">{n}</div><h4>{h}</h4><p>{p}</p></div>
          ))}
        </div>
        <div className="reveal" style={{ marginTop: 56 }}>
          <h3 className="sub-h">Choose your panel — confidence scales with completeness</h3>
          <p className="sec-body" style={{ marginBottom: 26 }}>MiAge reads whatever markers you bring, and shows how confident that read is. A basic panel gives a screening estimate; a complete panel anchors it on the validated PhenoAge algorithm; advanced adds insulin resistance and body composition.</p>
        </div>
        <div className="tiers reveal">
          {[
            ["Essential", "Widest access", ["CBC", "Fasting glucose", "Lipid profile", "Creatinine", "Uric acid", "hs-CRP", "Waist / BMI"], "Screening-grade GLIS and a provisional MiAge estimate.", "Moderate confidence"],
            ["Complete", "The standard", ["Everything in Essential", "Albumin + ALP", "HbA1c"], "All PhenoAge markers present — MiAge anchored on the validated PhenoAge algorithm, extended with your metabolic markers.", "High confidence"],
            ["Advanced", "Fullest picture", ["Everything in Complete", "Fasting insulin → HOMA-IR", "Body composition / visceral fat", "Advanced inflammatory markers"], "The complete cardiometabolic read, tuned to your metabolic profile.", "Highest confidence"],
          ].map(([name, tagline, items, claim, conf]) => (
            <div className={"tier" + (name === "Complete" ? " tier-mid" : "")} key={name}>
              <div className="tier-h"><span className="tier-name">{name}</span><span className="tier-tag">{tagline}</span></div>
              <ul className="tier-list">{items.map((it) => <li key={it}>{it}</li>)}</ul>
              <p className="tier-claim">{claim}</p>
              <span className="tier-conf">{conf}</span>
            </div>
          ))}
        </div>
        <p className="tier-note">Confidence is shown with every result — never more than your data earns. Read MiAge as a way to track your own progress over time, not a medical diagnosis — and our model is still being validated.</p>
      </div></section>

      <section className="section measure"><div className="wrap">
        <div className="reveal">
          <div className="sec-label" id="proof"><span className="num">02</span> Proof of method</div>
          <h2 className="sec">A number means little. <em>A trajectory</em> means everything.</h2>
          <p className="sec-sub">Re-tested at Day 30, 60, and 90 — the method proves itself on your own line.</p>
        </div>
        <Trajectory note={<>Because the same markers are read the same way each time, change is measurable — not anecdotal. <b>The method is only as good as its repeatability</b>, and that is the whole point of re-testing.</>} />
      </div></section>

      <section className="section"><div className="wrap">
        <div className="reveal">
          <div className="sec-label" id="readings"><span className="num">03</span> Read two ways</div>
          <h2 className="sec">One measurement. <em>Two</em> honest readings.</h2>
          <p className="sec-sub">The same science, told to the person and to the physician.</p>
        </div>
        <div className="dual reveal">
          <div className="col pt"><div className="tag">What you see</div><h3>MiAge</h3><div className="full">Mitochondrial Age</div><div className="big">53<span style={{ fontSize: 22 }}>y</span></div><p>Your biological age from the same labs — anchored on the validated PhenoAge algorithm and extended with your cardiometabolic markers. Named for the mitochondrial aging that inflammaging drives. Yours to track at every re-test.</p></div>
          <div className="col md"><div className="tag">What your doctor sees</div><h3>GLIS</h3><div className="full">Gutguard Lifestyle Inflammation Score</div><div className="big">62</div><p>The 0–100 measure of low-grade chronic systemic inflammation — inflammaging — across inflammatory, metabolic, adiposity and organ-function markers, with a data-confidence rating. The measured foundation of your MiAge.</p></div>
        </div>
        <div className="vault reveal"><Lock size={20} /><span>Some upstream methodology is held as protected intellectual property and isn’t shown publicly — what you see here are the disclosable layers of the system.</span></div>
      </div></section>

      <TrustStrip />
      <Compliance />
    </>
  );
}

/* the Shop downloads only when someone opens it */
const Shop = lazy(() => import("./GutguardShop.jsx"));
const ROUTES = { "/": Home, "/science": Science, "/system": System, "/shop": Shop, "/physicians": Physicians, "/about": About, "/legal": Legal };

function SectionTabs({ items }) {
  const [active, setActive] = useState(items[0][1]);
  const [top, setTop] = useState(60);
  const innerRef = useRef(null);
  const vis = useRef(new Set());

  /* sit flush under the nav, whatever its measured height */
  useEffect(() => {
    const measure = () => { const n = document.querySelector(".nav"); if (n) setTop(n.offsetHeight); };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  /* scrollspy */
  useEffect(() => {
    const ids = items.map((i) => i[1]);
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => { e.isIntersecting ? vis.current.add(e.target.id) : vis.current.delete(e.target.id); });
        const first = ids.find((id) => vis.current.has(id));
        if (first) setActive(first);
      },
      { rootMargin: "-118px 0px -60% 0px", threshold: 0 }
    );
    ids.forEach((id) => { const el = document.getElementById(id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, [items]);

  /* keep the active tab centered in the mobile strip (no window scroll) */
  useEffect(() => {
    const c = innerRef.current; if (!c) return;
    const el = c.querySelector(".sectab.on");
    if (el) c.scrollLeft = el.offsetLeft - c.clientWidth / 2 + el.clientWidth / 2;
  }, [active]);

  const go = (id) => {
    const el = document.getElementById(id); if (!el) return;
    const n = document.querySelector(".nav");
    const t = document.querySelector(".sectabs");
    const offset = (n ? n.offsetHeight : 60) + (t ? t.offsetHeight : 48) + 6;
    const y = el.getBoundingClientRect().top + window.scrollY - offset;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: y, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <nav className="sectabs show" style={{ top }} aria-label="On this page">
      <div className="sectabs-inner" ref={innerRef}>
        {items.map(([label, id]) => (
          <button key={id} className={"sectab" + (active === id ? " on" : "")} aria-current={active === id ? "true" : undefined} onClick={() => go(id)}>{label}</button>
        ))}
      </div>
    </nav>
  );
}

/* ───────────────────────── SEPT 2026 BLOCKS ───────────────────────── */

/* 5-Night Watch banner (Addendum 01 §8.1, 03 §8.1). Members see where to continue instead. */
function TrialBand({ id }) {
  const { who } = useVisitor();
  const member = isMember(who);
  return (
    <div className="trialband reveal" id={id}>
      <div>
        <span className="tb-eyebrow">{member ? (who === "sub" || who === "peak" ? "Welcome back, Gut Guardian" : "Welcome back") : "The Gut Guardian movement"}</span>
        <h2 className="tb-h">{member ? <>Continue in your <em>Lifestyle page.</em></> : <>Join the movement and <em>become a Gut Guardian.</em></>}</h2>
        {member ? <p className="tb-line">Your card, E-Points, doses and plan are all in one place. Buy, refill or change your plan there.</p> : (<>
          <p className="tb-line">Chronic inflammation ages the body silently, for years before any symptom. Gut Guardians refuse to wait. We guard ourselves, our families and our communities, one watch at a time.</p>
          <div className="tb-creed"><span>Guard yourself</span><span>Guard your family</span><span>Guard your community</span></div>
          <p className="tb-sign">We Gut You.</p>
          <p className="tb-line tb-small">Your first watch is 5 nights. Start with the 5-Night Watch and a free Lifestyle card. The ₱499 comes off your first monthly plan.</p>
        </>)}
      </div>
      <div className="tb-side">
        {!member && <div className="tb-price">{peso(TRIAL_OFFER.price)}<small>Free shipping · new buyers</small></div>}
        <a className="tb-btn" {...linkTo(member ? (who === "trial" ? "#/shop?tab=subscribe" : memberUrl("member", who)) : "#/shop?start=watch")}>
          {member ? (who === "trial" ? "Continue your plan" : "Open my Lifestyle page") : "Start my 5 nights"} <ArrowRight size={15} />
        </a>
      </div>
    </div>
  );
}

/* Phases (Addendum 01 §8.3) */
function PhasesBlock() {
  return (
    <section className="section" style={{ paddingTop: 0 }}><div className="wrap">
      <div className="reveal">
        <h3 className="sub-h" id="phases">Repair → Calm → Regenerate</h3>
        <p className="sec-body" style={{ marginTop: 8 }}>One Peak pack completes the 90-Day Protocol with step-down.</p>
      </div>
      <div className="phase-cards reveal">
        {PHASES.map(([nm, wk, desc], i) => (
          <div className="phase-card" key={nm}>
            <span className="pc-n">Phase {i + 1}</span>
            <h3>{nm}</h3>
            <div className="pc-wk">{wk}</div>
            <p>{desc}</p>
          </div>
        ))}
      </div>
    </div></section>
  );
}

/* Find Your Dose + BioScan timeline (Addendum 01 §8.2, §8.4) */
function DoseBlock({ num = "05" }) {
  return (
    <section className="section" style={{ background: "var(--paper)", borderTop: "1px solid var(--rule)", borderBottom: "1px solid var(--rule)" }}><div className="wrap">
      <div className="reveal">
        <div className="sec-label" id="dose"><span className="num">{num}</span> Find your dose</div>
        <h2 className="sec">Your dose follows <em>your number.</em></h2>
        <p className="sec-body">Know your GLIS level. Take your dose. Check again at Day 30, 60 and 90. As your score goes down, your dose goes down.</p>
      </div>
      <div className="dose-cards reveal">
        {GOALS.map((g) => (
          <div className="dose-card" key={g.id}>
            <div className="dc-goal">{g.goal}</div>
            <div className="dc-day">{g.perDay} capsules a day</div>
            <div className="dc-row"><span>Reveille · morning, empty stomach</span><b>{g.rev}</b></div>
            {g.mid ? <div className="dc-row"><span>Midday · after lunch</span><b>{g.mid}</b></div> : null}
            <div className="dc-row"><span>Taps · before bedtime</span><b>{g.taps}</b></div>
            <div className="dc-meta">{g.level} · GLIS {g.glis}</div>
          </div>
        ))}
      </div>
      <p className="dose-note reveal">These are the recommended doses. You can adjust yours, and add a Midday dose, in Settings on your Lifestyle page. No GLIS result yet? Choose your goal. Not sure? Start with Keep healthy. Your BioScan at Day 30 sets your exact level.</p>
      <div className="reveal" style={{ marginTop: 40 }}>
        <h3 className="sub-h" id="bioscan-timeline">BioScan checkpoints <span className="bs-beta" style={{ verticalAlign: "middle", marginLeft: 8 }}>Beta</span></h3>
      </div>
      <div className="timeline reveal">
        {[["Day 30", "Your level is checked. Your dose is adjusted."], ["Day 60", "Your level is checked. Your dose is adjusted."], ["Day 90", "Your 90-day result."]].map(([d, t]) => (
          <div className="tl-item" key={d}><div className="tl-day">{d}</div><div className="tl-txt">{t}</div></div>
        ))}
      </div>
    </div></section>
  );
}

function About() {
  const who = [
    ["Prof. Roberto Malaluan, PhD", "Professor at MSU-IIT for 40 years; PhD in Chemical Engineering; research scientist for 25 years."],
    ["Engr. Rolly Racsa, PhD", "Bio-molecular scientist, MERAV."],
  ];
  return (
    <>
      <header className="hero">
        <div className="wrap"><div className="narrow reveal" style={{ maxWidth: 820 }}>
          <span className="eyebrow">About Gutguard</span>
          <h1>About <em>Gutguard.</em></h1>
          <p className="hero-lede"><strong>Gutguard Corporation is a science-backed Filipino biotech company building a platform for biological recovery.</strong> We help people measure how their body is recovering, then give them a system to improve it — and prove it with numbers.</p>
        </div></div>
      </header>
      <hr className="seam" />
      <section className="section"><div className="wrap">
        <div className="reveal">
          <div className="sec-label" id="mission"><span className="num">01</span> Our mission</div>
          <p className="mission">To make longevity affordable, measurable and within reach of every Filipino family.</p>
        </div>
        <div className="reveal" style={{ marginTop: 56 }}>
          <div className="sec-label" id="what"><span className="num">02</span> What we do</div>
        </div>
        <div className="about-grid reveal">
          {[["The product", "SynBIOTIC+ — pre-, pro- and postbiotics in one capsule. 80 billion CFU, 17 strains, with Urolithin-A and L-Tryptophan."],
            ["The program", "The 90-Day Protocol: Repair → Calm → Regenerate, with the Gutguard Daily ritual from Taps to Reveille."],
            ["The proof", "BioScan tracking at Day 30, 60 and 90, scored by GLIS. MiAge biological age (Beta)."],
            ["The method", "Our Multi-Domain Integrated Biological Recovery Management System, under utility model application."]].map(([h, p]) => (
            <div className="about-card" key={h}><h3>{h}</h3><p>{p}</p></div>
          ))}
        </div>
        <div className="reveal" style={{ marginTop: 56 }}>
          <div className="sec-label" id="credentials"><span className="num">03</span> Credentials</div>
          <ul className="about-list">
            {["FDA-registered: CPR No. FR-40000015571456, LTO No. LTO-30000007262499", "USAID-funded research program", "Manufactured with MERAV, an ISO-certified bio-molecular manufacturer", "Research partnership with MSU-IIT under MOU, and three other academic institutions", "20 branches nationwide, with online, branch and direct-selling channels"].map((t) => <li key={t}><Check size={16} />{t}</li>)}
          </ul>
        </div>
        <div className="reveal" style={{ marginTop: 56 }}>
          <div className="sec-label" id="people"><span className="num">04</span> People</div>
          <div className="person"><b>Col. Shane Animas (Ret.) — Founder, Chairman and CEO</b><span>A soldier by profession, with 26 years in the Philippine Army. US-trained and specialized in investigation and information science. Holds a Master&apos;s in Entrepreneurship from Ateneo de Manila University. He built Gutguard on one principle: if it cannot be measured, it cannot be trusted.</span></div>
          <h3 className="sub-h" style={{ marginTop: 34, fontSize: 22 }}>Scientific Advisory Board</h3>
          {who.map(([n, d]) => <div className="person" key={n}><b>{n}</b><span>{d}</span></div>)}
          <h3 className="sub-h" style={{ marginTop: 34, fontSize: 22 }}>Medical Advisory Board</h3>
          <div className="person"><b>Dr. Joey Sinchioco</b><span>Medical Director.</span></div>
          <h3 className="sub-h" style={{ marginTop: 34, fontSize: 22 }}>Clinical and research partners</h3>
          <div className="person"><b>Beehive Brain Developmental Center</b><span>Clinical Investigator for the Gutguard–Beehive Early Intervention Program for Children with Autism Spectrum Disorder (ASD). Led by Dr. Grace Saraza, PhD.</span></div>
          <div className="person"><b>Brain Capital Corp</b><span>Mental wellness and brain health partner. Led by Rob Rances, PhD.</span></div>
          <h3 className="sub-h" style={{ marginTop: 34, fontSize: 22 }}>Technology</h3>
          <div className="person"><b>Jesher Charles Dlonsod</b><span>Chief Technology Officer.</span></div>
        </div>
      </div></section>
      <FinalCTA label="Gutguard Corporation" title={<>Know your number. <em>Start your recovery.</em></>} body="New here? Begin with five nights and a free Lifestyle card." cta="Start my 5 nights" href={"#/shop?start=watch"} external />
    </>
  );
}

function Legal() {
  return (
    <>
      <header className="hero">
        <div className="wrap"><div className="narrow reveal" style={{ maxWidth: 760 }}>
          <span className="eyebrow">Legal</span>
          <h1>Terms and <em>privacy.</em></h1>
          <p className="hero-lede">Gutguard Corporation. The full texts are published here before launch.</p>
        </div></div>
      </header>
      <hr className="seam" />
      <section className="section"><div className="wrap">
        <ul className="legal-list reveal">
          {[["Terms of Sale", "Prices, delivery, the ₱499 5-Night Watch (new buyers, or no order in the last 12 months; one per mobile number) and returns."],
            ["Subscription Terms", "Gutguard Daily renews every month or every 3 months until you cancel. Change, skip, pause or cancel anytime in your Lifestyle page."],
            ["Refund Policy", "How to return an item and get your money back."],
            ["Privacy Notice", "How we collect, use and protect your data under the Data Privacy Act (RA 10173)."]].map(([h, d]) => (
            <li key={h}><b>{h}</b><span>{d} <em>Full text from legal counsel — to be added.</em></span></li>
          ))}
        </ul>
      </div></section>
    </>
  );
}

/* Sticky footer offer — four states (Addendum 02 §3, free shipping per 03 §8.1) */
function FooterOffer({ route }) {
  const { who } = useVisitor();
  const [shown, setShown] = useState(false);
  const enabled = route === "/"; /* /shop has its own buy bar */
  useEffect(() => {
    if (!enabled) { setShown(false); return; }
    let anchorPassed = false;
    const ends = new Set();
    const update = () => setShown(anchorPassed && ends.size === 0);
    const onScroll = () => { anchorPassed = window.scrollY > Math.min(560, window.innerHeight * 0.6); update(); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    const eObs = new IntersectionObserver(
      (entries) => { entries.forEach((e) => { e.isIntersecting ? ends.add(e.target) : ends.delete(e.target); }); update(); },
      { threshold: 0 }
    );
    document.querySelectorAll("footer, .final").forEach((el) => eObs.observe(el));
    return () => { window.removeEventListener("scroll", onScroll); eObs.disconnect(); };
  }, [route, enabled]);
  if (!enabled) return null;
  const S = {
    guest: { tag: "First purchase · free shipping", name: "5-Night Watch + free Lifestyle Membership", amt: peso(TRIAL_OFFER.price), sub: "5 nights · 10 capsules", cta: "Start my 5 nights", href: "#/shop?start=watch" },
    trial: { tag: "Lifestyle member", name: "Your ₱499 credit is ready", amt: "₱499 off", sub: "your first monthly order", cta: "Continue your plan", href: "#/shop?tab=subscribe" },
    sub:   { tag: "Gutguard Daily", name: "Next refill 17 Oct", amt: "15", sub: "E-Points", cta: "My Lifestyle", href: memberUrl("member", who) },
    peak:  { tag: "90-Day Protocol", name: "Day 12 of 90", amt: "33", sub: "E-Points", cta: "My Lifestyle", href: memberUrl("member", who) },
  }[who];
  return (
    <div className={"buybar" + (shown ? " show" : "")} role="region" aria-label={S.name} aria-hidden={!shown}>
      <div className="buybar-inner">
        <div className="bb-info">
          <span className="bb-tag">{S.tag}</span>
          <span className="bb-name">{S.name}</span>
        </div>
        <div className="bb-price">
          <span className="bb-amt">{S.amt}</span>
          <span className="bb-sub">{S.sub}</span>
        </div>
        {who === "guest" && <a className="bb-skip" href="#/shop?tab=subscribe" tabIndex={shown ? 0 : -1}>Skip the trial, start my plan</a>}
        <a className="btn-primary bb-cta" {...linkTo(S.href)} tabIndex={shown ? 0 : -1}>{S.cta} <Arrow /></a>
      </div>
    </div>
  );
}

/* Demo only — switch the visitor state to see each footer and button. Remove in production. */
function DemoChip() {
  const { who, setWho, failNext, setFailNext, usedBefore, setUsedBefore } = useVisitor();
  const [open, setOpen] = useState(false);
  return (
    <div className="demo-chip" aria-label="Demo controls">
      {open && <label style={{ display: "flex", alignItems: "center", gap: 6, marginRight: 8, cursor: "pointer" }}><input type="checkbox" checked={failNext} onChange={(e) => setFailNext(e.target.checked)} /> Next payment fails</label>}
      {open && <label style={{ display: "flex", alignItems: "center", gap: 6, marginRight: 8, cursor: "pointer" }}><input type="checkbox" checked={usedBefore} onChange={(e) => setUsedBefore(e.target.checked)} /> Mobile ordered in last 12 months</label>}
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} style={{ color: "inherit", fontFamily: "inherit", fontSize: "inherit", letterSpacing: "inherit" }}>DEMO{open ? " ▾" : " ▸"}</button>
      {open && <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Visitor state">
        {VISITORS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>}
    </div>
  );
}

export default function GutguardSite({ initialRoute = "/" }) {
  const [route, setRoute] = useState(initialRoute);
  const [who, setWho] = useState("guest"); /* production: guest until the shared Lifestyle log-in reaches this site (Addendum 05) */
  const [failNext, setFailNext] = useState(false);
  const [usedBefore, setUsedBefore] = useState(false); /* demo: this mobile number has ordered before */
  const [navKey, setNavKey] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const mainRef = useRef(null);
  const sheetRef = useRef(null);
  const burgerRef = useRef(null);
  const pendingScrollRef = useRef(null);

  /* hash routing */
  useEffect(() => {
    /* old #/page links still open the right page; real paths are the default */
    const fromUrl = () => (/^#(\/|shop)/.test(window.location.hash) ? normHash(window.location.hash) : initialRoute + window.location.search);
    setRoute(fromUrl());
    const onHash = () => { if (/^#(\/|shop)/.test(window.location.hash)) setRoute(normHash(window.location.hash)); };
    const onPop = () => setRoute(window.location.pathname + window.location.search);
    window.addEventListener("hashchange", onHash);
    window.addEventListener("popstate", onPop);
    return () => { window.removeEventListener("hashchange", onHash); window.removeEventListener("popstate", onPop); };
  }, [initialRoute]);

  /* nav shadow */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* route change → top (or pending section) + move focus to main (announces new page to AT) */
  useEffect(() => {
    setOpen(false);
    const pend = pendingScrollRef.current;
    pendingScrollRef.current = null;
    if (pend) {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const el = document.getElementById(pend);
        if (el) { const y = el.getBoundingClientRect().top + window.scrollY - 116; window.scrollTo(0, y < 0 ? 0 : y); }
        else window.scrollTo(0, 0);
      }));
    } else {
      window.scrollTo(0, 0);
    }
    const m = mainRef.current;
    if (m) m.focus({ preventScroll: true });
  }, [route]);

  /* body scroll lock while menu open */
  useEffect(() => { document.body.style.overflow = open ? "hidden" : ""; }, [open]);
  /* When a field is tapped, wait for the phone keyboard, then bring the field into view */
  useEffect(() => {
    const on = (e) => { const el = e.target; if (!el || !/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) || el.type === "checkbox" || el.type === "radio") return; setTimeout(() => bringIntoView(el), 320); };
    document.addEventListener("focusin", on); return () => document.removeEventListener("focusin", on);
  }, []);

  /* focus trap for the mobile dialog: focus in, Esc closes, Tab cycles, focus restored */
  useEffect(() => {
    if (!open) return;
    const prev = burgerRef.current;
    const cont = sheetRef.current;
    const q = () => Array.from(cont.querySelectorAll('a[href],button:not([disabled])')).filter((n) => n.offsetParent !== null);
    requestAnimationFrame(() => { const f = q()[0]; if (f) f.focus(); });
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); setOpen(false); return; }
      if (e.key !== "Tab") return;
      const nodes = q(); if (!nodes.length) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); if (prev) prev.focus(); };
  }, [open]);

  useReveal(route);

  /* reliable in-app navigation: intercept internal links instead of trusting hashchange */
  const handleNavClick = (e) => {
    const a = e.target.closest && e.target.closest('a[href^="#/"]');
    if (!a) return;
    e.preventDefault();
    const to = a.getAttribute("href").slice(1);
    setRoute(to); setNavKey((k) => k + 1);
    try { window.history.pushState(null, "", to); } catch (err) {}
  };

  const [path, qs] = route.split("?");
  const params = Object.fromEntries(new URLSearchParams(qs || ""));
  params._k = navKey + "|" + (qs || "");
  useEffect(() => { if (DEMO && params.who && VISITORS.some(([k]) => k === params.who)) setWho(params.who); }, [qs]);
  const Page = ROUTES[path] || Home;

  /* jump to a section — scroll if already on the page, else navigate then scroll */
  const goTo = (targetRoute, id) => {
    if (targetRoute === route) {
      const el = document.getElementById(id);
      if (el) { const y = el.getBoundingClientRect().top + window.scrollY - 116; window.scrollTo({ top: y < 0 ? 0 : y, behavior: "smooth" }); }
    } else {
      pendingScrollRef.current = id;
      setRoute(targetRoute);
      try { window.history.pushState(null, "", targetRoute); } catch (err) {}
    }
  };

  return (
    <VisitorCtx.Provider value={{ who, setWho, failNext, setFailNext, usedBefore, setUsedBefore }}>
    <div className="gg" onClick={handleNavClick}>
      <a className="skip" href="#main">Skip to content</a>
      <Nav route={path} scrolled={scrolled} open={open} setOpen={setOpen} sheetRef={sheetRef} burgerRef={burgerRef} />
      {SECTIONS[path] && <SectionTabs key={path} items={SECTIONS[path]} />}
      <main id="main" ref={mainRef} tabIndex={-1}>
        {Page === Shop ? <Suspense fallback={<div style={{ minHeight: "80vh" }} />}><Page params={params} /></Suspense> : <Page params={params} />}
      </main>
      <Footer route={path} goTo={goTo} />
      <FooterOffer route={path} />
      <script dangerouslySetInnerHTML={{ __html: "document.querySelectorAll('.reveal').forEach(function(e){if(e.getBoundingClientRect().top<innerHeight)e.classList.add('in')})" }} />
      {DEMO ? <DemoChip /> : null}
    </div>
    </VisitorCtx.Provider>
  );
}

/* used by GutguardShop.jsx */
export { About, Bottle, DEMO, EMAIL_RE, FACTS, GOALS, Ico, LIFESTYLE_HOME, LIFESTYLE_URL, MONTHLY, PROOF, QUARTERLY, SCIENCE, SL_RECOMMENDED, SL_TIERS, SL_TRIALS, bringIntoView, focusNext, isMember, joinUrl, linkTo, memberUrl, peso, useVisitor };
