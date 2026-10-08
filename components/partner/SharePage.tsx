"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Lock,
  Printer,
  X,
} from "lucide-react";
import { Logo } from "@/components/GutguardSite";
import {
  PageHeader,
  StatTile,
  getPartnerQrLink,
  useCopy,
  usePartner,
  type PartnerQrMode,
} from "./shared";

// Rendered large and scaled down by CSS so the download and the print sheet are both sharp.
const QR_RENDER_PX = 1024;

function PosterLogo() {
  return <div className="partner-poster-logo"><Logo h={44} /></div>;
}

export default function SharePage() {
  const { dashboard } = usePartner();
  const { copied, copy } = useCopy();
  const { copied: msgCopied, copy: copyMsg } = useCopy();
  const qrRef = useRef<HTMLDivElement>(null);
  const linkRef = useRef<HTMLParagraphElement>(null);
  const posterDialogRef = useRef<HTMLDivElement>(null);
  const posterTriggerRef = useRef<HTMLButtonElement>(null);
  const [qrMode, setQrMode] = useState<PartnerQrMode>("shop");
  const [posterOpen, setPosterOpen] = useState(false);

  const isMainStore = dashboard.partner.store_type === "main";
  const isAffiliate = dashboard.partner.store_type === "affiliate";
  const isReferralLocked = isAffiliate && !dashboard.partner.referral_qr_enabled;

  const MODES: Array<{
    mode: PartnerQrMode;
    label: string;
    linkTitle: string;
    description: string;
    tag: string;
    tagClass: string;
    hint: string;
    locked?: boolean;
    presetMessage: string;
  }> = [
    {
      mode: "shop",
      label: isMainStore ? "Main Shop QR" : "Shop QR",
      linkTitle: isMainStore ? "Main shop link" : "Direct shop link",
      description: isMainStore
        ? "Send retail customers directly to your Main Store shop link. All completed orders will be tracked directly to your store."
        : "Send customers directly to your verified GutGuard shop. Orders placed through this link attribute commission points to your account.",
      tag: isMainStore ? "Main Store direct" : "Commission attributed",
      tagClass: "pp-tag-blue",
      hint: "Display this QR code at your clinic reception or share the direct link with patients during consultations.",
      presetMessage: `Hi! You can order your prescribed GutGuard synbiotics online through my verified clinic link: ${getPartnerQrLink(dashboard.partner, "shop")}`,
    },
    {
      mode: "referral",
      label: isMainStore ? "Partner Registration QR" : isReferralLocked ? "Referral QR (Locked)" : "Referral QR",
      linkTitle: isMainStore ? "Partner registration link" : "Doctor referral link",
      description: isMainStore
        ? "Invite new physician partners and clinics to register under your Main Store umbrella network."
        : isReferralLocked
        ? "Referral QR is currently locked for Affiliate stores. Unlock by completing your first paid Shop order!"
        : "Invite fellow physicians to join the GutGuard partner network. Their registrations and future attributed orders will connect to your network.",
      tag: isMainStore ? "Umbrella network" : isReferralLocked ? "Locked" : "Downline network",
      tagClass: isReferralLocked ? "pp-tag-bone" : "pp-tag-blue",
      hint: isMainStore
        ? "Stores registering via this link will be automatically nested under your Main Store umbrella."
        : "Partners registering via this link will be attributed to your downline network.",
      locked: isReferralLocked,
      presetMessage: isMainStore
        ? `Hello Doctor! Join our GutGuard physician network and register your clinic store under our umbrella: ${getPartnerQrLink(dashboard.partner, "referral")}`
        : `Hello Doctor! Register your verified physician account on GutGuard to prescribe and earn partner points: ${getPartnerQrLink(dashboard.partner, "referral")}`,
    },
    {
      mode: "profile",
      label: "Profile QR",
      linkTitle: "TikTok profile link",
      description: "Send visitors directly to your verified TikTok profile and physician educational content.",
      tag: "Public profile",
      tagClass: "pp-tag-bone",
      hint: "Direct visitors to your verified TikTok profile and educational videos.",
      presetMessage: `Check out my verified GutGuard doctor profile and gut health educational content: ${getPartnerQrLink(dashboard.partner, "profile")}`,
    },
  ];

  function posterTitle(mode: PartnerQrMode) {
    if (mode === "shop") return isMainStore ? "Scan to order from Main Store" : "Scan to order GutGuard";
    if (mode === "referral") return isMainStore ? "Scan to register as a partner" : "Scan to become a GutGuard partner";
    return "Scan to visit my TikTok profile";
  }

  const link = getPartnerQrLink(dashboard.partner, qrMode);
  const active = MODES.find((item) => item.mode === qrMode)!;

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
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = MODES[(MODES.findIndex((item) => item.mode === mode) + delta + MODES.length) % MODES.length].mode;
    setQrMode(next);
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-qr-mode="${next}"]`)?.focus());
  }

  async function copyLink() {
    if (await copy(link)) return;
    const selection = window.getSelection();
    if (selection && linkRef.current) {
      const range = document.createRange();
      range.selectNodeContents(linkRef.current);
      selection.removeAllRanges();
      selection.addRange(range);
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
    <>
      <PageHeader kicker="Share & grow" title="Your QR codes" />

      {/* Top Summary Metrics Strip */}
      <section className="pp-stats" aria-label="Sharing performance summary">
        <StatTile
          label="30-day link clicks"
          value={dashboard.clicks.last_30_days.toLocaleString()}
          note="Traffic from your shared links"
        />
        <StatTile
          label="All-time link clicks"
          value={dashboard.clicks.total.toLocaleString()}
          note="Total visits & QR scans"
        />
        <StatTile
          label="Attributed orders"
          value={dashboard.totals.orders.toLocaleString()}
          note="Orders placed through your links"
        />
        <StatTile
          label="Attribution mode"
          value={isMainStore ? "Main Store" : isAffiliate ? "Affiliate" : "Lifestyle"}
          note="Active commission attribution"
        />
      </section>

      {/* Universal Tab Navigation */}
      <div className="pp-seg" role="tablist" aria-label="QR code mode">
        {MODES.map((item) => (
          <button
            key={item.mode}
            type="button"
            role="tab"
            data-qr-mode={item.mode}
            className={qrMode === item.mode ? "active" : ""}
            aria-selected={qrMode === item.mode}
            tabIndex={qrMode === item.mode ? 0 : -1}
            onKeyDown={(event) => moveQrTab(event, item.mode)}
            onClick={() => setQrMode(item.mode)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Balanced Dual-Card Layout */}
      <div className="pp-grid">
        {/* Card 1: Direct Link & Digital Sharing */}
        <article className="pp-card" style={{ display: "grid", gap: "16px", alignContent: "start" }}>
          <div className="pp-card-head">
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--ink)" }}>{active.linkTitle}</h2>
              <span className={`pp-tag ${active.tagClass}`}>{active.tag}</span>
            </div>
          </div>

          {qrMode === "referral" && isReferralLocked ? (
            <div
              style={{
                background: "var(--bone-soft)",
                border: "1px solid var(--rule-soft)",
                borderRadius: "var(--r-md)",
                padding: "20px",
                display: "grid",
                gap: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, color: "var(--ink)" }}>
                <Lock size={18} color="var(--ink-2)" />
                <span>Referral Program Locked for Affiliate Stores</span>
              </div>
              <p style={{ margin: 0, fontSize: "13px", lineHeight: 1.5, color: "var(--ink-2)" }}>
                New partner accounts start in Affiliate mode with partner recruitment disabled. As soon as a customer completes a paid purchase through your <strong>Shop QR</strong>, your account will automatically promote to a <strong>Lifestyle Store</strong> and activate this Referral QR!
              </p>
              <button
                type="button"
                className="shop-secondary"
                onClick={() => setQrMode("shop")}
                style={{
                  marginTop: "4px",
                  justifySelf: "start",
                  textTransform: "none",
                  letterSpacing: "normal",
                  fontWeight: 600,
                  fontSize: "13px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 14px",
                  borderRadius: "var(--r-sm)",
                }}
              >
                Switch to Shop QR
              </button>
            </div>
          ) : (
            <>
              {/* Integrated Link Input Group */}
              <div className="pp-share-link-group">
                <div className="pp-share-url-container">
                  <p className="pp-share-url-text" ref={linkRef}>
                    {link}
                  </p>
                </div>
                <div className="pp-share-actions-row pp-share-inline-actions">
                  <button
                    type="button"
                    className="shop-primary"
                    onClick={copyLink}
                    aria-label="Copy link to clipboard"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copied ? "Copied" : "Copy link"}</span>
                  </button>
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shop-secondary"
                    title="Open link in new tab"
                    aria-label="Open link in new tab"
                  >
                    <ExternalLink size={14} />
                    <span>Open link</span>
                  </a>
                </div>
              </div>
              <span className="visually-hidden" aria-live="polite">{copied ? "Link copied" : ""}</span>

              {/* Quick Prescription / Share Recommendation Template */}
              <div className="pp-share-template-box">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-3)" }}>
                    {qrMode === "referral" ? "Invitation message" : qrMode === "profile" ? "Profile message" : "Prescription message"}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyMsg(active.presetMessage)}
                    className="pp-share-copy-msg-btn"
                    title="Copy message template"
                  >
                    {msgCopied ? <Check size={12} /> : <Copy size={12} />}
                    <span>{msgCopied ? "Copied" : "Copy text"}</span>
                  </button>
                </div>
                <p>
                  &ldquo;{active.presetMessage}&rdquo;
                </p>
              </div>
            </>
          )}
        </article>

        {/* Card 2: Scannable QR & Print Assets */}
        <article className="pp-card" style={{ display: "grid", gap: "16px", alignContent: "start" }}>
          <div className="pp-card-head">
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--ink)" }}>Scannable QR code</h2>
            <span className="pp-tag pp-tag-bone">1024px PNG</span>
          </div>

          {qrMode === "referral" && isReferralLocked ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "48px 24px",
                background: "var(--bone-soft)",
                borderRadius: "var(--r-md)",
                border: "1px dashed var(--rule)",
                textAlign: "center",
                minHeight: "260px",
                width: "100%",
              }}
            >
              <Lock size={36} color="var(--ink-3)" style={{ marginBottom: "12px" }} />
              <strong style={{ color: "var(--ink-2)", fontSize: "14px" }}>Referral QR Inactive</strong>
              <p style={{ margin: "8px 0 0", fontSize: "12px", color: "var(--ink-3)", maxWidth: "240px", lineHeight: 1.4 }}>
                Make your 1st paid shop sale to automatically unlock!
              </p>
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  background: "var(--bone-soft)",
                  border: "1px solid var(--rule-soft)",
                  borderRadius: "var(--r-md)",
                  padding: "20px 16px 14px",
                }}
              >
                <div
                  ref={qrRef}
                  style={{
                    width: "min(100%, 220px)",
                    aspectRatio: "1",
                    background: "#ffffff",
                    padding: "12px",
                    borderRadius: "var(--r-sm)",
                    border: "1px solid var(--rule-soft)",
                    boxShadow: "0 2px 8px rgba(15, 15, 24, 0.04)",
                  }}
                >
                  <QRCodeSVG
                    key={qrMode}
                    value={link}
                    size={QR_RENDER_PX}
                    level="M"
                    marginSize={2}
                    style={{ width: "100%", height: "100%", display: "block" }}
                  />
                  <QRCodeCanvas className="partner-qr-download-canvas" value={link} size={QR_RENDER_PX} level="M" marginSize={4} />
                </div>
                <p style={{ margin: "10px 0 0", fontSize: "11px", color: "var(--ink-3)", textAlign: "center" }}>
                  Point phone camera at screen to test destination
                </p>
              </div>

              <div className="pp-share-actions-row">
                <button
                  type="button"
                  className="shop-secondary"
                  onClick={downloadQr}
                >
                  <Download size={14} />
                  <span>Download PNG</span>
                </button>
                <button
                  ref={posterTriggerRef}
                  type="button"
                  className="shop-secondary"
                  onClick={() => setPosterOpen(true)}
                >
                  <Printer size={14} />
                  <span>Preview poster</span>
                </button>
              </div>
            </>
          )}
        </article>
      </div>

      {posterOpen ? (
        <div className="partner-poster-modal" role="dialog" aria-modal="true" aria-labelledby="poster-title">
          <div className="partner-poster-dialog" ref={posterDialogRef} tabIndex={-1}>
            <div className="partner-poster-header">
              <div><p className="shop-kicker">Print preview</p><h2 id="poster-title">A4 QR poster</h2></div>
              <button type="button" className="partner-poster-close" aria-label="Close poster preview" onClick={() => setPosterOpen(false)}><X aria-hidden="true" /></button>
            </div>
            <div className="partner-poster-preview" aria-label={`${posterTitle(qrMode)} poster preview`}>
              <PosterLogo />
              <strong>{posterTitle(qrMode)}</strong>
              <div className="partner-poster-qr"><QRCodeSVG value={link} size={QR_RENDER_PX} level="M" marginSize={4} style={{ width: "100%", height: "auto" }} /></div>
              <span>{dashboard.partner.full_name}</span><small>{link}</small>
            </div>
            <div className="partner-poster-actions">
              <button
                type="button"
                className="shop-secondary"
                style={{ textTransform: "none", letterSpacing: "normal", fontWeight: 600, fontSize: "13px" }}
                onClick={() => { setPosterOpen(false); requestAnimationFrame(() => posterTriggerRef.current?.focus()); }}
              >
                Close
              </button>
              <button
                type="button"
                className="shop-primary"
                style={{ textTransform: "none", letterSpacing: "normal", fontWeight: 600, fontSize: "13px", display: "inline-flex", alignItems: "center", gap: 6 }}
                onClick={() => window.print()}
              >
                <Printer size={14} />
                <span>Print poster</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Screen-hidden, print-only. Kept in the DOM so window.print() needs no new page. */}
      <div className="partner-print" aria-hidden="true">
        <PosterLogo />
        <strong>{posterTitle(qrMode)}</strong>
        <QRCodeSVG value={link} size={QR_RENDER_PX} level="M" marginSize={4} />
        <span>{dashboard.partner.full_name}</span>
        <small>{link}</small>
      </div>
    </>
  );
}
