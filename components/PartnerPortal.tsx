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
} from "@/lib/api";

const SHOP_ORIGIN = (process.env.NEXT_PUBLIC_SHOP_URL ?? "https://shop.gutguard.ph").replace(/\/$/, "");
const PUBLIC_SITE_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://partners.gutguard.ph").replace(/\/$/, "");

// Rendered large and scaled down by CSS so the download and the print sheet are both
// sharp. The on-screen size is set in globals.css, not here.
const QR_RENDER_PX = 1024;

type PartnerQrMode = "shop" | "profile";

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

function Dashboard({ data, onSignOut }: { data: PartnerDashboard; onSignOut: () => void }) {
  const qrRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [qrMode, setQrMode] = useState<PartnerQrMode>("shop");

  const link = getPartnerQrLink(data.partner.routing_slug, qrMode);
  const isShopQr = qrMode === "shop";
  const conversion = data.clicks.total > 0 ? (data.totals.orders / data.clicks.total) * 100 : 0;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is blocked on insecure origins and in some in-app browsers. The link is
      // shown in full above the button, so there is still a way through.
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

  return (
    <main className="shop-shell partner-dashboard-shell">
      <PartnerNav onSignOut={onSignOut} />

      <section className="shop-order-panel">
        <p className="shop-kicker">Partner dashboard</p>
        <h1>{data.partner.full_name}</h1>
        <p className="shop-lede">
          Every order placed within 30 days of someone using your link is credited to you.
        </p>

        <div className="partner-stats">
          <Stat label="Link clicks" value={String(data.clicks.total)} note={`${data.clicks.last_30_days} in the last 30 days`} />
          <Stat label="Orders" value={String(data.totals.orders)} note={`${data.totals.paid_orders} paid`} />
          <Stat
            label="Conversion"
            value={data.clicks.total > 0 ? `${conversion.toFixed(1)}%` : "--"}
            note={data.clicks.total > 0 ? "orders per click" : "no clicks yet"}
          />
          {/* Order value, not commission - the wording has to keep saying so. */}
          <Stat label="Paid order value" value={peso(data.totals.paid_amount)} note="total spent by your referrals" />
        </div>
      </section>

      <div className="partner-dashboard-grid">
        <section className="shop-order-panel partner-share-panel">
          <p className="shop-kicker">Share &amp; grow</p>
          <h2>Your QR codes</h2>
          <p className="shop-lede">
            Share the shop QR for tracked orders, or the profile QR for your TikTok page.
          </p>

          <div className="partner-qr-toggle" role="group" aria-label="QR code type">
            <button
              type="button"
              className={isShopQr ? "active" : ""}
              aria-pressed={isShopQr}
              onClick={() => {
                setQrMode("shop");
                setCopied(false);
              }}
            >
              <strong>Shop QR</strong>
              <span>Track clicks &amp; orders</span>
            </button>
            <button
              type="button"
              className={!isShopQr ? "active" : ""}
              aria-pressed={!isShopQr}
              onClick={() => {
                setQrMode("profile");
                setCopied(false);
              }}
            >
              <strong>Profile QR</strong>
              <span>Open your TikTok</span>
            </button>
          </div>

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
              Print poster
            </button>
          </div>
        </section>

        <section className="shop-order-panel partner-orders-panel">
          <p className="shop-kicker">Your orders</p>
          <h2>{data.orders.length > 0 ? `${data.orders.length} attributed` : "No orders yet"}</h2>

          {data.orders.length === 0 ? (
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

          <p className="shop-note">
            Buyer details stay private. You only see their first name and area.
          </p>
        </section>
      </div>

      {/* Screen-hidden, print-only. Kept in the DOM so window.print() needs no new page. */}
      <div className="partner-print" aria-hidden="true">
        <Image src="/gutguard-logo.png" alt="" width={68} height={80} />
        <strong>{isShopQr ? "Scan to order GutGuard" : "Scan to visit my TikTok profile"}</strong>
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

  return (
    <article className="partner-order">
      <div>
        <strong>{order.buyer_first_name || "A customer"}</strong>
        <span>
          {[order.city, order.province].filter(Boolean).join(", ") || "Philippines"} - {formatDate(order.created_at)}
        </span>
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
