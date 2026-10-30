"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Coins, RefreshCw, ShieldCheck, Stethoscope, UserPlus } from "lucide-react";
import { useAdminAccess } from "@/components/admin/AdminShell";
import { Alert, FilterTabs, MetricCell, MetricStrip, PageBody, Section } from "@/components/admin/blocks";
import { CellStack, DataTable } from "@/components/admin/data-table/data-table";
import { RowActions, type RowAction } from "@/components/admin/data-table/row-actions";
import { ConfirmDialog, DetailList, EditSheet, Field, FieldGroup } from "@/components/admin/form";
import { PartnerQrCard } from "@/components/admin/partner-qr";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { Select } from "@/components/admin/ui/select";
import { Switch } from "@/components/admin/ui/switch";
import { Textarea } from "@/components/admin/ui/textarea";
import {
  adminAssignUnclaimedPassup,
  adminImpersonateDoctor,
  adminListUnclaimedPassup,
  adminPromotePartner,
  adminToggleReferralQr,
  adminTransferStore,
  adminUpgradeToMainStore,
  getDoctorRegistrations,
  setDoctorShopProtocol,
  updateDoctorRegistration,
  type AdminDoctorRegistration,
  type UnclaimedPassup,
} from "@/lib/api";
import { NAME_PREFIXES } from "@/lib/constants";
import { isSandboxShop } from "@/lib/supabase";
import { formatPrefixedName } from "@/lib/validation";

type Partner = AdminDoctorRegistration;
type Tab = "all" | "referred" | "direct";
type StoreKind = "main" | "lifestyle" | "affiliate";
type PendingAction = { kind: "login" | "promote" | "upgrade" | "transfer" | "assign"; partner: Partner };

const STORE_LABEL: Record<StoreKind, string> = { main: "Main store", lifestyle: "Lifestyle", affiliate: "Affiliate" };
// A missing store type showed (and acted) as Lifestyle on the old page; keep that.
const storeOf = (partner: Partner): StoreKind => (partner.store_type as StoreKind) ?? "lifestyle";
const isReferred = (partner: Partner) => Boolean(partner.referred_by_partner_id || partner.referrer_name);
const nameOf = (partner: Partner) => formatPrefixedName(partner.name_prefix, partner.full_name) || "Unnamed doctor";
const referrerOf = (partner: Partner) =>
  partner.referrer_name ? formatPrefixedName(partner.referrer_prefix, partner.referrer_name) : isReferred(partner) ? "Unnamed partner" : "Direct";
const day = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(date);
};
const count = (value: number) => value.toLocaleString("en-PH");
const slugify = (value: string | null | undefined) =>
  (value ?? "doctor").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "doctor";

const TAB_MATCH: Record<Tab, (partner: Partner) => boolean> = {
  all: () => true,
  referred: isReferred,
  direct: (partner) => !isReferred(partner),
};

const searchText = (partner: Partner) =>
  [
    partner.full_name,
    partner.name_prefix,
    partner.email,
    partner.mobile,
    partner.routing_slug,
    partner.specialty,
    partner.practice_location,
    partner.where_did_you_find_us ?? "",
    partner.referrer_name ?? "",
    partner.referrer_prefix ?? "",
    partner.referrer_slug ?? "",
    isReferred(partner) ? "referred" : "direct",
    partner.prize_label ?? "",
    partner.store_type ?? "",
    partner.partner_code ? String(partner.partner_code) : "",
    partner.email ? "" : "pending",
  ].join(" ");

