"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { Check, Copy, Download, Lock, Printer, X } from "lucide-react";
import { Logo } from "@/components/GutguardSite";
import { PageHeader, getPartnerQrLink, useCopy, usePartner, type PartnerQrMode } from "./shared";

// Rendered large and scaled down by CSS so the download and the print sheet are both sharp.
const QR_RENDER_PX = 1024;

export default function SharePage() {
  const { dashboard } = usePartner();
  const { copied, copy } = useCopy();
  const qrRef = useRef<HTMLDivElement>(null);
  const linkRef = useRef<HTMLParagraphElement>(null);
  const posterDialogRef = useRef<HTMLDivElement>(null);
  const posterTriggerRef = useRef<HTMLButtonElement>(null);
  const [qrMode, setQrMode] = useState<PartnerQrMode>("shop");
  const [posterOpen, setPosterOpen] = useState(false);

  const isMainStore = dashboard.partner.store_type === "main";
  const isAffiliate = dashboard.partner.store_type === "affiliate";
  const isReferralLocked = isAffiliate && !dashboard.partner.referral_qr_enabled;

  const MODES: Array<{ mode: PartnerQrMode; label: string; description: string; hint: string; locked?: boolean }> = [
    {
      mode: "shop",
      label: isMainStore ? "Main Shop QR" : "Shop QR",
      description: isMainStore
        ? "Send retail customers directly to your Main Store shop link."
        : "Send customers to your GutGuard shop and attribute their orders to you.",
      hint: "Display this QR code at your clinic reception or share the direct link with patients.",
    },
    {
      mode: "referral",
      label: isMainStore ? "Partner Registration QR" : isReferralLocked ? "Referral QR (Locked)" : "Referral QR",
      description: isMainStore
        ? "Invite new partner stores to register under your Main Store umbrella."
        : isReferralLocked
        ? "Referral QR is currently locked for Affiliate stores. Unlock by getting your first Shop QR sale!"
        : "Invite another partner. Their registration and future attributed orders will be connected to you.",
      hint: isMainStore
        ? "Stores registering via this link will be automatically nested under your Main Store umbrella."
        : "Partners registering via this link will be attributed to your downline network.",
      locked: isReferralLocked,
    },
    {
      mode: "profile",
      label: "Profile QR",
      description: "Send visitors directly to your TikTok profile.",
      hint: "Direct visitors to your verified TikTok profile.",
    },
  ];

  function posterTitle(mode: PartnerQrMode) {
    if (mode === "shop") return isMainStore ? "Scan to order from Main Store" : "Scan to order GutGuard";
    if (mode === "referral") return isMainStore ? "Scan to register as a partner" : "Scan to become a GutGuard partner";
    return "Scan to visit my TikTok profile";
  }

  function PosterLogo() {
    return <div className="partner-poster-logo"><Logo h={44} /></div>;
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

      {/* Universal Tab Navigation (Outside Card) */}
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

      <section className="pp-card pp-share">
        <div className="pp-share-controls">
          {qrMode === "referral" && isReferralLocked ? (
            <div
              style={{
                background: "var(--bone-soft)",
                border: "1px solid var(--rule-soft)",
                borderRadius: "var(--r-md)",
                padding: "16px",
                color: "var(--ink)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, marginBottom: "6px" }}>
                <Lock size={18} />
                <span>Referral QR is Locked for Affiliate Stores</span>
              </div>
              <p style={{ margin: 0, fontSize: "13px", lineHeight: 1.5, color: "var(--ink-2)" }}>
                New partner accounts start in Affiliate mode with partner recruitment disabled. As soon as a customer completes a paid purchase through your <strong>Shop QR</strong>, your account will automatically promote to a <strong>Lifestyle Store</strong> and activate this Referral QR!
              </p>
            </div>
          ) : (
            <>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 4px", color: "var(--ink)" }}>{active.label}</h2>
                <p className="partner-qr-description" role="tabpanel">{active.description}</p>
              </div>

              <div className="partner-link-row" style={{ marginTop: 6 }}>
                <p className="partner-link" ref={linkRef}>{link}</p>
                <button
                  type="button"
                  className="shop-primary"
                  onClick={copyLink}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                  aria-label="Copy link to clipboard"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
              </div>
              <span className="visually-hidden" aria-live="polite">{copied ? "Link copied" : ""}</span>

              <div
                style={{
                  marginTop: 6,
                  padding: "12px 14px",
                  background: "var(--bone-soft)",
                  border: "1px solid var(--rule-soft)",
                  borderRadius: "var(--r-md)",
                  fontSize: "13px",
                  color: "var(--ink-2)",
                  lineHeight: 1.5,
                }}
              >
                {active.hint}
              </div>
            </>
          )}
        </div>

        <div className="pp-share-qr">
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
                maxWidth: 280,
              }}
            >
              <Lock size={40} color="var(--ink-3)" style={{ marginBottom: "12px" }} />
              <strong style={{ color: "var(--ink-2)" }}>Referral QR Inactive</strong>
              <p style={{ margin: "8px 0 0", fontSize: "13px", color: "var(--ink-3)", maxWidth: "260px" }}>
                Make your 1st paid shop sale to automatically unlock!
              </p>
            </div>
          ) : (
            <>
              <div className="partner-qr" ref={qrRef}>
                <QRCodeSVG key={qrMode} value={link} size={QR_RENDER_PX} level="M" marginSize={2} style={{ width: "100%", height: "auto" }} />
                <QRCodeCanvas className="partner-qr-download-canvas" value={link} size={QR_RENDER_PX} level="M" marginSize={4} />
              </div>
              <div className="partner-qr-actions" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, width: "100%", maxWidth: 280 }}>
                <button
                  type="button"
                  className="shop-secondary"
                  onClick={downloadQr}
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 38, padding: "8px 10px" }}
                >
                  <Download size={14} />
                  <span>Download PNG</span>
                </button>
                <button
                  ref={posterTriggerRef}
                  type="button"
                  className="shop-secondary"
                  onClick={() => setPosterOpen(true)}
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 38, padding: "8px 10px" }}
                >
                  <Printer size={14} />
                  <span>Preview poster</span>
                </button>
              </div>
            </>
          )}
        </div>
      </section>

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
              <button type="button" className="shop-secondary" onClick={() => { setPosterOpen(false); requestAnimationFrame(() => posterTriggerRef.current?.focus()); }}>Close</button>
              <button type="button" className="shop-primary" style={{ display: "inline-flex", alignItems: "center", gap: 6 }} onClick={() => window.print()}>
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
