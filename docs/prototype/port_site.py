"""Turns the website prototype (site_new/gutguard-site.jsx) into the production component
for the GutGuard-Doctors-HTML repo (components/GutguardSite.jsx).

Every change is an exact, asserted replacement, so a new prototype version either ports
cleanly or fails loudly at the line that moved. Prototype demo behaviour stays available
behind NEXT_PUBLIC_PROTOTYPE_DEMO=1; production (the default) uses the real order, Maya
and first-buyer endpoints.

Usage: python3 port/port_site.py <prototype.jsx> <out.jsx>
"""
import sys

src, out = sys.argv[1], sys.argv[2]
s = open(src, encoding="utf-8").read()


def rep(a, b, n=1):
    global s
    c = s.count(a)
    assert c == n, f"expected {n} match(es), found {c}: {a[:120]!r}"
    s = s.replace(a, b)


# ── 1. Module header: client component, repo paths, env ─────────────────────────────
rep('import { useState, useEffect, useRef, useContext, createContext } from "react";\n'
    'import CITIES from "./psgc_cities.json";',
    '"use client";\n'
    'import { useState, useEffect, useRef, useContext, createContext } from "react";\n'
    'import { ArrowRight, Play, Menu, X, Check, ShoppingBag, Lock, ChevronDown, ArrowLeft } from "lucide-react";\n'
    'import { getPublicShopOrder, reconcileMayaPayment, sendShopOrderEmail, startMayaCheckout } from "@/lib/api";\n'
    'import { readReferralSlug } from "@/lib/referral";\n'
    'import CITIES from "@/lib/psgc_cities.json";')
rep('import { ArrowRight, Play, Menu, X, Check, ShoppingBag, Lock, ChevronDown, ArrowLeft } from "lucide-react";\n\n', '\n')
rep('fetch("psgc_brgy.json")', 'fetch("/psgc_brgy.json")')
rep('const NAV = [',
    '/* Production port (Addendum 05). DEMO=1 brings back the prototype controls: visitor switcher, any-6-digit SMS code, fake payments. */\n'
    'const DEMO = process.env.NEXT_PUBLIC_PROTOTYPE_DEMO === "1";\n'
    'const LIFESTYLE_URL = (process.env.NEXT_PUBLIC_LIFESTYLE_URL || "https://lifestyle.gutguard.ph").replace(/\\/$/, "");\n'
    'const EMAIL_RE = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;\n'
    'const NAV = [')

# ── 2. Links to the Lifestyle app: real URLs, same tab ─────────────────────────────
rep('const LIFESTYLE_JOIN = "https://claude.ai/artifact/9tPTTKyCSRCkaeFwuMku3J"; /* production: /lifestyle/join */',
    'const LIFESTYLE_JOIN = LIFESTYLE_URL + "/"; /* Lifestyle landing: free card and log-in */')
rep('const LIFESTYLE_HOME = "https://claude.ai/artifact/GGYfp5cEpWgJDezFRfKrWK"; /* production: /lifestyle */',
    'const LIFESTYLE_HOME = LIFESTYLE_URL + "/app"; /* the member page */')
rep('const linkTo = (h) => (/^https?:/.test(h) ? { href: h, target: "_blank", rel: "noopener" } : { href: h });',
    'const linkTo = (h) => (/^https?:/.test(h) && !h.startsWith(LIFESTYLE_URL) ? { href: h, target: "_blank", rel: "noopener" } : { href: h });')
rep('const joinUrl = (from) => LIFESTYLE_JOIN + "#" + from;',
    'const joinUrl = (from) => LIFESTYLE_JOIN + "?from=" + from;')
rep('const memberUrl = (hash, who) => LIFESTYLE_HOME + "#" + (who === "trial" ? "trial" : who === "peak" ? "member" : "member") + "~" + hash;',
    'const memberUrl = (hash, who) => (DEMO ? LIFESTYLE_HOME + "#" + (who === "trial" ? "trial" : "member") + "~" + hash : LIFESTYLE_HOME + "?do=" + hash);')
