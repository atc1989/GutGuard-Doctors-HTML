"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, RefreshCw } from "lucide-react";
import { Alert, PageBody } from "@/components/admin/blocks";
import { DataTable } from "@/components/admin/data-table/data-table";
import { RowActions } from "@/components/admin/data-table/row-actions";
import { ConfirmDialog, EditSheet, Field } from "@/components/admin/form";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { PartnerQrCard } from "@/components/admin/partner-qr";
import { getPartnerQrLink, useCopy } from "@/components/partner/shared";
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

const day = (value: string) =>
  new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
const searchText = (partner: PendingPartner) => [partner.partner_code, partner.code_label, partner.code_note, partner.code_source].join(" ");

/**
 * Staff mint a blank partner: one click -> a code and its two QRs. When the doctor gets in
 * touch, admin fills in their details (with an email, so they can sign in) on Doctor Partners.
 */
export default function AdminCodesPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [pending, setPending] = useState<PendingPartner[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Highest code in use; the Generate window previews the next one.
  const [maxCode, setMaxCode] = useState(0);
  // Generate window and its optional fields.
  const [generateOpen, setGenerateOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const [source, setSource] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  // QR panel with the code's editable fields; the open flag is separate so it keeps its content
  // while sliding out.
  const [selected, setSelected] = useState<PendingPartner | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [fields, setFields] = useState({ label: "", note: "", source: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);
  const { share } = useCopy();

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
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load partners.");
    } finally {
      setIsLoading(false);
    }
  }

  // AdminShell only renders this page once the admin session is valid.
  useEffect(() => {
    load();
  }, []);

  const showQrs = (partner: PendingPartner) => {
    setSelected(partner);
    setFields({ label: partner.code_label ?? "", note: partner.code_note ?? "", source: partner.code_source ?? "" });
    setPanelError(null);
    setPanelOpen(true);
  };

  const fieldsChanged = Boolean(
    selected &&
      (fields.label.trim() !== (selected.code_label ?? "") ||
        fields.note.trim() !== (selected.code_note ?? "") ||
        fields.source.trim() !== (selected.code_source ?? "")),
  );

  async function saveFields(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setIsSaving(true);
    setPanelError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/codes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, ...fields }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save the code.");
      const labelSaved = data.partner?.label_saved !== false;
      const saved: PendingPartner = {
        ...selected,
        code_label: labelSaved ? fields.label.trim() : selected.code_label,
        code_note: fields.note.trim(),
        code_source: fields.source.trim(),
      };
      setPending((current) => current.map((partner) => (partner.id === saved.id ? saved : partner)));
      setSelected(saved);
      setPanelOpen(false);
      setNotice(
        labelSaved || !fields.label.trim()
          ? `#${saved.partner_code} saved.`
          : `#${saved.partner_code} saved, except the label: the database doesn't support labels yet.`,
      );
    } catch (caught) {
      setPanelError(caught instanceof Error ? caught.message : "Could not save the code.");
    } finally {
      setIsSaving(false);
    }
  }

  const openGenerate = () => {
    setLabel("");
    setNote("");
    setSource("");
    setError(null);
    setGenerateOpen(true);
  };

  async function generate() {
    setIsCreating(true);
    setError(null);
    setNotice(null);
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
      setMaxCode((current) => Math.max(current, created.partner_code));
      setGenerateOpen(false);
      showQrs(created);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create a code.");
      setGenerateOpen(false);
    } finally {
      setIsCreating(false);
    }
  }

  const columns = useMemo<ColumnDef<PendingPartner, unknown>[]>(() => {
    const shareLink = async (partner: PendingPartner, mode: "shop" | "referral") => {
      const shared = await share(getPartnerQrLink(partner, mode));
      if (shared) setNotice(`${mode === "shop" ? "Shop" : "Join"} link for #${partner.partner_code} copied or shared.`);
    };
    return [
      {
        id: "code",
        accessorKey: "partner_code",
        meta: { label: "Code" },
        cell: ({ row }) => <span className="font-medium tabular-nums">#{row.original.partner_code}</span>,
      },
      {
        id: "label",
        accessorFn: (partner) => partner.code_label ?? "",
        meta: { label: "Label" },
        cell: ({ getValue }) => (getValue() ? String(getValue()) : <span className="text-subtle-foreground">—</span>),
      },
      {
        id: "note",
        accessorFn: (partner) => partner.code_note ?? "",
        meta: { label: "Description" },
        cell: ({ getValue }) => (getValue() ? String(getValue()) : <span className="text-subtle-foreground">—</span>),
      },
      {
        id: "source",
        accessorFn: (partner) => partner.code_source ?? "",
        meta: { label: "Where it's used" },
        cell: ({ getValue }) => (getValue() ? String(getValue()) : <span className="text-subtle-foreground">—</span>),
      },
      {
        id: "created",
        accessorFn: (partner) => partner.created_at ?? "",
        meta: { label: "Created" },
        cell: ({ row }) => (row.original.created_at ? <span className="whitespace-nowrap">{day(row.original.created_at)}</span> : null),
      },
      {
        id: "actions",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <RowActions
              label={`Actions for code ${row.original.partner_code}`}
              actions={[
                { label: "Edit and show QR codes", onSelect: () => showQrs(row.original) },
                { label: "Share shop link", onSelect: () => shareLink(row.original, "shop") },
                { label: "Share join link", onSelect: () => shareLink(row.original, "referral") },
              ]}
            />
          </div>
        ),
      },
    ];
    // useCopy's share is a new function each render but only uses the browser share/clipboard and
    // its own state setter, so the first one behaves exactly like any later one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ponytail: a preview, not a reservation. Two admins generating at once can each see the same
  // number; the created code is the one shown after.
  const preview = { id: "preview", partner_code: maxCode + 1, routing_slug: `partner-${maxCode + 1}` };

  return (
    <PageBody>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {notice ? <Alert>{notice}</Alert> : null}

      <div className="flex flex-col gap-3">
        <DataTable
          data={pending}
          columns={columns}
          loading={isLoading && pending.length === 0}
          searchText={searchText}
          searchPlaceholder="Search codes"
          onRowClick={showQrs}
          initialSort={[{ id: "code", desc: true }]}
          emptyText="No pending codes."
          actions={
            <>
              <Button variant="outline" size="icon-sm" onClick={load} disabled={isLoading} aria-label="Refresh codes" title="Refresh codes" className="rounded-lg shadow-none">
                <RefreshCw className={isLoading ? "animate-spin" : undefined} strokeWidth={1.5} />
              </Button>
              <Button size="sm" onClick={openGenerate} disabled={isLoading} className="h-8 rounded-lg text-[13px]">
                <Plus strokeWidth={1.5} />
                Generate code
              </Button>
            </>
          }
        />
        <p className="text-xs text-muted-foreground">
          Pending codes stay here until you add the doctor&apos;s details and email on Doctor partners.
        </p>
      </div>

      {selected ? (
        <EditSheet
          open={panelOpen}
          onOpenChange={setPanelOpen}
          size="wide"
          title={`Partner #${selected.partner_code}`}
          description={[selected.created_at ? `Created ${day(selected.created_at)}` : "", selected.code_note].filter(Boolean).join(" · ") || undefined}
          onSubmit={saveFields}
          footer={
            <>
              <Button type="button" variant="ghost" size="sm" onClick={() => setPanelOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={!fieldsChanged || isSaving}>
                {isSaving ? "Saving" : "Save"}
              </Button>
            </>
          }
        >
          {panelError ? <Alert tone="error">{panelError}</Alert> : null}
          <Field
            label="Label (shown publicly on the join page)"
            htmlFor="edit-code-label"
            hint={`Doctors who join through this QR see “Ref number #${selected.partner_code}${fields.label.trim() ? ` · ${fields.label.trim()}` : ""}”`}
          >
            <Input id="edit-code-label" value={fields.label} maxLength={40} placeholder="GSC" onChange={(event) => setFields((current) => ({ ...current, label: event.target.value }))} />
          </Field>
          <Field label="Description (admin only)" htmlFor="edit-code-note">
            <Input id="edit-code-note" value={fields.note} maxLength={200} onChange={(event) => setFields((current) => ({ ...current, note: event.target.value }))} />
          </Field>
          <Field
            label="Where will this QR be used?"
            htmlFor="edit-code-source"
            hint={"Doctors who join through this QR see it already filled in as “Where did you find us?”"}
          >
            <Input id="edit-code-source" value={fields.source} maxLength={120} onChange={(event) => setFields((current) => ({ ...current, source: event.target.value }))} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <PartnerQrCard partner={selected} mode="shop" label="Shop" fileName={`gutguard-shop-${selected.partner_code}.png`} />
            <PartnerQrCard partner={selected} mode="referral" label="Join" fileName={`gutguard-join-${selected.partner_code}.png`} />
          </div>
          <p className="text-xs text-muted-foreground">
            Sales and sign-ups through these QRs are credited to #{selected.partner_code} from the first scan. To let the
            doctor sign in, fill in their details and email on Doctor partners.
          </p>
        </EditSheet>
      ) : null}

      <ConfirmDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        title={`Create account #${preview.partner_code}?`}
        description="Creates a blank partner. Sales and sign-ups through its QRs are credited to it from the first scan."
        confirmLabel="Generate code"
        busy={isCreating}
        onConfirm={generate}
      >
        <dl className="grid grid-cols-[72px_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-lg border border-border bg-chrome p-3 text-xs">
          <dt className="text-muted-foreground">Shop link</dt>
          <dd className="truncate font-mono">{getPartnerQrLink(preview, "shop")}</dd>
          <dt className="text-muted-foreground">Join link</dt>
          <dd className="truncate font-mono">{getPartnerQrLink(preview, "referral")}</dd>
        </dl>
        <Field
          label="Label (optional, shown publicly on the join page)"
          htmlFor="code-label"
          hint={`Doctors who join through this QR see “Ref number #${preview.partner_code}${label.trim() ? ` · ${label.trim()}` : ""}”`}
        >
          <Input id="code-label" value={label} maxLength={40} placeholder="GSC" onChange={(event) => setLabel(event.target.value)} />
        </Field>
        <Field label="Description (optional, admin only)" htmlFor="code-note">
          <Input id="code-note" value={note} maxLength={200} placeholder="Dr. Cruz, Makati clinic" onChange={(event) => setNote(event.target.value)} />
        </Field>
        <Field
          label="Where will this QR be used? (optional)"
          htmlFor="code-source"
          hint={"Doctors who join through this QR see it already filled in as “Where did you find us?”"}
        >
          <Input id="code-source" value={source} maxLength={120} placeholder="Manila Med Expo booth" onChange={(event) => setSource(event.target.value)} />
        </Field>
      </ConfirmDialog>
    </PageBody>
  );
}

