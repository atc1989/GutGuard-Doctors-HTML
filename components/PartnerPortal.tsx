"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { LoaderCircle, X } from "lucide-react";
import { Logo } from "@/components/GutguardSite";
import {
  getPartnerDashboard,
  hasPartnerSession,
  sendPartnerOtp,
  signOutPartner,
  verifyPartnerOtp,
  type PartnerDashboard,
  type PartnerOrder,
  type PartnerOrderScope,
} from "@/lib/api";

const SHOP_ORIGIN = (process.env.NEXT_PUBLIC_SHOP_URL ?? "https://shop.gutguard.ph").replace(/\/$/, "");
const PUBLIC_SITE_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://partners.gutguard.ph").replace(/\/$/, "");

// Rendered large and scaled down by CSS so the download and the print sheet are both
// sharp. The on-screen size is set in globals.css, not here.
const QR_RENDER_PX = 1024;

type PartnerQrMode = "shop" | "referral" | "profile";

const peso = (value: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(value);

type View = "checking" | "email" | "code" | "signing-in" | "dashboard";
type AuthError = { field: "email" | "code" | "form"; message: string; expired?: boolean } | null;

const RESEND_COOLDOWN_SECONDS = 30;

export default function PartnerPortal() {
  const [view, setView] = useState<View>("checking");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<AuthError>(null);
  const [busyAction, setBusyAction] = useState<"send" | "verify" | "resend" | null>(null);
  const [resendRemaining, setResendRemaining] = useState(0);
  const [notice, setNotice] = useState("");
  const [data, setData] = useState<PartnerDashboard | null>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const codeHeadingRef = useRef<HTMLHeadingElement>(null);
  const requestPendingRef = useRef(false);

  const load = useCallback(async () => {
    const dashboard = await getPartnerDashboard();
    setData(dashboard);
    setView("dashboard");
  }, []);

  useEffect(() => {
    let cancelled = false;

    hasPartnerSession()
      .then(async (signedIn) => {
        if (cancelled) return;
        if (!signedIn) {
          setView("email");
          return;
        }
        // A live session is not the same as being a partner: the account may exist while the
        // address is not on any registration. Let the failure land on the login screen.
        try {
          await load();
        } catch {
          if (cancelled) return;
          await signOutPartner();
          setError({ field: "form", message: "Your dashboard could not be loaded. Please sign in again." });
          setView("email");
        }
      })
      .catch(() => {
        if (!cancelled) setView("email");
      });

    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    if (resendRemaining <= 0) return;
    const timer = window.setInterval(() => {
      setResendRemaining((remaining) => Math.max(0, remaining - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendRemaining]);

  useEffect(() => {
    if (view !== "code") return;
    requestAnimationFrame(() => {
      codeHeadingRef.current?.focus();
      codeInputRef.current?.focus();
    });
  }, [view]);

  function validateEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function validateEmailField() {
    const normalized = email.trim();
    if (!normalized || !validateEmail(normalized)) {
      setError({ field: "email", message: "Enter a valid email address." });
      return false;
    }
    if (error?.field === "email") setError(null);
    return true;
  }

  async function requestCode(event: React.FormEvent) {
    event.preventDefault();
    if (requestPendingRef.current || busyAction || !validateEmailField()) return;
    requestPendingRef.current = true;
    const normalizedEmail = email.trim().toLowerCase();
    setEmail(normalizedEmail);
    setBusyAction("send");
    setError(null);
    setNotice("Sending code…");

    try {
      await sendPartnerOtp(normalizedEmail);
      setCode("");
      setResendRemaining(RESEND_COOLDOWN_SECONDS);
      setView("code");
      setNotice("Code sent. Check your email.");
    } catch (caught) {
      setError(getSendError(caught));
      setNotice("");
    } finally {
      requestPendingRef.current = false;
      setBusyAction(null);
    }
  }

  async function submitCode(event: React.FormEvent) {
    event.preventDefault();
    if (requestPendingRef.current || busyAction) return;
    if (code.length !== 6) {
      setError({ field: "code", message: "Enter the complete 6-digit code." });
      codeInputRef.current?.focus();
      return;
    }
    requestPendingRef.current = true;
    setBusyAction("verify");
    setError(null);
    setNotice("Verifying code…");

    try {
      await verifyPartnerOtp(email, code);
      setView("signing-in");
      setNotice("Signing you in…");
      await load();
    } catch (caught) {
      // Covers both a wrong code and a verified address with no partner row. Signing out
      // on the second case stops a non-partner account from sitting in a broken half-state.
      await signOutPartner();
      const nextError = getVerificationError(caught);
      setError(nextError);
      if (nextError.expired) setResendRemaining(0);
      setView("code");
      setNotice("");
      requestAnimationFrame(() => codeInputRef.current?.focus());
    } finally {
      requestPendingRef.current = false;
      setBusyAction(null);
    }
  }

  async function resendCode() {
    if (requestPendingRef.current || busyAction || resendRemaining > 0) return;
    requestPendingRef.current = true;
    setBusyAction("resend");
    setError(null);
    setNotice("Sending a new code…");
    try {
      await sendPartnerOtp(email);
      setCode("");
      setResendRemaining(RESEND_COOLDOWN_SECONDS);
      setNotice("A new code was sent.");
      requestAnimationFrame(() => codeInputRef.current?.focus());
    } catch (caught) {
      setError(getResendError(caught));
      setNotice("");
    } finally {
      requestPendingRef.current = false;
      setBusyAction(null);
    }
  }

  function changeEmail() {
    setView("email");
    setCode("");
    setError(null);
    setNotice("");
    setResendRemaining(0);
    requestAnimationFrame(() => {
      emailInputRef.current?.focus();
      emailInputRef.current?.select();
    });
  }

  async function signOut() {
    await signOutPartner();
    setData(null);
    setCode("");
    setError(null);
    setNotice("");
    setView("email");
  }

  if (view === "checking") {
    return (
      <main className="shop-shell partner-auth-shell">
        <PartnerNav />
        <section className="partner-auth-card partner-auth-loading" aria-busy="true" aria-live="polite">
          <LoaderCircle className="partner-spinner" aria-hidden="true" />
          <p className="partner-eyebrow">Partner portal</p>
          <h1>Opening your dashboard</h1>
        </section>
      </main>
    );
  }

  if (view === "dashboard" && data) {
    return <Dashboard data={data} onSignOut={signOut} />;
  }

  if (view === "signing-in") {
    return (
      <main className="shop-shell partner-auth-shell">
        <PartnerNav />
        <section className="partner-auth-card partner-auth-loading" aria-busy="true" aria-live="polite">
          <LoaderCircle className="partner-spinner" aria-hidden="true" />
          <p className="partner-eyebrow">Partner portal</p>
          <h1>Signing you in…</h1>
          <p>Opening your secure partner dashboard.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="shop-shell partner-auth-shell">
      <PartnerNav />
      <section className="partner-auth-card" aria-labelledby="partner-auth-title">
        <p className="partner-eyebrow">Partner portal</p>
        <h1 id="partner-auth-title" ref={view === "code" ? codeHeadingRef : undefined} tabIndex={view === "code" ? -1 : undefined}>
          {view === "code" ? "Check your email" : "Welcome back"}
        </h1>
        <p className="partner-auth-lede">
          {view === "code"
            ? <>We sent a 6-digit code to <strong>{maskEmail(email)}</strong>. Enter it below to continue.</>
            : <>Sign in to track your referrals, orders, and campaign activity. We’ll email a secure one-time code—no password required.</>}
        </p>

        <div className="partner-auth-status" role="status" aria-live="polite">{notice}</div>

        {view === "code" ? (
          <form className="partner-form" onSubmit={submitCode} noValidate>
            <label htmlFor="partner-code">Verification code</label>
            <input
              ref={codeInputRef}
              id="partner-code"
              name="one-time-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(event) => {
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                if (error?.field === "code") setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              aria-describedby={error ? "partner-code-error partner-code-help" : "partner-code-help"}
              aria-invalid={error?.field === "code" || undefined}
              placeholder="000000"
              required
            />
            <p id="partner-code-help" className="partner-field-help">Enter all six digits from the email. The server enforces code expiration.</p>
            {error ? <div id="partner-code-error" className="partner-auth-error" role="alert">{error.message}</div> : null}
            <button type="submit" className="shop-primary partner-auth-primary" disabled={Boolean(busyAction) || code.length < 6}>
              {busyAction === "verify" ? <LoaderCircle className="partner-spinner" aria-hidden="true" /> : null}
              <span>{busyAction === "verify" ? "Verifying…" : "Verify and continue"}</span>
            </button>
            <div className="partner-auth-secondary-actions">
              <button type="button" className="partner-auth-text-button" onClick={resendCode} disabled={Boolean(busyAction) || resendRemaining > 0}>
                {busyAction === "resend" ? "Resending…" : resendRemaining > 0 ? `Resend code in ${formatCountdown(resendRemaining)}` : "Resend code"}
              </button>
              <button type="button" className="partner-auth-text-button" onClick={changeEmail} disabled={Boolean(busyAction)}>
                Use a different email
              </button>
            </div>
          </form>
        ) : (
          <form className="partner-form" onSubmit={requestCode} noValidate>
            <label htmlFor="partner-email">Email address</label>
            <input
              ref={emailInputRef}
              id="partner-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (error?.field === "email") setError(null);
              }}
              onBlur={validateEmailField}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              aria-describedby={error ? "partner-email-error" : undefined}
              aria-invalid={error?.field === "email" || undefined}
              placeholder="name@clinic.ph"
              required
            />
            {error ? <div id="partner-email-error" className="partner-auth-error" role="alert">{error.message}</div> : null}
            <button type="submit" className="shop-primary partner-auth-primary" disabled={Boolean(busyAction) || !email.trim()}>
              {busyAction === "send" ? <LoaderCircle className="partner-spinner" aria-hidden="true" /> : null}
              <span>{busyAction === "send" ? "Sending code…" : "Email me a sign-in code"}</span>
            </button>
            <p className="partner-apply-link">
              New to GutGuard? <Link href="/physicians/register">Apply to become a partner</Link>
            </p>
          </form>
        )}

        <p className="partner-auth-trust">Secure passwordless sign-in · Expiration and resend limits are enforced by our authentication provider</p>
      </section>
    </main>
  );
}

export function Dashboard({ data, onSignOut }: { data: PartnerDashboard; onSignOut: () => void }) {
  const qrRef = useRef<HTMLDivElement>(null);
  const linkRef = useRef<HTMLParagraphElement>(null);
  const posterDialogRef = useRef<HTMLDivElement>(null);
  const posterTriggerRef = useRef<HTMLButtonElement>(null);
  const lastOrderQueryRef = useRef("all||||newest|25|0");
  const [copied, setCopied] = useState(false);
  const [qrMode, setQrMode] = useState<PartnerQrMode>("shop");
  const [dashboard, setDashboard] = useState(data);
  const [activityTab, setActivityTab] = useState<"orders" | "partners">("orders");
  const [orderScope, setOrderScope] = useState<PartnerOrderScope>("all");
  const [orderStatus, setOrderStatus] = useState("");
  const [orderDateFrom, setOrderDateFrom] = useState("");
  const [orderDateTo, setOrderDateTo] = useState("");
  const [orderSort, setOrderSort] = useState<"newest" | "oldest">("newest");
  const [orderOffset, setOrderOffset] = useState(0);
  const [orderPageSize, setOrderPageSize] = useState(25);
  const [partnerOffset, setPartnerOffset] = useState(0);
  const [partnerPageSize, setPartnerPageSize] = useState(10);
  const [ordersBusy, setOrdersBusy] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [posterOpen, setPosterOpen] = useState(false);

  const link = getPartnerQrLink(dashboard.partner.routing_slug, qrMode);
  const conversion = dashboard.clicks.total > 0 ? (dashboard.totals.direct_orders / dashboard.clicks.total) * 100 : 0;
  const visiblePartners = dashboard.referred_partners.slice(partnerOffset, partnerOffset + partnerPageSize);

  useEffect(() => {
    const queryKey = [orderScope, orderStatus, orderDateFrom, orderDateTo, orderSort, orderPageSize, orderOffset].join("|");
    if (lastOrderQueryRef.current === queryKey) return;
    lastOrderQueryRef.current = queryKey;
    let cancelled = false;
    setOrdersBusy(true);
    setOrdersError("");
    getPartnerDashboard({ scope: orderScope, status: orderStatus, dateFrom: orderDateFrom, dateTo: orderDateTo, sort: orderSort, limit: orderPageSize, offset: orderOffset })
      .then((next) => { if (!cancelled) setDashboard(next); })
      .catch(() => { if (!cancelled) setOrdersError("Orders could not be loaded. Please try again."); })
      .finally(() => { if (!cancelled) setOrdersBusy(false); });
    return () => { cancelled = true; };
  }, [orderScope, orderStatus, orderDateFrom, orderDateTo, orderSort, orderPageSize, orderOffset]);

  useEffect(() => {
    if (!posterOpen) return;
    posterDialogRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") { setPosterOpen(false); requestAnimationFrame(() => posterTriggerRef.current?.focus()); return; }
      if (event.key !== "Tab" || !posterDialogRef.current) return;
      const controls = Array.from(posterDialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      if (!controls.length) return;
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [posterOpen]);

  function moveQrTab(event: React.KeyboardEvent<HTMLButtonElement>, mode: PartnerQrMode) {
    const modes: PartnerQrMode[] = ["shop", "referral", "profile"];
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = modes[(modes.indexOf(mode) + delta + modes.length) % modes.length];
    setQrMode(next); setCopied(false);
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-qr-mode="${next}"]`)?.focus());
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is blocked on insecure origins and in some in-app browsers. The link is
      // shown in full above the button, so there is still a way through.
      setCopied(false);
      const selection = window.getSelection();
      if (selection && linkRef.current) { const range = document.createRange(); range.selectNodeContents(linkRef.current); selection.removeAllRanges(); selection.addRange(range); }
    }
  }

  function downloadQr() {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;

    const anchor = document.createElement("a");
    anchor.href = canvas.toDataURL("image/png");
    anchor.download = `gutguard-${qrMode}-qr-${dashboard.partner.routing_slug}.png`;
    anchor.click();
  }

  return (
    <main className="shop-shell partner-dashboard-shell">
      <PartnerNav onSignOut={onSignOut} />

      <section className="shop-order-panel">
        <p className="shop-kicker">Partner dashboard</p>
        <h1>{dashboard.partner.full_name}</h1>
        <p className="shop-lede">
          Track orders placed through your shop link and through partners you referred.
        </p>

        <div className="partner-stats">
          <Stat label="Direct orders" value={String(dashboard.totals.direct_orders)} note={`${dashboard.clicks.total} shop-link clicks`} />
          <Stat label="Referred partners" value={String(dashboard.totals.referred_partners)} note="one referral level" />
          <Stat label="Referred-partner orders" value={String(dashboard.totals.referred_orders)} note="generated by partners you referred" />
          <Stat label="Combined paid value" value={peso(dashboard.totals.paid_amount)} note="gross order value, not commission" />
        </div>
        <p className="partner-performance-detail">Direct conversion: {dashboard.clicks.total ? `${conversion.toFixed(1)}%` : "--"} · {dashboard.clicks.last_30_days} clicks in the last 30 days · {dashboard.totals.paid_orders} paid orders</p>
      </section>

      <div className="partner-dashboard-grid">
        <section className="shop-order-panel partner-share-panel">
          <p className="shop-kicker">Share &amp; grow</p>
          <h2>Your QR codes</h2>
          <p className="shop-lede">
            Choose what you want people to open when they scan.
          </p>

          <div className="partner-qr-toggle" role="tablist" aria-label="QR code type">
            <button
              type="button"
              role="tab" data-qr-mode="shop" className={qrMode === "shop" ? "active" : ""}
              aria-selected={qrMode === "shop"}
              tabIndex={qrMode === "shop" ? 0 : -1} onKeyDown={(event) => moveQrTab(event, "shop")}
              onClick={() => {
                setQrMode("shop");
                setCopied(false);
              }}
            >
              <strong>Shop QR</strong>
            </button>
            <button
              type="button"
              role="tab" data-qr-mode="referral" className={qrMode === "referral" ? "active" : ""}
              aria-selected={qrMode === "referral"}
              tabIndex={qrMode === "referral" ? 0 : -1} onKeyDown={(event) => moveQrTab(event, "referral")}
              onClick={() => { setQrMode("referral"); setCopied(false); }}
            >
              <strong>Referral QR</strong>
            </button>
            <button
              type="button"
              role="tab" data-qr-mode="profile" className={qrMode === "profile" ? "active" : ""}
              aria-selected={qrMode === "profile"}
              tabIndex={qrMode === "profile" ? 0 : -1} onKeyDown={(event) => moveQrTab(event, "profile")}
              onClick={() => {
                setQrMode("profile");
                setCopied(false);
              }}
            >
              <strong>Profile QR</strong>
            </button>
          </div>

          <p className="partner-qr-description" role="tabpanel">
            {qrMode === "shop" ? "Send customers to your GutGuard shop and attribute their orders to you."
              : qrMode === "referral" ? "Invite another partner. Their registration and future attributed orders will be connected to you."
              : "Send visitors directly to your TikTok profile."}
          </p>

          <div className="partner-link-row">
            <p className="partner-link" ref={linkRef}>{link}</p>
            <button type="button" className="shop-primary" onClick={copyLink}>
              <span>{copied ? "Copied" : "Copy link"}</span>
            </button>
            <span className="visually-hidden" aria-live="polite">{copied ? "Link copied" : ""}</span>
          </div>

          <div className="partner-qr" ref={qrRef}>
            <QRCodeSVG
              key={qrMode}
              value={link}
              size={QR_RENDER_PX}
              level="M"
              marginSize={2}
              style={{ width: "100%", height: "auto" }}
            />
            <QRCodeCanvas className="partner-qr-download-canvas" value={link} size={QR_RENDER_PX} level="M" marginSize={4} />
          </div>

          <div className="partner-qr-actions">
            <button type="button" className="shop-secondary" onClick={downloadQr}>
              Download PNG
            </button>
            <button ref={posterTriggerRef} type="button" className="shop-secondary" onClick={() => setPosterOpen(true)}>
              Preview poster
            </button>
          </div>
        </section>

        <section className="shop-order-panel partner-orders-panel">
          <div className="partner-activity-tabs" role="tablist" aria-label="Dashboard activity">
            <button type="button" role="tab" aria-selected={activityTab === "orders"} className={activityTab === "orders" ? "active" : ""} onClick={() => setActivityTab("orders")}>Orders <span>{dashboard.totals.orders}</span></button>
            <button type="button" role="tab" aria-selected={activityTab === "partners"} className={activityTab === "partners" ? "active" : ""} onClick={() => setActivityTab("partners")}>Referred partners <span>{dashboard.totals.referred_partners}</span></button>
          </div>

          {activityTab === "orders" ? <>
          <p className="shop-kicker">Your orders</p>
          <h2>{dashboard.orders_page.total > 0 ? `${dashboard.orders_page.total} attributed` : "No orders yet"}</h2>

          <div className="partner-order-toolbar">
            <div className="partner-order-tabs" role="tablist" aria-label="Order attribution">
              {([['all', `All ${dashboard.totals.orders}`], ['direct', `Direct ${dashboard.totals.direct_orders}`], ['referred', `From referred partners ${dashboard.totals.referred_orders}`]] as const).map(([value, label]) => (
                <button key={value} type="button" role="tab" aria-selected={orderScope === value}
                  className={orderScope === value ? "active" : ""}
                  onClick={() => { setOrderScope(value); setOrderOffset(0); }}>{label}</button>
              ))}
            </div>
            <label className="partner-order-filter">Status
              <select value={orderStatus} onChange={(event) => { setOrderStatus(event.target.value); setOrderOffset(0); }}>
                <option value="">All statuses</option><option value="paid">Paid</option>
                <option value="pending">Awaiting payment</option><option value="fulfilled">Delivered</option>
                <option value="cancelled">Cancelled</option><option value="refunded">Refunded</option>
              </select>
            </label>
            <label className="partner-order-filter">From<input type="date" value={orderDateFrom} max={orderDateTo || undefined} onChange={(event) => { setOrderDateFrom(event.target.value); setOrderOffset(0); }} /></label>
            <label className="partner-order-filter">To<input type="date" value={orderDateTo} min={orderDateFrom || undefined} onChange={(event) => { setOrderDateTo(event.target.value); setOrderOffset(0); }} /></label>
            <label className="partner-order-filter">Sort<select value={orderSort} onChange={(event) => { setOrderSort(event.target.value as "newest" | "oldest"); setOrderOffset(0); }}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label>
          </div>

          {ordersError ? <div className="partner-orders-error" role="alert">{ordersError}</div> : null}

          {ordersBusy ? <div className="partner-orders-loading" aria-live="polite"><LoaderCircle className="partner-spinner" aria-hidden="true" /> Loading orders…</div> : dashboard.orders.length === 0 ? (
            <div className="partner-empty-orders">
              <strong>{orderScope === "direct" ? "No direct orders yet." : orderScope === "referred" ? "No referred-partner orders yet." : "No attributed orders yet."}</strong>
              <p>{orderScope === "referred" ? "Orders generated by partners you referred will appear here." : "Share the matching QR code to get started."}</p>
            </div>
          ) : (
            <div className="partner-orders">
              {dashboard.orders.map((order) => (
                <OrderRow key={order.order_code} order={order} />
              ))}
            </div>
          )}

          <div className="partner-pagination" aria-label="Order pages">
            <label className="partner-pagination-size">Rows<select value={orderPageSize} onChange={(event) => { setOrderPageSize(Number(event.target.value)); setOrderOffset(0); }}><option value="10">10</option><option value="25">25</option><option value="50">50</option></select></label>
            <button type="button" className="shop-secondary" disabled={ordersBusy || orderOffset === 0} onClick={() => setOrderOffset(Math.max(0, orderOffset - orderPageSize))}>Previous</button>
            <span>{dashboard.orders_page.total ? `${orderOffset + 1}–${Math.min(orderOffset + dashboard.orders.length, dashboard.orders_page.total)} of ${dashboard.orders_page.total}` : "0 orders"}</span>
            <button type="button" className="shop-secondary" disabled={ordersBusy || !dashboard.orders_page.has_more} onClick={() => setOrderOffset(orderOffset + orderPageSize)}>Next</button>
          </div>

          <p className="shop-note">
            Buyer details stay private. You only see their first name and area.
          </p>
          </> : <>
            <p className="shop-kicker">Partners you referred</p>
            <div className="partner-section-heading">
              <h2>{dashboard.totals.referred_partners ? `${dashboard.totals.referred_partners} partners` : "No referred partners yet"}</h2>
            </div>
            {ordersError ? <div className="partner-orders-error" role="alert">{ordersError}</div> : null}
            {ordersBusy ? <div className="partner-orders-loading" aria-live="polite"><LoaderCircle className="partner-spinner" aria-hidden="true" /> Loading partners…</div> : visiblePartners.length ? <div className="partner-referred-list">{visiblePartners.map((partner) => (
              <button type="button" key={partner.routing_slug} className="partner-referred-row" onClick={() => { setActivityTab("orders"); setOrderScope("referred"); setOrderOffset(0); }}>
                <span><strong>{partner.full_name}</strong><small>{[partner.specialty, partner.practice_location].filter(Boolean).join(" · ") || "Partner"}</small></span>
                <span><strong>{partner.orders}</strong><small>orders</small></span>
                <span><strong>{peso(partner.paid_order_value)}</strong><small>paid order value</small></span>
              </button>
            ))}</div> : <div className="partner-empty-orders"><strong>Your referral registrations will appear here.</strong><p>Share your Referral QR to invite another GutGuard partner.</p></div>}
            <div className="partner-pagination" aria-label="Referred partner pages">
              <label className="partner-pagination-size">Rows<select value={partnerPageSize} onChange={(event) => { setPartnerPageSize(Number(event.target.value)); setPartnerOffset(0); }}><option value="10">10</option><option value="25">25</option><option value="50">50</option></select></label>
              <button type="button" className="shop-secondary" disabled={ordersBusy || partnerOffset === 0} onClick={() => setPartnerOffset(Math.max(0, partnerOffset - partnerPageSize))}>Previous</button>
              <span>{dashboard.totals.referred_partners ? `${partnerOffset + 1}–${Math.min(partnerOffset + visiblePartners.length, dashboard.totals.referred_partners)} of ${dashboard.totals.referred_partners}` : "0 partners"}</span>
              <button type="button" className="shop-secondary" disabled={ordersBusy || partnerOffset + visiblePartners.length >= dashboard.totals.referred_partners} onClick={() => setPartnerOffset(partnerOffset + partnerPageSize)}>Next</button>
            </div>
          </>}
        </section>
      </div>

      {/* Screen-hidden, print-only. Kept in the DOM so window.print() needs no new page. */}
      {posterOpen ? <div className="partner-poster-modal" role="dialog" aria-modal="true" aria-labelledby="poster-title">
        <div className="partner-poster-dialog" ref={posterDialogRef} tabIndex={-1}>
          <div className="partner-poster-header"><div><p className="shop-kicker">Print preview</p><h2 id="poster-title">A4 QR poster</h2></div><button type="button" className="partner-poster-close" aria-label="Close poster preview" onClick={() => setPosterOpen(false)}><X aria-hidden="true" /></button></div>
          <PosterContent mode={qrMode} link={link} partnerName={dashboard.partner.full_name} />
          <div className="partner-poster-actions"><button type="button" className="shop-secondary" onClick={() => { setPosterOpen(false); requestAnimationFrame(() => posterTriggerRef.current?.focus()); }}>Close</button><button type="button" className="shop-primary" onClick={() => window.print()}>Print poster</button></div>
        </div>
      </div> : null}

      <div className="partner-print" aria-hidden="true">
        <Logo h={44} className="partner-poster-logo" />
        <strong>{posterTitle(qrMode)}</strong>
        <QRCodeSVG value={link} size={QR_RENDER_PX} level="M" marginSize={4} />
        <span>{dashboard.partner.full_name}</span>
        <small>{link}</small>
      </div>
    </main>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <article className="partner-stat">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function PosterContent({ mode, link, partnerName }: { mode: PartnerQrMode; link: string; partnerName: string }) {
  return <div className="partner-poster-preview" aria-label={`${posterTitle(mode)} poster preview`}>
    <Logo h={44} className="partner-poster-logo" />
    <strong>{posterTitle(mode)}</strong>
    <div className="partner-poster-qr"><QRCodeSVG value={link} size={QR_RENDER_PX} level="M" marginSize={4} style={{ width: "100%", height: "auto" }} /></div>
    <span>{partnerName}</span><small>{link}</small>
  </div>;
}

function posterTitle(mode: PartnerQrMode) {
  if (mode === "shop") return "Scan to order GutGuard";
  if (mode === "referral") return "Scan to become a GutGuard partner";
  return "Scan to visit my TikTok profile";
}

function OrderRow({ order }: { order: PartnerOrder }) {
  const isPaid = order.payment_status === "paid";

  return (
    <article className="partner-order">
      <div>
        <strong>{order.buyer_first_name || "A customer"}</strong>
        <span>
          {[order.city, order.province].filter(Boolean).join(", ") || "Philippines"} - {formatDate(order.created_at)}
        </span>
        <span className="partner-order-source">{order.source_type === "direct" ? "Your shop link" : `Via ${order.source_partner_name}`}</span>
      </div>
      <span className={isPaid ? "partner-badge paid" : "partner-badge"}>{statusLabel(order)}</span>
      <b>{peso(order.total_amount)}</b>
    </article>
  );
}

function PartnerNav({ onSignOut }: { onSignOut?: () => void }) {
  return (
    <nav className="shop-nav partner-auth-nav" aria-label="Partner header">
      <div className="partner-auth-brand-group">
        <Link className="shop-brand" href="/" aria-label="GutGuard home">
          <Logo h={29} />
        </Link>
        <span className="partner-auth-portal-name">Partner Portal</span>
      </div>
      {onSignOut ? (
        <button type="button" className="shop-nav-link" onClick={onSignOut}>
          Sign out
        </button>
      ) : (
        <Link className="shop-nav-link" href="/shop">
          Back to GutGuard Shop
        </Link>
      )}
    </nav>
  );
}

/** Mirrors getDoctorQrUrl in the admin, so both views generate the same two QR destinations. */
function getPartnerQrLink(slug: string, mode: PartnerQrMode) {
  if (!slug) return mode === "shop" ? SHOP_ORIGIN : PUBLIC_SITE_ORIGIN;
  if (mode === "profile") return `${PUBLIC_SITE_ORIGIN}/dr/${encodeURIComponent(slug)}`;
  if (mode === "referral") return `${PUBLIC_SITE_ORIGIN}/${encodeURIComponent(slug)}`;
  if (slug === "dr-grace-saraza") return `${SHOP_ORIGIN}/beehive`;
  return `${SHOP_ORIGIN}/r/${encodeURIComponent(slug)}`;
}

function statusLabel(order: PartnerOrder) {
  if (order.payment_status === "refunded") return "Refunded";
  if (order.payment_status === "paid") return order.status === "fulfilled" ? "Delivered" : "Paid";
  if (order.status === "cancelled") return "Cancelled";
  return "Awaiting payment";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function maskEmail(email: string) {
  const [local = "", domain = ""] = email.split("@");
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"•".repeat(Math.max(3, Math.min(5, local.length - visible.length)))}@${domain}`;
}

function formatCountdown(seconds: number) {
  return `00:${String(seconds).padStart(2, "0")}`;
}

function getVerificationError(error: unknown): NonNullable<AuthError> {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("expired") || message.includes("otp_expired")) {
    return { field: "code", message: "That code has expired. Request a new code to continue.", expired: true };
  }
  if (message.includes("rate") || message.includes("too many") || message.includes("429")) {
    return { field: "code", message: "Too many attempts. Wait a moment, then request a new code." };
  }
  return { field: "code", message: "That code isn’t correct. Check the email and try again." };
}

function getSendError(error: unknown): NonNullable<AuthError> {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("rate") || message.includes("too many") || message.includes("429")) {
    return { field: "form", message: "Too many sign-in requests. Wait a moment and try again." };
  }
  return { field: "form", message: "We couldn’t send a code. Check your connection and try again." };
}

function getResendError(error: unknown): NonNullable<AuthError> {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("rate") || message.includes("too many") || message.includes("429")) {
    return { field: "code", message: "A new code can’t be sent yet. Wait a moment and try again." };
  }
  return { field: "code", message: "We couldn’t resend the code. Check your connection and try again." };
}