rep('const SAME_SITE = false;', 'const SAME_SITE = true;')

# ── 3. Logo is shared with SiteNav ──────────────────────────────────────────────────
rep('function Logo({ h = 26, className, style }) {', 'export function Logo({ h = 26, className = "", style = undefined }) {')

# ── 4. Router: real paths (SSR-safe), hash links still work ───────────────────────────
rep('export default function GutguardSite() {\n'
    '  const [route, setRoute] = useState(() => normHash(window.location.hash));\n'
    '  const [who, setWho] = useState(() => { const m = (normHash(window.location.hash).match(/[?&]who=(\\w+)/) || [])[1]; return VISITORS.some(([k]) => k === m) ? m : "guest"; });',
    'export default function GutguardSite({ initialRoute = "/" }) {\n'
    '  const [route, setRoute] = useState(initialRoute);\n'
    '  const [who, setWho] = useState("guest"); /* production: guest until the shared Lifestyle log-in reaches this site (Addendum 05) */')
rep('''    const onHash = () => setRoute(normHash(window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);''',
    '''    /* old #/page links still open the right page; real paths are the default */
    const fromUrl = () => (/^#(\\/|shop)/.test(window.location.hash) ? normHash(window.location.hash) : initialRoute + window.location.search);
    setRoute(fromUrl());
    const onHash = () => { if (/^#(\\/|shop)/.test(window.location.hash)) setRoute(normHash(window.location.hash)); };
    const onPop = () => setRoute(window.location.pathname + window.location.search);
    window.addEventListener("hashchange", onHash);
    window.addEventListener("popstate", onPop);
    return () => { window.removeEventListener("hashchange", onHash); window.removeEventListener("popstate", onPop); };
  }, [initialRoute]);''')
rep('''    setRoute(to); setNavKey((k) => k + 1);
    try { window.history.replaceState(null, "", "#" + to); } catch (err) {}''',
    '''    setRoute(to); setNavKey((k) => k + 1);
    try { window.history.pushState(null, "", to); } catch (err) {}''')
rep('''      setRoute(targetRoute);
      try { window.history.replaceState(null, "", "#" + targetRoute); } catch (err) {}''',
    '''      setRoute(targetRoute);
      try { window.history.pushState(null, "", targetRoute); } catch (err) {}''')
rep('useEffect(() => { if (params.who && VISITORS.some(([k]) => k === params.who)) setWho(params.who); }, [qs]);',
    'useEffect(() => { if (DEMO && params.who && VISITORS.some(([k]) => k === params.who)) setWho(params.who); }, [qs]);')
rep('      <DemoChip />\n', '      {DEMO ? <DemoChip /> : null}\n')

# ── 5. Checkout form: fields Maya needs (email, first and last name, ZIP) ─────────────
rep('const blank = { mobile: "", name: "", province: "", city: "", brgy: "", street: "" };',
    'const blank = { mobile: "", name: "", first: "", last: "", email: "", province: "", city: "", brgy: "", street: "", zip: "" };')
rep('const addrOk = !!(form.street.trim() && form.brgy && form.city && form.province);',
    'const addrOk = !!(form.street.trim() && form.brgy && form.city && form.province && (DEMO || /^\\d{4}$/.test(form.zip || "")));\n'
    '  const nameOk = DEMO ? form.name.trim().length > 1 : !!((form.first || "").trim() && (form.last || "").trim() && EMAIL_RE.test((form.email || "").trim()));')
rep('const contactOk = verified && form.name.trim().length > 1 && rcpOk && !planForMe;',
    'const contactOk = verified && nameOk && rcpOk && !planForMe;')
