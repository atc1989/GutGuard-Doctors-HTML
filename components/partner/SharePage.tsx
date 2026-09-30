"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { X } from "lucide-react";
import { Logo } from "@/components/GutguardSite";
import { PageHeader, getPartnerQrLink, useCopy, usePartner, type PartnerQrMode } from "./shared";

// Rendered large and scaled down by CSS so the download and the print sheet are both sharp.
const QR_RENDER_PX = 1024;

const MODES: Array<{ mode: PartnerQrMode; label: string; description: string }> = [
  { mode: "shop", label: "Shop QR", description: "Send customers to your GutGuard shop and attribute their orders to you." },
  { mode: "referral", label: "Referral QR", description: "Invite another partner. Their registration and future attributed orders will be connected to you." },
  { mode: "profile", label: "Profile QR", description: "Send visitors directly to your TikTok profile." },
];

function posterTitle(mode: PartnerQrMode) {
  if (mode === "shop") return "Scan to order GutGuard";
  if (mode === "referral") return "Scan to become a GutGuard partner";
  return "Scan to visit my TikTok profile";
}

function PosterLogo() {
  return <div className="partner-poster-logo"><Logo h={44} /></div>;
}

export default function SharePage() {
  const { dashboard } = usePartner();
  const { copied, copy } = useCopy();
  const qrRef = useRef<HTMLDivElement>(null);
  const linkRef = useRef<HTMLParagraphElement>(null);
  const posterDialogRef = useRef<HTMLDivElement>(null);
  const posterTriggerRef = useRef<HTMLButtonElement>(null);
  const [qrMode, setQrMode] = useState<PartnerQrMode>("shop");
  const [posterOpen, setPosterOpen] = useState(false);

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
    // The link is shown in full above the button, so select it as the fallback.
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
      <div className="pp-screen">
        <PageHeader kicker="Share & grow" title="Your QR codes" lede="Choose what you want people to open when they scan." />

        <section className="pp-card pp-share">
          <div className="pp-share-controls">
            <div className="partner-qr-toggle" role="tablist" aria-label="QR code type">
              {MODES.map((item) => (
                <button
                  key={item.mode} type="button" role="tab" data-qr-mode={item.mode}
                  className={qrMode === item.mode ? "active" : ""} aria-selected={qrMode === item.mode}
                  tabIndex={qrMode === item.mode ? 0 : -1} onKeyDown={(event) => moveQrTab(event, item.mode)}
                  onClick={() => setQrMode(item.mode)}
                >
                  <strong>{item.label}</strong>
                </button>
              ))}
            </div>
            <p className="partner-qr-description" role="tabpanel">{active.description}</p>
            <p className="partner-link" ref={linkRef}>{link}</p>
            <button type="button" className="shop-primary pp-block-btn" onClick={copyLink}><span>{copied ? "Copied" : "Copy link"}</span></button>
            <span className="visually-hidden" aria-live="polite">{copied ? "Link copied" : ""}</span>
          </div>

          <div className="pp-share-qr">
            <div className="partner-qr" ref={qrRef}>
              <QRCodeSVG key={qrMode} value={link} size={QR_RENDER_PX} level="M" marginSize={2} style={{ width: "100%", height: "auto" }} />
              <QRCodeCanvas className="partner-qr-download-canvas" value={link} size={QR_RENDER_PX} level="M" marginSize={4} />
            </div>
            <div className="partner-qr-actions">
              <button type="button" className="shop-secondary" onClick={downloadQr}>Download PNG</button>
              <button ref={posterTriggerRef} type="button" className="shop-secondary" onClick={() => setPosterOpen(true)}>Preview poster</button>
            </div>
          </div>
        </section>
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
              <button type="button" className="shop-secondary" onClick={() => { setPosterOpen(false); requestAnimationFrame(() => posterTriggerRef.current?.focus()); }}>Close</button>
              <button type="button" className="shop-primary" onClick={() => window.print()}>Print poster</button>
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
