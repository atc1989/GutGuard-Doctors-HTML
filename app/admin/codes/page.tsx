"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { QR_LOGO_PROPS, getPartnerQrLink, useCopy } from "@/components/partner/shared";
import type { AdminDoctorRegistration } from "@/lib/api";

type PendingPartner = {
  id: string;
  partner_code: number;
  routing_slug: string;
  created_at?: string;
  code_note?: string;
  code_source?: string;
  code_label?: string;
};

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
  // Highest code in use; the confirm dialog previews the next one.
  const [maxCode, setMaxCode] = useState(0);
  const [confirming, setConfirming] = useState(false);

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
      const doctors = data.doctors as AdminDoctorRegistration[];
      setMaxCode(Math.max(0, ...doctors.map((doctor) => doctor.partner_code ?? 0)));
      // Pending == no email yet: it cannot sign in until admin fills the details in.
      setPending(
        doctors
          .filter((doctor) => !doctor.email && doctor.partner_code)
          .map((doctor) => ({
            id: doctor.id,
            partner_code: doctor.partner_code!,
            routing_slug: doctor.routing_slug,
            created_at: doctor.created_at,
            code_note: doctor.code_note,
            code_source: doctor.code_source,
            code_label: doctor.code_label,
          })),
      );
      setLoaded(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load partners.");
    } finally {
      setIsLoading(false);
    }
  }

  async function generate(note: string, source: string, label: string) {
    setIsCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note, source, label }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not create a code.");
      const { label_saved: labelSaved, ...partner } = data.partner;
      const created: PendingPartner = {
        ...partner,
        created_at: new Date().toISOString(),
        code_note: note.trim(),
        code_source: source.trim(),
        code_label: labelSaved ? label.trim() : "",
      };
      if (label.trim() && !labelSaved) {
        setError(`Code #${created.partner_code} was created without its label: the database doesn't support labels yet.`);
      }
      setPending((current) => [created, ...current]);
      setSelected(created);
      setMaxCode((current) => Math.max(current, created.partner_code));
      setConfirming(false);
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
            <button type="button" onClick={() => setConfirming(true)} disabled={isCreating}>
              Generate code
            </button>
          </div>

          {selected ? <CodeQrs partner={selected} /> : null}

          {confirming ? (
            <ConfirmGenerate
              // ponytail: a preview, not a reservation. Two admins generating at once can each
              // see the same number; the created code is the one shown after.
              nextCode={maxCode + 1}
              isCreating={isCreating}
              onCancel={() => setConfirming(false)}
              onConfirm={generate}
            />
          ) : null}

          <h3 className="admin-codes-list-title">Pending codes ({pending.length})</h3>
          {pending.length === 0 ? (
            <p className="admin-wheel-empty">No pending codes.</p>
          ) : (
            <ul className="admin-codes-list">
              {pending.map((partner) => (
                <li key={partner.id}>
                  <strong>#{partner.partner_code}</strong>
                  <span>
                    {partner.created_at ? day(partner.created_at) : ""}
                    {partner.code_label ? <> · <em>{partner.code_label}</em></> : null}
                    {partner.code_note ? <> · {partner.code_note}</> : null}
                    {partner.code_source ? <small>Source: {partner.code_source}</small> : null}
                  </span>
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

function ConfirmGenerate({
  nextCode,
  isCreating,
  onCancel,
  onConfirm,
}: {
  nextCode: number;
  isCreating: boolean;
  onCancel: () => void;
  onConfirm: (note: string, source: string, label: string) => void;
}) {
  const preview = { id: "preview", partner_code: nextCode, routing_slug: `partner-${nextCode}` };
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const [source, setSource] = useState("");

  return (
    <div
      className="admin-modal-backdrop"
      role="presentation"
      onKeyDown={(event) => {
        if (event.key === "Escape" && !isCreating) onCancel();
      }}
    >
      <section className="admin-modal admin-codes-confirm" role="dialog" aria-modal="true" aria-labelledby="codes-confirm-title">
        <div className="admin-modal-head">
          <div>
            <p className="admin-wheel-kicker">Confirm new partner</p>
            <h2 id="codes-confirm-title">Create account #{nextCode}?</h2>
          </div>
        </div>
        <div className="admin-modal-body">
          <p>
            This creates a blank partner account. Sales and sign-ups through its QRs are credited to it from the first
            scan. It stays <strong>Pending</strong> until you add the doctor&apos;s details and email on Doctor Partners.
          </p>
          <dl className="admin-confirm-summary">
            <div>
              <dt>Account no.</dt>
              <dd>#{nextCode}</dd>
            </div>
            <div>
              <dt>Shop link</dt>
              <dd>{getPartnerQrLink(preview, "shop")}</dd>
            </div>
            <div>
              <dt>Join link</dt>
              <dd>{getPartnerQrLink(preview, "referral")}</dd>
            </div>
          </dl>
          <label className="admin-codes-field">
            <span>Label (optional, shown publicly on the join page)</span>
            <input
              type="text"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              maxLength={40}
              autoFocus
              placeholder="e.g. GSC"
            />
            <small>Doctors who join through this QR see &ldquo;Ref number #{nextCode}{label.trim() ? ` · ${label.trim()}` : ""}&rdquo;.</small>
          </label>
          <label className="admin-codes-field">
            <span>Description (optional, admin only)</span>
            <input
              type="text"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={200}
              placeholder="e.g. Dr. Cruz, Makati clinic"
            />
          </label>
          <label className="admin-codes-field">
            <span>Where will this QR be used? (optional)</span>
            <input
              type="text"
              value={source}
              onChange={(event) => setSource(event.target.value)}
              maxLength={120}
              placeholder="e.g. Manila Med Expo booth"
            />
            <small>Doctors who join through this QR see it already filled in as &ldquo;Where did you find us?&rdquo;</small>
          </label>
        </div>
        <div className="admin-modal-actions">
          <button type="button" onClick={onCancel} disabled={isCreating}>
            Cancel
          </button>
          <button type="button" onClick={() => onConfirm(note, source, label)} disabled={isCreating}>
            {isCreating ? "Creating…" : "Generate code"}
          </button>
        </div>
      </section>
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
  const { copied, share } = useCopy();

  function download() {
    const canvas = canvasRef.current?.querySelector("canvas");
    if (!canvas) return;
    const anchor = document.createElement("a");
    anchor.href = canvas.toDataURL("image/png");
    anchor.download = `gutguard-${label.toLowerCase()}-${partner.partner_code}.png`;
    anchor.click();
  }

  return (
    <figure className="admin-codes-qr">
      <figcaption>{label}</figcaption>
      <QRCodeSVG value={link} size={QR_RENDER_PX} {...QR_LOGO_PROPS} marginSize={4} style={{ width: "100%", height: "auto" }} />
      <div ref={canvasRef} hidden>
        <QRCodeCanvas value={link} size={QR_RENDER_PX} {...QR_LOGO_PROPS} marginSize={4} />
      </div>
      <code>{link}</code>
      <div className="admin-codes-qr-actions">
        <button type="button" onClick={() => share(link)}>{copied ? "Copied" : "Share link"}</button>
        <button type="button" onClick={download}>Download PNG</button>
      </div>
    </figure>
  );
}