rep('!verified ? "co-mobile" : form.name.trim().length < 2 ? "co-name"', '!verified ? "co-mobile" : !nameOk ? "co-name"')
rep('!verified ? (codeSent ? "co-code" : "co-m") : form.name.trim().length < 2 ? "co-n"',
    '!verified ? (codeSent ? "co-code" : "co-m") : !nameOk ? (DEMO ? "co-n" : !(form.first || "").trim() ? "co-fn" : !(form.last || "").trim() ? "co-ln" : "co-em")')
rep(': !addrOk ? (!form.city ? "co-cityq" : !form.brgy ? "co-brgy" : "co-st") : null;',
    ': !addrOk ? (!form.city ? "co-cityq" : !form.brgy ? "co-brgy" : !form.street.trim() ? "co-st" : "co-zip") : null;')
rep('!verified ? "Confirm your mobile number first." : form.name.trim().length < 2 ? "Add your full name."',
    '!verified ? (DEMO ? "Confirm your mobile number first." : "Add your 11-digit mobile number.") : !nameOk ? (DEMO ? "Add your full name." : "Add your first and last name, and your email.")')
rep('const afterVerify = () => focusNext(!form.name.trim() ? "co-n" : forOther ? "co-rn" : "co-cityq");',
    'const afterVerify = () => focusNext(!nameOk ? (DEMO ? "co-n" : "co-fn") : forOther ? "co-rn" : "co-cityq");')

# mobile: production has no SMS code yet (Addendum 05 back-end task); a complete number counts
rep('onChange={(e) => { const v = fmtMobile(e.target.value); setForm({ ...form, mobile: v }); setVerified(false); setCode(""); setCodeSent(v.replace(/\\D/g, "").length === 11); if (v.replace(/\\D/g, "").length === 11) focusNext("co-code"); }} />',
    'onChange={(e) => { const v = fmtMobile(e.target.value); const full = v.replace(/\\D/g, "").length === 11; setForm({ ...form, mobile: v }); setCode(""); if (DEMO) { setVerified(false); setCodeSent(full); if (full) focusNext("co-code"); } else { setVerified(full); setCodeSent(false); if (full) focusNext("co-fn"); } }} />')
rep('disabled={verified} onChange={(e) => { const v = fmtMobile', 'disabled={DEMO && verified} onChange={(e) => { const v = fmtMobile')
rep('{verified ? <span className="co-ok2">{Ico.check(14)} Verified</span> : null}',
    '{DEMO && verified ? <span className="co-ok2">{Ico.check(14)} Verified</span> : null}')
rep('''<span className="fe" style={{ color: tried ? "var(--heat-text)" : "var(--ink-3)" }}>We text you a code as soon as the number is complete. Your free Lifestyle card uses this number.</span>''',
    '''<span className="fe" style={{ color: tried ? "var(--heat-text)" : "var(--ink-3)" }}>{DEMO ? "We text you a code as soon as the number is complete. " : ""}Your free Lifestyle card uses this number.</span>''')
rep('''          <div className={"co-f" + (tried && form.name.trim().length < 2 ? " err" : "")} id="co-name">
            <label htmlFor="co-n">Full name</label>
            <input id="co-n" autoComplete="name" placeholder="Juan dela Cruz" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>''',
    '''          {DEMO ? (
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
          </div>)}''')
rep('''          {form.city ? <div className="co-f"><label htmlFor="co-st">House no. and street</label><input id="co-st" autoComplete="address-line1" placeholder="e.g. 12 Rizal St." value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} /></div> : null}''',
    '''          {form.city ? <div className="co-f"><label htmlFor="co-st">House no. and street</label><input id="co-st" autoComplete="address-line1" placeholder="e.g. 12 Rizal St." value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} /></div> : null}
          {form.city && !DEMO ? <div className={"co-f co-zip" + (tried && !/^\\d{4}$/.test(form.zip || "") ? " err" : "")}><label htmlFor="co-zip">ZIP code</label><input id="co-zip" inputMode="numeric" autoComplete="postal-code" maxLength={4} placeholder="9500" value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value.replace(/\\D/g, "").slice(0, 4) })} /></div> : null}''')