/** Admin → Doctor partners: every partner, their QR codes, store tier and network moves. */
export default function DoctorPartners() {
  const { owner } = useAdminAccess();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [unclaimed, setUnclaimed] = useState<Map<string, UnclaimedPassup>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  // Edit panel: draft + what was loaded, and an open flag so it keeps its content while sliding out.
  const [draft, setDraft] = useState<Partner | null>(null);
  const [original, setOriginal] = useState<Partner | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // Confirmation window for login / promote / upgrade / transfer / give points.
  const [action, setAction] = useState<PendingAction | null>(null);
  const [actionOpen, setActionOpen] = useState(false);
  const [note, setNote] = useState("");
  const [pickId, setPickId] = useState("");
  const [busy, setBusy] = useState(false);
  const [togglingQrId, setTogglingQrId] = useState<string | null>(null);

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      setPartners(await getDoctorRegistrations());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load partners.");
    } finally {
      setIsLoading(false);
    }
    adminListUnclaimedPassup()
      .then((stores) => setUnclaimed(new Map(stores.map((store) => [store.store_id, store]))))
      .catch((caught) => console.warn("Unclaimed pass-up points unavailable:", caught));
  }

  // AdminShell only renders this page once the admin session is valid.
  useEffect(() => {
    load();
  }, []);

  const patchPartner = (id: string, patch: Partial<Partner>) =>
    setPartners((current) => current.map((partner) => (partner.id === id ? { ...partner, ...patch } : partner)));

  const openEditor = (partner: Partner) => {
    setDraft({ ...partner });
    setOriginal(partner);
    setPanelOpen(true);
    setError(null);
    setNotice(null);
  };
  const edit = (patch: Partial<Partner>) => setDraft((current) => (current ? { ...current, ...patch } : current));
  const openAction = (kind: PendingAction["kind"], partner: Partner) => {
    setAction({ kind, partner });
    setNote("");
    setPickId("");
    setActionOpen(true);
  };

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await updateDoctorRegistration({
        id: draft.id,
        name_prefix: draft.name_prefix.trim(),
        full_name: draft.full_name.trim(),
        email: draft.email.trim(),
        mobile: draft.mobile.trim(),
        // The old pop-up showed this field but never sent it; the server has always supported it.
        routing_slug: draft.routing_slug.trim().toLowerCase(),
        specialty: draft.specialty.trim(),
        practice_location: draft.practice_location.trim(),
        code_label: (draft.code_label ?? "").trim(),
        code_note: (draft.code_note ?? "").trim(),
        code_source: (draft.code_source ?? "").trim(),
      });
      const { label_saved: labelSaved, ...savedPartner } = saved;
      patchPartner(savedPartner.id, savedPartner);
      setPanelOpen(false);
      if (labelSaved === false && draft.code_label?.trim()) {
        setNotice(`${nameOf({ ...draft, ...savedPartner })} saved, except the label: the database doesn't support labels yet.`);
      } else {
        setNotice(`${nameOf({ ...draft, ...savedPartner })} saved.`);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update doctor details.");
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleShopProtocol(partner: Partner, show: boolean) {
    setError(null);
    setNotice(null);
    try {
      const saved = await setDoctorShopProtocol(partner.id, show);
      patchPartner(partner.id, { shop_show_protocol: saved });
      // Saved straight away, so the panel's "unsaved changes" check must not count it.
      setDraft((current) => (current?.id === partner.id ? { ...current, shop_show_protocol: saved } : current));
      setOriginal((current) => (current?.id === partner.id ? { ...current, shop_show_protocol: saved } : current));
      setNotice(saved ? "Shop link now shows the Full Protocol." : "Shop link now shows Try First only.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update shop link setting.");
    }
  }

  async function toggleQr(partner: Partner) {
    const next = !partner.referral_qr_enabled;
    setTogglingQrId(partner.id);
    setError(null);
    setNotice(null);
    try {
      await adminToggleReferralQr(partner.id, next);
      patchPartner(partner.id, { referral_qr_enabled: next });
      setNotice(`Referral QR ${next ? "enabled" : "disabled"} for ${nameOf(partner)}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to toggle Referral QR.");
    } finally {
      setTogglingQrId(null);
    }
  }

  async function runAction() {
    if (!action) return;
    const { kind, partner } = action;
    const picked = partners.find((item) => item.id === pickId);
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (kind === "login") {
        const { actionLink } = await adminImpersonateDoctor(partner.email);
        // Opened rather than followed, so this admin tab keeps its own state.
        window.open(actionLink, "_blank", "noopener,noreferrer");
        setNotice(`Opened the partner portal as ${nameOf(partner)}.`);
      } else if (kind === "promote") {
        await adminPromotePartner(partner.id, "Admin manual promotion");
        patchPartner(partner.id, { store_type: "lifestyle", referral_qr_enabled: true });
        setNotice(`Promoted ${nameOf(partner)} to Lifestyle.`);
      } else if (kind === "upgrade") {
        const res = await adminUpgradeToMainStore(partner.id, note);
        patchPartner(partner.id, { store_type: "main", main_store_id: null, referral_qr_enabled: true });
        setNotice(`Upgraded ${nameOf(partner)} to Main store. Moved ${res.descendants_moved} stores under it.`);
      } else if (kind === "transfer" && picked) {
        const res = await adminTransferStore(partner.id, picked.id, note);
        patchPartner(partner.id, {
          referred_by_partner_id: picked.id,
          referrer_name: picked.full_name ?? null,
          referrer_prefix: picked.name_prefix ?? null,
          referrer_slug: picked.routing_slug ?? null,
          main_store_id: res.main_store_id,
        });
        setNotice(
          `Moved ${nameOf(partner)} to ${nameOf(picked)}; ${isSandboxShop ? res.sandbox_points_moved : res.points_moved} pass-up points transferred.`,
        );
      } else if (kind === "assign" && picked) {
        const res = await adminAssignUnclaimedPassup(partner.id, picked.id, note);
        setUnclaimed((current) => {
          const next = new Map(current);
          next.delete(partner.id);
          return next;
        });
        setNotice(`Gave ${res.points} pass-up points from ${nameOf(partner)} (${res.orders} orders) to ${nameOf(picked)}.`);
      }
      setActionOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That didn't work. Try again.");
      setActionOpen(false);
    } finally {
      setBusy(false);
    }
  }

  const metrics = useMemo(() => {
    const affiliates = partners.filter((partner) => storeOf(partner) === "affiliate");
    const referred = partners.filter(isReferred).length;
    return {
      pending: partners.filter((partner) => !partner.email).length,
      referred,
      direct: partners.length - referred,
      affiliates: affiliates.length,
      qrActive: affiliates.filter((partner) => partner.referral_qr_enabled).length,
      unclaimedPoints: [...unclaimed.values()].reduce((sum, store) => sum + store.points, 0),
      unclaimedStores: unclaimed.size,
    };
  }, [partners, unclaimed]);

  const rows = useMemo(() => partners.filter(TAB_MATCH[tab]), [partners, tab]);

  const pickOptions = useMemo(() => {
    if (!action || (action.kind !== "transfer" && action.kind !== "assign")) return [];
    const { partner, kind } = action;
    return partners
      .filter((item) => item.id !== partner.id && (kind === "assign" || item.id !== partner.referred_by_partner_id))
      .sort((a, b) => a.full_name.localeCompare(b.full_name))
      .map((item) => ({ value: item.id, label: `${nameOf(item)}${item.partner_code ? ` · #${item.partner_code}` : ""}` }));
  }, [action, partners]);

  const columns = useMemo<ColumnDef<Partner, unknown>[]>(
    () => [
      {
        id: "partner",
        accessorFn: nameOf,
        meta: { label: "Partner" },
        cell: ({ row }) => (
          <CellStack
            title={
              <span className="inline-flex items-center gap-2">
                {nameOf(row.original)}
                {row.original.email ? null : <Badge>Pending</Badge>}
              </span>
            }
            sub={row.original.partner_code ? `#${row.original.partner_code}` : undefined}
          />
        ),
      },
      { id: "code", accessorFn: (partner) => partner.partner_code ?? "", meta: { label: "Partner code" } },
      {
        id: "storeType",
        accessorFn: (partner) => STORE_LABEL[storeOf(partner)],
        meta: { label: "Store type" },
        cell: ({ row }) => {
          const partner = row.original;
          const pass = unclaimed.get(partner.id);
          const notes: ReactNode[] = [];
          if (storeOf(partner) === "affiliate" && !partner.referral_qr_enabled) notes.push("QR locked");
          if (pass) notes.push(<span key="pass" className="text-[#b45309]">{count(pass.points)} unclaimed pts</span>);
          return (
            <CellStack
              title={<Badge>{STORE_LABEL[storeOf(partner)]}</Badge>}
              sub={notes.length ? notes.map((item, index) => <span key={index}>{index ? " · " : ""}{item}</span>) : undefined}
            />
          );
        },
      },
      {
        id: "contact",
        accessorKey: "mobile",
        meta: { label: "Contact" },
        cell: ({ row }) => <CellStack title={row.original.mobile || "—"} sub={row.original.email || undefined} />,
      },
      { id: "email", accessorKey: "email", meta: { label: "Email" } },
      {
        id: "referrer",
        accessorFn: referrerOf,
        meta: { label: "Referred by" },
        cell: ({ row }) =>
          isReferred(row.original) ? referrerOf(row.original) : <span className="text-subtle-foreground">Direct</span>,
      },
      { id: "specialty", accessorKey: "specialty", meta: { label: "Specialty" } },
      { id: "address", accessorKey: "practice_location", meta: { label: "Clinic address" } },
      { id: "found", accessorFn: (partner) => partner.where_did_you_find_us ?? "", meta: { label: "Where they found us" } },
      { id: "prize", accessorFn: (partner) => partner.prize_label || "Not spun", meta: { label: "Wheel prize" } },
      { id: "slug", accessorKey: "routing_slug", meta: { label: "Routing slug" } },
      {
        id: "registered",
        accessorKey: "created_at",
        meta: { label: "Registered", csv: (partner) => partner.created_at },
        cell: ({ row }) => <span className="whitespace-nowrap">{day(row.original.created_at)}</span>,
      },
      {
        id: "actions",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
          const partner = row.original;
          const store = storeOf(partner);
          const actions: RowAction[] = [{ label: "Edit", onSelect: () => openEditor(partner) }];
          if (owner && partner.email) actions.push({ label: "Log in as partner", onSelect: () => openAction("login", partner) });
          if (store === "lifestyle") actions.push({ label: "Upgrade to Main", onSelect: () => openAction("upgrade", partner) });
          if (store === "affiliate") {
            actions.push(
              {
                label: partner.referral_qr_enabled ? "Disable referral QR" : "Enable referral QR",
                disabled: togglingQrId === partner.id,
                onSelect: () => toggleQr(partner),
              },
              { label: "Promote to Lifestyle", onSelect: () => openAction("promote", partner) },
              { label: "Transfer", onSelect: () => openAction("transfer", partner) },
            );
          }
          if (unclaimed.has(partner.id)) actions.push({ label: "Give unclaimed points", onSelect: () => openAction("assign", partner) });
          return (
            <div className="flex justify-end">
              <RowActions label={`Actions for ${nameOf(partner)}`} actions={actions} />
            </div>
          );
        },
      },
    ],
    // The handlers only use state setters and the row they're given.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [unclaimed, owner, togglingQrId],
  );

  const dirty = Boolean(draft && original && JSON.stringify(draft) !== JSON.stringify(original));
  const slugFor = (partner: Partner) => partner.routing_slug || slugify(partner.full_name);
  const target = action?.partner;
  const pass = target ? unclaimed.get(target.id) : undefined;

  return (
    <>
      <MetricStrip>
        <MetricCell label="Partners" icon={Stethoscope} loading={isLoading} value={count(partners.length)} footer={["Pending sign-in", count(metrics.pending)]} />
        <MetricCell label="Joined by referral" icon={UserPlus} loading={isLoading} value={count(metrics.referred)} footer={["Direct", count(metrics.direct)]} />
        <MetricCell label="Affiliates" icon={ShieldCheck} loading={isLoading} value={count(metrics.affiliates)} footer={["Referral QR active", count(metrics.qrActive)]} />
        <MetricCell
          label="Unclaimed pass-up points"
          icon={Coins}
          loading={isLoading}
          value={count(metrics.unclaimedPoints)}
          footer={["Stores", count(metrics.unclaimedStores)]}
        />
      </MetricStrip>

      <PageBody>
        {error && !panelOpen ? <Alert tone="error">{error}</Alert> : null}
        {notice ? <Alert>{notice}</Alert> : null}

        <Section
          actions={
            <FilterTabs
              label="Filter partners by how they joined"
              value={tab}
              onChange={setTab}
              tabs={[
                { value: "all", label: "All", count: partners.length },
                { value: "referred", label: "Referred", count: metrics.referred },
                { value: "direct", label: "Direct", count: metrics.direct },
              ]}
            />
          }
        >
          <DataTable
            data={rows}
            columns={columns}
            loading={isLoading && partners.length === 0}
            searchText={searchText}
            searchPlaceholder="Search partners"
            facets={[
              { column: "storeType", title: "Store type" },
              { column: "referrer", title: "Referred by" },
            ]}
            exportName="gutguard-partners"
            onRowClick={openEditor}
            initialSort={[{ id: "registered", desc: true }]}
            initialHidden={["code", "email", "specialty", "address", "found", "prize", "slug"]}
            emptyText="No doctor registrations found."
            actions={
              <Button variant="outline" size="icon-sm" onClick={load} disabled={isLoading} aria-label="Refresh partners" title="Refresh partners" className="rounded-lg shadow-none">
                <RefreshCw className={isLoading ? "animate-spin" : undefined} strokeWidth={1.5} />
              </Button>
            }
          />
        </Section>
      </PageBody>

      {draft && original ? (
        <EditSheet
          open={panelOpen}
          onOpenChange={setPanelOpen}
          size="wide"
          title={nameOf(original)}
          description={[original.partner_code ? `#${original.partner_code}` : "", STORE_LABEL[storeOf(original)], original.email ? "" : "Pending sign-in"]
            .filter(Boolean)
            .join(" · ")}
          onSubmit={saveEdit}
          footer={
            <>
              <Button type="button" variant="ghost" size="sm" onClick={() => setPanelOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={!dirty || isSaving}>
                {isSaving ? "Saving" : "Save"}
              </Button>
            </>
          }
        >
          {error ? <Alert tone="error">{error}</Alert> : null}

          <FieldGroup title="Details">
            <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3">
              <Field label="Prefix" htmlFor="partner-prefix">
                <Select
                  id="partner-prefix"
                  value={draft.name_prefix || ""}
                  placeholder="Prefix"
                  onValueChange={(name_prefix) => edit({ name_prefix })}
                  options={NAME_PREFIXES.map((prefix) => ({ value: prefix, label: prefix }))}
                />
              </Field>
              <Field label="Name" htmlFor="partner-name">
                <Input id="partner-name" value={draft.full_name} required onChange={(e) => edit({ full_name: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email" htmlFor="partner-email" hint={draft.email ? undefined : "Add one so they can sign in."}>
                <Input id="partner-email" type="email" value={draft.email} onChange={(e) => edit({ email: e.target.value })} />
              </Field>
              <Field label="Mobile" htmlFor="partner-mobile">
                <Input id="partner-mobile" value={draft.mobile} required onChange={(e) => edit({ mobile: e.target.value })} />
              </Field>
              <Field label="Specialty" htmlFor="partner-specialty">
                <Input id="partner-specialty" value={draft.specialty} onChange={(e) => edit({ specialty: e.target.value })} />
              </Field>
              <Field
                label="Routing slug"
                htmlFor="partner-slug"
                hint="Used in older /r/ links. Changing it breaks printed /r/ links with the old slug; the QR codes below use the partner code and keep working."
              >
                <Input
                  id="partner-slug"
                  value={draft.routing_slug || ""}
                  placeholder="icsps"
                  onChange={(e) => edit({ routing_slug: e.target.value.trim().toLowerCase() })}
                />
              </Field>
            </div>
            <Field label="Clinic address" htmlFor="partner-address">
              <Input id="partner-address" value={draft.practice_location} required onChange={(e) => edit({ practice_location: e.target.value })} />
            </Field>
          </FieldGroup>

          <FieldGroup title="Partner code">
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Label"
                htmlFor="partner-code-label"
                hint={`Shown on the join page: Ref number #${original.partner_code ?? ""}${draft.code_label?.trim() ? ` · ${draft.code_label.trim()}` : ""}`}
              >
                <Input id="partner-code-label" value={draft.code_label ?? ""} maxLength={40} onChange={(e) => edit({ code_label: e.target.value })} />
              </Field>
              <Field label="Description" htmlFor="partner-code-note" hint="Admin only.">
                <Input id="partner-code-note" value={draft.code_note ?? ""} maxLength={200} onChange={(e) => edit({ code_note: e.target.value })} />
              </Field>
            </div>
            <Field
              label="Where the QR is used"
              htmlFor="partner-code-source"
              hint={"Pre-fills “Where did you find us?” for doctors who join through this partner's QR."}
            >
              <Input id="partner-code-source" value={draft.code_source ?? ""} maxLength={120} onChange={(e) => edit({ code_source: e.target.value })} />
            </Field>
          </FieldGroup>

          <FieldGroup title="QR codes">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <PartnerQrCard partner={original} mode="shop" label="Shop" fileName={`${slugFor(original)}-shop-qr.png`} margin={2}>
                <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                  <Label htmlFor="partner-protocol" className="text-[13px] font-normal">
                    Show Full Protocol in shop link
                  </Label>
                  <Switch
                    id="partner-protocol"
                    checked={original.shop_show_protocol === true}
                    onCheckedChange={(checked) => toggleShopProtocol(original, checked)}
                  />
                </div>
              </PartnerQrCard>
              <PartnerQrCard partner={original} mode="referral" label="Join" fileName={`${slugFor(original)}-referral-qr.png`} margin={2} />
            </div>
            <p className="text-xs text-muted-foreground">The Full Protocol switch saves right away.</p>
          </FieldGroup>

          <DetailList
            title="Network"
            items={[
              ["Store type", STORE_LABEL[storeOf(original)]],
              ["Referral QR", storeOf(original) === "affiliate" ? (original.referral_qr_enabled ? "Active" : "Locked") : "Always on"],
              ["Referred by", referrerOf(original)],
              ["Unclaimed pass-up", unclaimed.has(original.id) ? `${count(unclaimed.get(original.id)!.points)} pts from ${unclaimed.get(original.id)!.orders} orders` : ""],
              ["Where they found us", original.where_did_you_find_us ?? ""],
              ["Wheel prize", original.prize_label || "Not spun"],
              ["Registered", day(original.created_at)],
            ]}
          />
        </EditSheet>
      ) : null}

      <ConfirmDialog
        open={actionOpen}
        onOpenChange={setActionOpen}
        busy={busy}
        onConfirm={runAction}
        destructive={action?.kind === "upgrade"}
        confirmDisabled={(action?.kind === "transfer" || action?.kind === "assign") && !pickId}
        title={
          !target
            ? ""
            : action?.kind === "login"
              ? "Log in as this partner?"
              : action?.kind === "promote"
                ? `Promote ${nameOf(target)} to Lifestyle?`
                : action?.kind === "upgrade"
                  ? `Upgrade ${nameOf(target)} to a Main store?`
                  : action?.kind === "transfer"
                    ? "Transfer this affiliate store?"
                    : "Give unclaimed pass-up points?"
        }
        description={
          !target
            ? undefined
            : action?.kind === "login"
              ? `Opens the partner portal as ${target.email}. It's recorded in the impersonation log and replaces any partner session in this browser.`
              : action?.kind === "promote"
                ? "They become a Lifestyle store and their referral QR turns on."
                : action?.kind === "upgrade"
                  ? "This is a breakaway from their current Main store:"
                  : action?.kind === "transfer"
                    ? `${nameOf(target)} is currently referred by ${isReferred(target) ? referrerOf(target) : "no one (direct registration)"}.`
                    : `${count(pass?.points ?? 0)} pass-up points from ${pass?.orders ?? 0} orders by ${nameOf(target)} went to no one because the store had no upline when they were earned.`
        }
        confirmLabel={
          action?.kind === "login"
            ? "Open partner portal"
            : action?.kind === "promote"
              ? "Promote"
              : action?.kind === "upgrade"
                ? "Upgrade to Main"
                : action?.kind === "transfer"
                  ? "Transfer"
                  : "Give points"
        }
      >
        {action?.kind === "upgrade" ? (
          <ul className="flex list-disc flex-col gap-1 pl-5 text-[13px] text-muted-foreground">
            <li>Cuts the referral link to their former upline Main store.</li>
            <li>Every store below them in their referral tree moves under the new Main store.</li>
            <li>The former upline Main store no longer sees this part of the tree.</li>
          </ul>
        ) : null}
        {action?.kind === "transfer" || action?.kind === "assign" ? (
          <>
            <Alert tone="warning">
              {action.kind === "transfer"
                ? "The new upline gets this store's future pass-up points, and the pass-up points the old upline already earned from it move to the new upline. The store moves under the new upline's Main store."
                : target?.referred_by_partner_id
                  ? "The points go to the partner you pick. The store's upline doesn't change; its future sales already pay that upline."
                  : "The points go to the partner you pick. The store's upline doesn't change, so its future sales stay unclaimed."}
            </Alert>
            <Field label={action.kind === "transfer" ? "New upline" : "Give to"} htmlFor="partner-pick">
              <Select searchable id="partner-pick" value={pickId} placeholder="Choose a partner" onValueChange={setPickId} options={pickOptions} />
            </Field>
          </>
        ) : null}
        {action?.kind === "upgrade" || action?.kind === "transfer" || action?.kind === "assign" ? (
          <Field label="Admin note (optional)" htmlFor="partner-note">
            <Textarea id="partner-note" value={note} rows={2} placeholder="Reason" onChange={(e) => setNote(e.target.value)} />
          </Field>
        ) : null}
      </ConfirmDialog>
    </>
  );
}
