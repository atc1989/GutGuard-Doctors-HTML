"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { QRCodeCanvas } from "qrcode.react";
import { LoaderCircle } from "lucide-react";
import { Logo } from "@/components/GutguardSite";
import {
  getPartnerDashboard,
  hasPartnerSession,
  sendPartnerOtp,
  signOutPartner,
  verifyPartnerOtp,
  type PartnerDashboard,
  type PartnerOrder,
  type ReferredPartner,
} from "@/lib/api";

const SHOP_ORIGIN = (process.env.NEXT_PUBLIC_SHOP_URL ?? "https://shop.gutguard.ph").replace(/\/$/, "");
const PUBLIC_SITE_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://partners.gutguard.ph").replace(/\/$/, "");

// Rendered large and scaled down by CSS so the download and the print sheet are both
// sharp. The on-screen size is set in globals.css, not here.
const QR_RENDER_PX = 1024;

type PartnerQrMode = "shop" | "referral" | "profile";
type PartnerListTab = "orders" | "partners";
const PAGE_SIZE_OPTIONS = [10, 20, 50];
const DEFAULT_PAGE_SIZE = 10;

const peso = (value: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(value);

type View = "checking" | "email" | "code" | "signing-in" | "dashboard";
type AuthError = { field: "email" | "code" | "form"; message: string; expired?: boolean } | null;

const RESEND_COOLDOWN_SECONDS = 60;

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
  const orderPageRef = useRef({ limit: DEFAULT_PAGE_SIZE, offset: 0 });

  const load = useCallback(async (page?: { limit?: number; offset?: number }) => {
    const limit = page?.limit ?? orderPageRef.current.limit;
    const offset = page?.offset ?? orderPageRef.current.offset;
    orderPageRef.current = { limit, offset };
    const dashboard = await getPartnerDashboard({ limit, offset });
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
    } catch (caught) {
      const nextError = getVerificationError(caught);
      setError(nextError);
      if (nextError.expired) setResendRemaining(0);
      setView("code");
      setNotice("");
      requestAnimationFrame(() => codeInputRef.current?.focus());
      requestPendingRef.current = false;
      setBusyAction(null);
      return;
    }

    try {
      setView("signing-in");
      setNotice("Signing you in…");
      await load();
    } catch {
      await signOutPartner();
      setError({
        field: "form",
        message: "You signed in, but the partner dashboard could not load. Sign in again in a moment.",
      });
      setView("email");
      setNotice("");
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
    return <Dashboard data={data} onSignOut={signOut} onPageChange={(limit, offset) => void load({ limit, offset })} />;
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

function Dashboard({
  data,
  onSignOut,
  onPageChange,
}: {
  data: PartnerDashboard;
  onSignOut: () => void;
  onPageChange: (limit: number, offset: number) => void;
}) {
  const qrRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [qrMode, setQrMode] = useState<PartnerQrMode>("shop");
  const [listTab, setListTab] = useState<PartnerListTab>("orders");
  const [partnerPageSize, setPartnerPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [partnerOffset, setPartnerOffset] = useState(0);

  const link = getPartnerQrLink(data.partner.routing_slug, qrMode);
  const conversion = data.clicks.total > 0 ? (data.totals.direct_orders / data.clicks.total) * 100 : 0;
  const orderLimit = data.orders_page.limit || DEFAULT_PAGE_SIZE;
  const orderOffset = data.orders_page.offset;
  const orderTotal = data.orders_page.total || data.totals.orders;
  const referredPartners = data.referred_partners;
  const visiblePartners = referredPartners.slice(partnerOffset, partnerOffset + partnerPageSize);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function downloadQr() {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;

    const anchor = document.createElement("a");
    anchor.href = canvas.toDataURL("image/png");
    anchor.download = `gutguard-${qrMode}-qr-${data.partner.routing_slug}.png`;
    anchor.click();
  }

  function selectQrMode(mode: PartnerQrMode) {
    setQrMode(mode);
    setCopied(false);
  }

  return (
    <main className="shop-shell partner-dashboard-shell">
      <PartnerNav onSignOut={onSignOut} />

      <section className="shop-order-panel">
        <p className="shop-kicker">Partner dashboard</p>
        <h1>{data.partner.full_name}</h1>

        <div className="partner-stats">
          <Stat
            label="Direct orders"
            value={String(data.totals.direct_orders)}
            note={`${data.clicks.total} shop-link click${data.clicks.total === 1 ? "" : "s"}`}
          />
          <Stat
            label="Referred partners"
            value={String(data.totals.referred_partners)}
            note="one referral level"
          />
          <Stat
            label="Referred-partner orders"
            value={String(data.totals.referred_orders)}
            note="generated by partners you referred"
          />
          <Stat
            label="Combined paid value"
            value={peso(data.totals.paid_amount)}
            note="gross order value, not commission"
          />
        </div>
        <p className="partner-stats-footnote">
          Direct conversion: {data.clicks.total > 0 ? `${conversion.toFixed(1)}%` : "--"}
          {" · "}
          {data.clicks.last_30_days} click{data.clicks.last_30_days === 1 ? "" : "s"} in the last 30 days
          {" · "}
          {data.totals.paid_orders} paid order{data.totals.paid_orders === 1 ? "" : "s"}
        </p>
      </section>

      <section className="shop-order-panel partner-share-panel">
        <p className="shop-kicker">Share &amp; grow</p>
        <h2>Your QR codes</h2>
        <p className="shop-lede">Choose what you want people to open when they scan.</p>

        <div className="partner-qr-toggle" role="group" aria-label="QR code type">
          <button
            type="button"
            className={qrMode === "shop" ? "active" : ""}
            aria-pressed={qrMode === "shop"}
            onClick={() => selectQrMode("shop")}
          >
            <strong>Shop QR</strong>
            <span>Track clicks &amp; orders</span>
          </button>
          <button
            type="button"
            className={qrMode === "referral" ? "active" : ""}
            aria-pressed={qrMode === "referral"}
            onClick={() => selectQrMode("referral")}
          >
            <strong>Referral QR</strong>
            <span>Invite a partner</span>
          </button>
          <button
            type="button"
            className={qrMode === "profile" ? "active" : ""}
            aria-pressed={qrMode === "profile"}
            onClick={() => selectQrMode("profile")}
          >
            <strong>Profile QR</strong>
            <span>Open your TikTok</span>
          </button>
        </div>

        <p className="shop-lede partner-qr-hint">{qrHint(qrMode)}</p>

        <div className="partner-link-row">
          <p className="partner-link">{link}</p>
          <button type="button" className="shop-primary" onClick={copyLink}>
            <span>{copied ? "Copied" : "Copy link"}</span>
          </button>
        </div>

        <div className="partner-qr" ref={qrRef}>
          <QRCodeCanvas
            key={qrMode}
            value={link}
            size={QR_RENDER_PX}
            level="M"
            marginSize={2}
            style={{ width: "100%", height: "auto" }}
          />
        </div>

        <div className="partner-qr-actions">
          <button type="button" className="shop-secondary" onClick={downloadQr}>
            Download PNG
          </button>
          <button type="button" className="shop-secondary" onClick={() => window.print()}>
            Preview poster
          </button>
        </div>
      </section>

      <section className="shop-order-panel partner-orders-panel">
        <div className="partner-list-tabs" role="tablist" aria-label="Dashboard lists">
          <button
            type="button"
            role="tab"
            aria-selected={listTab === "orders"}
            className={listTab === "orders" ? "active" : ""}
            onClick={() => setListTab("orders")}
          >
            Orders {data.totals.orders}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={listTab === "partners"}
            className={listTab === "partners" ? "active" : ""}
            onClick={() => setListTab("partners")}
          >
            Referred partners {data.totals.referred_partners}
          </button>
        </div>

        {listTab === "orders" ? (
          <>
            <p className="shop-kicker">Your orders</p>
            <h2>{orderTotal > 0 ? `${orderTotal} attributed` : "No orders yet"}</h2>

            {orderTotal === 0 ? (
              <div className="partner-empty-orders">
                <strong>Your first referral order will appear here.</strong>
                <p>Share your shop link or QR code to get started.</p>
              </div>
            ) : (
              <div className="partner-orders">
                {data.orders.map((order) => (
                  <OrderRow key={order.order_code} order={order} />
                ))}
              </div>
            )}

            {orderTotal > 0 ? (
              <Pager
                total={orderTotal}
                limit={orderLimit}
                offset={orderOffset}
                onPageChange={onPageChange}
              />
            ) : null}

            <p className="shop-note">
              Buyer details stay private. You only see their first name and area.
            </p>
          </>
        ) : (
          <>
            <p className="shop-kicker">Partners you referred</p>
            <h2>
              {referredPartners.length > 0
                ? `${referredPartners.length} partner${referredPartners.length === 1 ? "" : "s"}`
                : "No referred partners yet"}
            </h2>

            {referredPartners.length === 0 ? (
              <div className="partner-empty-orders">
                <strong>Share your referral QR to invite a colleague.</strong>
                <p>Partners who register with your link appear here, one level deep.</p>
              </div>
            ) : (
              <div className="partner-orders">
                {visiblePartners.map((partner) => (
                  <ReferredPartnerRow key={partner.routing_slug || partner.full_name} partner={partner} />
                ))}
              </div>
            )}

            {referredPartners.length > 0 ? (
              <Pager
                total={referredPartners.length}
                limit={partnerPageSize}
                offset={partnerOffset}
                onPageChange={(limit, offset) => {
                  setPartnerPageSize(limit);
                  setPartnerOffset(offset);
                }}
              />
            ) : null}
          </>
        )}
      </section>

      <div className="partner-print" aria-hidden="true">
        <Image src="/gutguard-logo.png" alt="" width={68} height={80} />
        <strong>{posterHeadline(qrMode)}</strong>
        <QRCodeCanvas value={link} size={QR_RENDER_PX} level="M" marginSize={2} />
        <span>{data.partner.full_name}</span>
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

function OrderRow({ order }: { order: PartnerOrder }) {
  const isPaid = order.payment_status === "paid";
  const place = [order.city, order.province].filter(Boolean).join(", ") || "Philippines";
  const via =
    order.source_type === "referred" && order.source_partner_name
      ? ` via ${order.source_partner_name}`
      : "";

  return (
    <article className="partner-order">
      <div>
        <strong>{order.buyer_first_name || "A customer"}</strong>
        <span>
          {place} - {formatDate(order.created_at)}
          {via}
        </span>
      </div>
      <span className={isPaid ? "partner-badge paid" : "partner-badge"}>{statusLabel(order)}</span>
      <b>{peso(order.total_amount)}</b>
    </article>
  );
}

function ReferredPartnerRow({ partner }: { partner: ReferredPartner }) {
  const detail = [partner.specialty, partner.practice_location].filter(Boolean).join(" - ");

  return (
    <article className="partner-order partner-referred">
      <div>
        <strong>{partner.full_name}</strong>
        <span>{detail || "GutGuard partner"}</span>
      </div>
      <span className="partner-badge">
        {partner.orders} order{partner.orders === 1 ? "" : "s"}
      </span>
      <b>{peso(partner.paid_order_value)}</b>
    </article>
  );
}

function Pager({
  total,
  limit,
  offset,
  onPageChange,
}: {
  total: number;
  limit: number;
  offset: number;
  onPageChange: (limit: number, offset: number) => void;
}) {
  const start = total === 0 ? 0 : offset + 1;
  const end = Math.min(offset + limit, total);
  const canPrev = offset > 0;
  const canNext = offset + limit < total;

  return (
    <div className="partner-pager">
      <label className="partner-pager-size">
        Rows
        <select
          value={limit}
          onChange={(event) => onPageChange(Number(event.target.value), 0)}
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
      <div className="partner-pager-nav">
        <button type="button" disabled={!canPrev} onClick={() => onPageChange(limit, Math.max(0, offset - limit))}>
          Previous
        </button>
        <span>
          {start}-{end} of {total}
        </span>
        <button type="button" disabled={!canNext} onClick={() => onPageChange(limit, offset + limit)}>
          Next
        </button>
      </div>
    </div>
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

/** Mirrors getDoctorQrUrl in the admin, so printed codes match across views. */
function getPartnerQrLink(slug: string, mode: PartnerQrMode) {
  if (!slug) {
    if (mode === "shop") return SHOP_ORIGIN;
    return `${PUBLIC_SITE_ORIGIN}/physicians/register`;
  }
  if (mode === "profile") return `${PUBLIC_SITE_ORIGIN}/dr/${encodeURIComponent(slug)}`;
  if (mode === "referral") return `${PUBLIC_SITE_ORIGIN}/physicians/register?ref=${encodeURIComponent(slug)}`;
  if (slug === "dr-grace-saraza") return `${SHOP_ORIGIN}/beehive`;
  return `${SHOP_ORIGIN}/r/${encodeURIComponent(slug)}`;
}

function qrHint(mode: PartnerQrMode) {
  if (mode === "referral") return "Send colleagues to register as a GutGuard partner.";
  if (mode === "profile") return "Send visitors directly to your TikTok profile.";
  return "Send visitors to the shop with your tracking link.";
}

function posterHeadline(mode: PartnerQrMode) {
  if (mode === "referral") return "Scan to join as a GutGuard partner";
  if (mode === "profile") return "Scan to visit my TikTok profile";
  return "Scan to order GutGuard";
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
  if (message.includes("email rate limit") || message.includes("over_email_send_rate_limit")) {
    return { field: "form", message: "Too many sign-in emails were sent. Wait a few minutes and try again." };
  }
  if (
    message.includes("rate") ||
    message.includes("too many") ||
    message.includes("429") ||
    message.includes("security purposes") ||
    /after \d+ seconds/.test(message)
  ) {
    return { field: "form", message: "Too many sign-in requests. Wait a minute and try again." };
  }
  return { field: "form", message: "We couldn’t send a code. Check your connection and try again." };
}

function getResendError(error: unknown): NonNullable<AuthError> {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("email rate limit") || message.includes("over_email_send_rate_limit")) {
    return { field: "code", message: "Too many sign-in emails were sent. Wait a few minutes and try again." };
  }
  if (
    message.includes("rate") ||
    message.includes("too many") ||
    message.includes("429") ||
    message.includes("security purposes") ||
    /after \d+ seconds/.test(message)
  ) {
    return { field: "code", message: "A new code can’t be sent yet. Wait a minute and try again." };
  }
  return { field: "code", message: "We couldn’t resend the code. Check your connection and try again." };
}