rep('<div className="co-saved"><span>{form.street}, {form.brgy}, {form.city}, {form.province}<em className="eta">',
    '<div className="co-saved"><span>{form.street}, {form.brgy}, {form.city}, {form.province}{form.zip ? " " + form.zip : ""}<em className="eta">')

# ── 6. Payment: Maya hosted checkout only (decision 5: no COD, no instalments yet) ─────
rep('const payOptions = PAYS.filter(([k]) => (k === "cod" ? allowCOD : k === "install" ? allowInstall : true));\n'
    '  const payKey = payOptions.some(([k]) => k === pay) ? pay : "card";',
    'const payOptions = DEMO ? PAYS.filter(([k]) => (k === "cod" ? allowCOD : k === "install" ? allowInstall : true)) : PAYS_LIVE;\n'
    '  const payKey = payOptions.some(([k]) => k === pay) ? pay : payOptions[0][0];')
rep('const FAIL_TEXT = {',
    '/* Live: one button. Maya\'s page offers the channels enabled on the merchant account (GCash, cards, Maya wallet). */\n'
    'const PAYS_LIVE = [["maya", "Maya", "GCash, card or Maya wallet, on Maya\'s secure page"]];\n'
    'const FAIL_TEXT = {')
rep('''{(payKey === "gcash" || payKey === "maya") ? <div className="co-cardnote">{Ico.lock(13)} You confirm in the {payKey === "gcash" ? "GCash" : "Maya"} app. Your details stay saved here.</div> : null}''',
    '''{(payKey === "gcash" || payKey === "maya") ? <div className="co-cardnote">{Ico.lock(13)} {DEMO ? <>You confirm in the {payKey === "gcash" ? "GCash" : "Maya"} app. Your details stay saved here.</> : <>You pay on Maya&apos;s secure page, then come back here. Your details stay saved.</>}</div> : null}''')

# ── 7. First-buyer check from the server (the Watch) ─────────────────────────────────
rep('''  useEffect(() => {
    /* the Watch rule checks the number of the person who takes it */
    if (forOther) { if (rcpDigits !== 11 || !usedBefore || numberUsed) return; }
    else if (!verified || member || !usedBefore || numberUsed) return;''',
    '''  /* live: ask the server about the number of the person who takes the capsules */
  const [srvUsed, setSrvUsed] = useState(false);
  const takerMobile = forOther ? rcp.mobile : form.mobile;
  useEffect(() => {
    if (DEMO || numberUsed || !basket.some((x) => x.kind === "watch")) return;
    const d = takerMobile.replace(/\\D/g, ""); if (d.length !== 11) return;
    const ac = new AbortController();
    fetch("/api/shop/first-buyer?mobile=" + d, { signal: ac.signal }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (j && j.eligible === false) setSrvUsed(true); }).catch(() => {});
    return () => ac.abort();
  }, [takerMobile, basket, numberUsed]);
  const usedNow = DEMO ? usedBefore : srvUsed;
  useEffect(() => {
    /* the Watch rule checks the number of the person who takes it */
    if (forOther) { if (rcpDigits !== 11 || !usedNow || numberUsed) return; }
    else if (!verified || member || !usedNow || numberUsed) return;''')
rep('}, [verified, usedBefore, member, numberUsed, forOther, rcpDigits]);', '}, [verified, usedNow, member, numberUsed, forOther, rcpDigits]);')

# ── 8. Pay: create the order on the server, then Maya. Return lands on the Done sheet ─
rep('''    setPaying(true);
    setTimeout(() => {''',
    '''    setPaying(true);
    if (!DEMO) { payLive(); return; }
    setTimeout(() => {''')
