"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { QRCodeCanvas } from "qrcode.react";
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

type View = "checking" | "email" | "code" | "dashboard";

export default function PartnerPortal() {
  const [view, setView] = useState<View>("checking");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [data, setData] = useState<PartnerDashboard | null>(null);

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
        } catch (caught) {
          if (cancelled) return;
          await signOutPartner();
          setError(toMessage(caught, "Your dashboard could not be loaded."));
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

  async function requestCode(event: React.FormEvent) {
    event.preventDefault();
    setIsBusy(true);
    setError("");

    try {
      await sendPartnerOtp(email);
      setView("code");
    } catch (caught) {
      setError(toMessage(caught, "That code could not be sent. Try again in a moment."));
    } finally {
      setIsBusy(false);
    }
  }

  async function submitCode(event: React.FormEvent) {
    event.preventDefault();
    setIsBusy(true);
    setError("");

    try {
      await verifyPartnerOtp(email, code);
      await load();
    } catch (caught) {
      // Covers both a wrong code and a verified address with no partner row. Signing out
      // on the second case stops a non-partner account from sitting in a broken half-state.
      await signOutPartner();
      setError(toMessage(caught, "That code did not work. Request a new one."));
      setCode("");
    } finally {
      setIsBusy(false);
    }
  }

  async function signOut() {
    await signOutPartner();
    setData(null);
    setCode("");
    setView("email");
  }

  if (view === "checking") {
    return (
      <main className="shop-shell">
        <PartnerNav />
        <section className="shop-order-panel" aria-busy="true">
          <p className="shop-kicker">Loading</p>
          <h1>Opening your dashboard</h1>
        </section>
      </main>
    );
  }

  if (view === "dashboard" && data) {
    return <Dashboard data={data} onSignOut={signOut} />;
  }

  return (
    <main className="shop-shell">
      <PartnerNav />
      <section className="shop-order-panel">
        <p className="shop-kicker">Partner sign in</p>
        <h1>{view === "code" ? "Enter your code" : "Track your referrals"}</h1>
        <p className="shop-lede">
          {view === "code"
            ? `We sent a 6-digit code to ${email}. It expires in a few minutes.`
            : "Sign in with the email address you registered with. We will send you a code - no password needed."}
        </p>

        {view === "code" ? (
          <form className="partner-form" onSubmit={submitCode}>
            <label htmlFor="partner-code">6-digit code</label>
            <input
              id="partner-code"
              name="one-time-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              required
            />
            {error ? <div className="shop-error">{error}</div> : null}
            <button type="submit" className="shop-primary" disabled={isBusy || code.length < 6}>
              <span>{isBusy ? "Checking" : "Sign in"}</span>
            </button>
            <button
              type="button"
              className="shop-secondary"
              onClick={() => {
                setView("email");
                setCode("");
                setError("");
              }}
            >
              Use a different email
            </button>
          </form>
        ) : (
          <form className="partner-form" onSubmit={requestCode}>
            <label htmlFor="partner-email">Email address</label>
            <input
              id="partner-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@clinic.ph"
              required
            />
            {error ? <div className="shop-error">{error}</div> : null}
            <button type="submit" className="shop-primary" disabled={isBusy || !email.trim()}>
              <span>{isBusy ? "Sending your code" : "Send me a code"}</span>
            </button>
            <p className="shop-note">
              Not registered yet? <Link href="/">Join the partner programme</Link>.
            </p>
          </form>
        )}
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
    <nav className="shop-nav" aria-label="Partner header">
      <Link className="shop-brand" href="/">
        <Image src="/gutguard-logo.png" alt="GutGuard" width={34} height={40} priority />
        <span>GutGuard</span>
      </Link>
      {onSignOut ? (
        <button type="button" className="shop-nav-link" onClick={onSignOut}>
          Sign out
        </button>
      ) : (
        <Link className="shop-nav-link" href="/shop">
          Visit the shop
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

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}
