"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { getPartnerQrLink } from "@/components/partner/shared";
import type { AdminDoctorRegistration } from "@/lib/api";

type PendingPartner = { id: string; partner_code: number; routing_slug: string; created_at?: string };

const QR_RENDER_PX = 1024;
const day = (value: string) =>
  new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));

/**
 * Staff mint a blank partner: one click -> a code and its two QRs. When the doctor gets in
 * touch, admin fills in their details (with an email, so they can sign in) on Doctor Partners.
 */
export default function AdminCodesPage() {
  const [loaded, setLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [pending, setPending] = useState<PendingPartner[]>([]);
  const [selected, setSelected] = useState<PendingPartner | null>(null);
  const [error, setError] = useState<string | null>(null);

  // AdminShell only renders this page once the admin session is valid.
  useEffect(() => {
    load();
  }, []);

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/doctors");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not load partners.");
      // Pending == no email yet: it cannot sign in until admin fills the details in.
      setPending(
        (data.doctors as AdminDoctorRegistration[])
          .filter((doctor) => !doctor.email && doctor.partner_code)
          .map((doctor) => ({
            id: doctor.id,
            partner_code: doctor.partner_code!,
            routing_slug: doctor.routing_slug,
            created_at: doctor.created_at,
          })),
      );
      setLoaded(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load partners.");
    } finally {
      setIsLoading(false);
    }
  }

  async function generate() {
    setIsCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/codes", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not create a code.");
      const created: PendingPartner = { ...data.partner, created_at: new Date().toISOString() };
      setPending((current) => [created, ...current]);
      setSelected(created);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create a code.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="admin-wheel-shell admin-shop-orders-shell">
      <AdminPageHeader
        kicker="Partner network"
        title="Partner Codes"
        description="Make a code and its shop and join QRs for a doctor who hasn't registered yet."
      >
        <button type="button" className="admin-overview-action-btn" onClick={load} disabled={isLoading}>
          {isLoading ? "Loading" : "Refresh"}
        </button>
      </AdminPageHeader>

      {error ? <div className="admin-wheel-alert error">{error}</div> : null}

      {loaded ? (
        <section className="admin-wheel-panel">
          <div className="admin-wheel-panel-head">
            <div>
              <p className="admin-wheel-kicker">New partner</p>
              <h2>Generate a code</h2>
            </div>
            <p>
              Creates a blank partner with the next code. Sales and sign-ups through its QRs are credited from the first
              scan. To let them sign in, fill in their details and email on Doctor Partners.
            </p>
          </div>

          <div className="admin-codes-actions">
            <button type="button" onClick={generate} disabled={isCreating}>
              {isCreating ? "Creating…" : "Generate code"}
            </button>
          </div>

          {selected ? <CodeQrs partner={selected} /> : null}

          <h3 className="admin-codes-list-title">Pending codes ({pending.length})</h3>
          {pending.length === 0 ? (
            <p className="admin-wheel-empty">No pending codes.</p>
          ) : (
            <ul className="admin-codes-list">
              {pending.map((partner) => (
                <li key={partner.id}>
                  <strong>#{partner.partner_code}</strong>
                  <span>{partner.created_at ? day(partner.created_at) : ""}</span>
                  <button
                    type="button"
                    aria-pressed={selected?.id === partner.id}
                    onClick={() => setSelected(partner)}
                  >
                    {selected?.id === partner.id ? "Showing" : "Show QRs"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}

function CodeQrs({ partner }: { partner: PendingPartner }) {
  return (
    <div className="admin-codes-result">
      <p className="admin-codes-code" aria-live="polite">
        <span>Partner code</span>
        <strong>{partner.partner_code}</strong>
      </p>
      <div className="admin-codes-qrs">
        <CodeQr partner={partner} mode="shop" label="Shop" />
        <CodeQr partner={partner} mode="referral" label="Join" />
      </div>
    </div>
  );
}

function CodeQr({ partner, mode, label }: { partner: PendingPartner; mode: "shop" | "referral"; label: string }) {
  const link = getPartnerQrLink(partner, mode);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  function download() {
    const canvas = canvasRef.current?.querySelector("canvas");
    if (!canvas) return;
    const anchor = document.createElement("a");
    anchor.href = canvas.toDataURL("image/png");
    anchor.download = `gutguard-${label.toLowerCase()}-${partner.partner_code}.png`;
    anchor.click();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked: the link is on screen to copy by hand.
    }
  }

  return (
    <figure className="admin-codes-qr">
      <figcaption>{label}</figcaption>
      <QRCodeSVG value={link} size={QR_RENDER_PX} level="M" marginSize={4} style={{ width: "100%", height: "auto" }} />
      <div ref={canvasRef} hidden>
        <QRCodeCanvas value={link} size={QR_RENDER_PX} level="M" marginSize={4} />
      </div>
      <code>{link}</code>
      <div className="admin-codes-qr-actions">
        <button type="button" onClick={copy}>{copied ? "Copied" : "Copy link"}</button>
        <button type="button" onClick={download}>Download PNG</button>
      </div>
    </figure>
  );
}