rep('''  const tryPay = () => {''',
    '''  /* ── live payment ─────────────────────────────────────────────────────────────
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
        sendShopOrderEmail(j.id).catch(() => {});
      }
      try { sessionStorage.setItem("gg-order-summary", JSON.stringify({ code: pend.code, summary: summaryFor() })); } catch (e) {}
      const co = await startMayaCheckout(pend.id);
      window.location.assign(co.redirectUrl || co.orderUrl);
    } catch (err) {
      setPaying(false);
      setPayErr(err && err.message ? err.message : "The payment could not start. Please try again.");
    }
  };
  /* back from Maya */
  useEffect(() => {
    if (DEMO || !params.order) return;
    const code = params.order;
    let saved = null; try { saved = JSON.parse(sessionStorage.getItem("gg-order-summary") || "null"); } catch (e) {}
    const summary = saved && saved.code === code ? saved.summary : null;
    if (params.p === "success") {
      reconcileMayaPayment(code).catch(() => {});
      const done = (s) => { setOrder(s); setBasket([]); setPayFail(null); setTried(false); setStage("done"); try { sessionStorage.removeItem("gg-pending-order"); sessionStorage.removeItem("gg-order-summary"); } catch (e) {} };
      if (summary) done(summary);
      else getPublicShopOrder(code).then((o) => { if (o) done({ lines: [], pts: 0, total: o.total_amount, pay: "maya", months: 3, isWatch: o.items.some((x) => x.id === "watch"), withOthers: false, daily: null, peak: o.items.some((x) => x.id === "peak"), newMember: true, name: o.first_name || "", province: o.province, doseGoal: "keep", credit: 0, ref: "", forOther: false, rcpName: "", becameGuardian: false }); }).catch(() => {});
    } else if (params.p === "failure" || params.p === "cancel") {
      setPayFail(params.p === "cancel" ? "cancel" : "maya"); setStage("checkout");
    }
    try { window.history.replaceState(null, "", "/shop"); } catch (e) {}
  }, [params.order]);
  const tryPay = () => {''')
rep('const FAIL_TEXT = { card:', 'const FAIL_TEXT = { cancel: "The payment was cancelled.", card:')
rep('''          {tried && !canPay ? <div className="co-hint">''',
    '''          {payErr ? <div className="co-hint" role="alert">{payErr}</div> : null}
          {tried && !canPay ? <div className="co-hint">''')

# ── 9. Done sheet: the card is finished on Lifestyle (decision 1: One Account) ──────────
rep('''<>Your order for <b>{order.rcpName}</b> is in.{order.newMember ? " Your Lifestyle card is ready too." : ""}</>''',
    '''<>Your order for <b>{order.rcpName}</b> is in.{order.newMember ? (DEMO ? " Your Lifestyle card is ready too." : " Check your email to finish your free Lifestyle card.") : ""}</>''')
rep('''<>Welcome, Gut Guardian. Your card is ready, <b>{firstName(order.name)}</b>. <i className="cry-in">We Gut You.</i></>''',
    '''<>Welcome, Gut Guardian. {DEMO ? <>Your card is ready, <b>{firstName(order.name)}</b>.</> : <>Your card is waiting, <b>{firstName(order.name)}</b>.</>} <i className="cry-in">We Gut You.</i></>''')
rep('''<>Your Lifestyle card is ready, <b>{firstName(order.name)}</b>.</>''',
    '''<>Your Lifestyle card is {DEMO ? "ready" : "waiting"}, <b>{firstName(order.name)}</b>.</>''')
rep('''<div className="sl-line"><div className="nx">03</div><div><div className="ln">Track it in your Lifestyle page</div><div className="ld2">Doses, reminders, E-Points{order.daily ? `, and your next refill on ${addDays(30)}` : ""}.</div></div></div>}''',
    '''(order.newMember && !DEMO
                  ? <div className="sl-line"><div className="nx">03</div><div><div className="ln">Finish your free Lifestyle card</div><div className="ld2">We sent a link to your email. Set your password, then track doses, reminders and E-Points{order.daily ? `, and your next refill on ${addDays(30)}` : ""} there.</div></div></div>
                  : <div className="sl-line"><div className="nx">03</div><div><div className="ln">Track it in your Lifestyle page</div><div className="ld2">Doses, reminders, E-Points{order.daily ? `, and your next refill on ${addDays(30)}` : ""}.</div></div></div>)}''')
rep('''href={LIFESTYLE_HOME + "#" + (order.forOther ? (order.newMember ? "card" : "member") : order.isWatch ? "ordered" : "member") + (order.becameGuardian ? "~guardian" : "~welcome")} {...link}>Open my Lifestyle page''',
    '''href={DEMO ? LIFESTYLE_HOME + "#" + (order.forOther ? (order.newMember ? "card" : "member") : order.isWatch ? "ordered" : "member") + (order.becameGuardian ? "~guardian" : "~welcome") : order.newMember ? LIFESTYLE_URL + "/register?from=shop" : LIFESTYLE_HOME + "?do=" + (order.becameGuardian ? "guardian" : "welcome")} {...link}>{order.newMember && !DEMO ? "Finish my Lifestyle card" : "Open my Lifestyle page"}''')
rep('''<div className="sl-conote" style={{ marginTop: 6 }}>By paying, you agree to the <u>Terms of Sale</u> and the <u>Privacy Notice</u>.{!member ? " Your free Lifestyle card is made from these details." : ""}</div>''',
    '''<div className="sl-conote" style={{ marginTop: 6 }}>By paying, you agree to the <u>Terms of Sale</u> and the <u>Privacy Notice</u>.{!member ? (DEMO ? " Your free Lifestyle card is made from these details." : " We email you a link to finish your free Lifestyle card.") : ""}</div>''')

# ── 9b. Lint: one apostrophe in JSX text ───────────────────────────────────────────────
rep("Holds a Master's in Entrepreneurship from Ateneo de Manila University.", "Holds a Master&apos;s in Entrepreneurship from Ateneo de Manila University.")

# ── 9c. Server render = first browser render (no hydration mismatch) ─────────────────
rep('const [w, setW] = useState(() => typeof window !== "undefined" && window.matchMedia && window.matchMedia(q).matches);',
    'const [w, setW] = useState(false); /* set after load, so the server and browser first render match */')
rep('''const [basket, setBasket] = useState(() => { try { const b = JSON.parse(localStorage.getItem("gg-shop-basket") || "[]"); return Array.isArray(b) ? b : []; } catch (e) { return []; } });''',
    '''const [basket, setBasket] = useState([]);
  useEffect(() => { try { const b = JSON.parse(localStorage.getItem("gg-shop-basket") || "[]"); if (Array.isArray(b) && b.length) setBasket((cur) => (cur.length ? cur : b)); } catch (e) {} }, []); /* load after mount, before the save below */''')
# the Shop had no page heading: one for screen readers and search
rep('''  return (
    <>
      {wide ? (
        <div className="sl sl-page sl-wide" id="buy">''', '''  return (
    <>
      <h1 className="vh">Shop SynBIOTIC+</h1>
      {wide ? (
        <div className="sl sl-page sl-wide" id="buy">''')

# ── 9d. Fonts come from next/font in app/layout.tsx (hashed family names, self-hosted) ──
rep("--serif:'Fraunces',Georgia,serif;", "--serif:var(--font-fraunces),'Fraunces',Georgia,serif;")
rep("--sans:'Inter Tight',system-ui,sans-serif;", "--sans:var(--font-inter-tight),'Inter Tight',system-ui,sans-serif;")
rep("--mono:'IBM Plex Mono',ui-monospace,monospace;", "--mono:var(--font-plex-mono),'IBM Plex Mono',ui-monospace,monospace;")

# ── 10. Two small CSS additions for the new fields ─────────────────────────────────────
rep('const CSS = `\n', 'const CSS = `\n.vh{position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0;}\n.co-two{display:grid;grid-template-columns:1fr 1fr;gap:10px;}\n.co-zip input{max-width:140px;}\n')

open(out, "w", encoding="utf-8").write(s)
print("ported", len(s.splitlines()), "lines ->", out)
