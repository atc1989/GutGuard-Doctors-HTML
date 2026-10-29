"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, RefreshCw } from "lucide-react";
import { Alert, FilterTabs, PageBody, Section, StatusDot } from "@/components/admin/blocks";
import { CellStack, DataTable } from "@/components/admin/data-table/data-table";
import { RowActions } from "@/components/admin/data-table/row-actions";
import { ConfirmDialog, EditSheet, Field, FieldGroup } from "@/components/admin/form";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Checkbox } from "@/components/admin/ui/checkbox";
import { DatePicker } from "@/components/admin/ui/date-time-picker";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { Switch } from "@/components/admin/ui/switch";
import {
  discountedPrice,
  formatPromoDay,
  manilaDate,
  MAX_PROMO_PERCENT,
  promoStatus,
  type Product,
  type Promo,
} from "@/lib/catalog";

type Status = ReturnType<typeof promoStatus>;
type Tab = "all" | Status;

const STATUS_TONE: Record<Status, "green" | "amber" | "gray"> = { Live: "green", Scheduled: "amber", Ended: "gray", Off: "gray" };
const TABS: Status[] = ["Live", "Scheduled", "Ended", "Off"];

const peso = (value: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(value);
const shortName = (name: string) => name.replace(/^SynBIOTIC\+\s*/i, "");
const productLabel = (product: Product) =>
  `${product.name}${product.phase ? ` (${product.phase})` : ""}${product.status === "active" ? "" : ` · ${product.status}`}`;
const day = (value: string) => `${formatPromoDay(value)}, ${value.slice(0, 4)}`;

/** "Nov 1 – Dec 31, 2026" (one year shown when both ends share it) or "From Nov 1, 2026". */
function dateRange(promo: Promo) {
  if (!promo.ends_on) return `From ${day(promo.starts_on)}`;
  return promo.starts_on.slice(0, 4) === promo.ends_on.slice(0, 4)
    ? `${formatPromoDay(promo.starts_on)} – ${day(promo.ends_on)}`
    : `${day(promo.starts_on)} – ${day(promo.ends_on)}`;
}

const emptyDraft = (): Promo => ({
  id: "",
  name: "",
  label: "",
  starts_on: manilaDate(new Date()),
  ends_on: null,
  enabled: true,
  discounts: {},
  prices: {},
  perCap: {},
});

async function request<T>(method: string, body?: unknown, query = ""): Promise<T> {
  const res = await fetch(`/api/admin/promos${query}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed.");
  return data as T;
}

export default function AdminPromosPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [tab, setTab] = useState<Tab>("all");
  const [draft, setDraft] = useState<Promo | null>(null);
  // Separate from draft so the panel keeps its content while it slides out.
  const [panelOpen, setPanelOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Promo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadPromos() {
    setIsLoading(true);
    setError(null);
    try {
      const data = await request<{ promos: Promo[]; products: Product[] }>("GET");
      setPromos(data.promos);
      setProducts(data.products);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load promos.");
    } finally {
      setIsLoading(false);
    }
  }

  // AdminShell only renders this page once the admin session is valid.
  useEffect(() => {
    loadPromos();
  }, []);

  async function save(promo: Promo, message: string) {
    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      const { promo: saved } = await request<{ promo: Promo }>("POST", promo);
      setPromos((current) =>
        current.some((row) => row.id === saved.id) ? current.map((row) => (row.id === saved.id ? saved : row)) : [saved, ...current],
      );
      setNotice(message);
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save promo.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function submitDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    if (await save(draft, `${draft.name.trim()} saved.`)) setPanelOpen(false);
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setIsSaving(true);
    setError(null);
    try {
      await request("DELETE", undefined, `?id=${encodeURIComponent(toDelete.id)}`);
      setPromos((current) => current.filter((row) => row.id !== toDelete.id));
      setNotice(`${toDelete.name} deleted.`);
      if (draft?.id === toDelete.id) setPanelOpen(false);
      setToDelete(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete promo.");
      setToDelete(null);
    } finally {
      setIsSaving(false);
    }
  }

  const openDraft = (promo: Promo) => {
    setDraft(promo);
    setPanelOpen(true);
    setError(null);
    setNotice(null);
  };

  function setPercent(productId: string, value: string | null) {
    if (!draft) return;
    const discounts = { ...draft.discounts };
    const prices = { ...draft.prices };
    const perCap = { ...draft.perCap };
    if (value === null) {
      delete discounts[productId];
      delete prices[productId];
      delete perCap[productId];
    } else discounts[productId] = Math.min(Math.max(Math.round(Number(value) || 0), 0), MAX_PROMO_PERCENT);
    setDraft({ ...draft, discounts, prices, perCap });
  }

  /**
   * Final price or promo per-capsule. Blank = use the calculation, which is what the field
   * shows as its placeholder, and keeps following the % if it changes.
   */
  function setTyped(field: "prices" | "perCap", productId: string, value: string) {
    if (!draft) return;
    const typed = { ...draft[field] };
    const pesos = Math.round(Number(value));
    if (!value || !pesos || pesos < 1) delete typed[productId];
    else typed[productId] = pesos;
    setDraft({ ...draft, [field]: typed });
  }

  const now = useMemo(() => new Date(), []);
  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  // Archived products leave the picker, unless the promo being edited still has them.
  const pickable = products
    .filter((product) => product.status !== "archived" || draft?.discounts[product.id] !== undefined)
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.sortOrder - b.sortOrder);

  const counts = Object.fromEntries(TABS.map((status) => [status, promos.filter((promo) => promoStatus(promo, now) === status).length]));
  const rows = useMemo(() => (tab === "all" ? promos : promos.filter((promo) => promoStatus(promo, now) === tab)), [promos, tab, now]);

  const columns = useMemo<ColumnDef<Promo, unknown>[]>(
    () => [
      {
        id: "name",
        accessorKey: "name",
        meta: { label: "Promo" },
        cell: ({ row }) => (
          <CellStack title={row.original.name} sub={row.original.label ? `Shows as "${row.original.label}"` : undefined} />
        ),
      },
      {
        id: "dates",
        accessorKey: "starts_on",
        meta: { label: "Dates" },
        cell: ({ row }) => <CellStack title={dateRange(row.original)} sub={row.original.ends_on ? undefined : "No end date"} />,
      },
      {
        id: "products",
        accessorFn: (promo) => Object.keys(promo.discounts).join(", "),
        enableSorting: false,
        meta: { label: "Products" },
        cell: ({ row }) => (
          <div className="flex min-w-60 max-w-md flex-wrap gap-1.5">
            {Object.entries(row.original.discounts).map(([id, pct]) => (
              <Badge key={id}>
                {shortName(productById.get(id)?.name ?? id)} −{pct}%
              </Badge>
            ))}
          </div>
        ),
      },
      {
        id: "status",
        accessorFn: (promo) => promoStatus(promo, now),
        meta: { label: "Status" },
        cell: ({ getValue }) => {
          const status = getValue() as Status;
          return <StatusDot tone={STATUS_TONE[status]}>{status}</StatusDot>;
        },
      },
      {
        id: "actions",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <RowActions
              label={`Actions for ${row.original.name}`}
              actions={[
                { label: "Edit", onSelect: () => openDraft(row.original) },
                {
                  label: row.original.enabled ? "Switch off" : "Switch on",
                  disabled: isSaving,
                  onSelect: () =>
                    save(
                      { ...row.original, enabled: !row.original.enabled },
                      `${row.original.name} switched ${row.original.enabled ? "off" : "on"}.`,
                    ),
                },
                { label: "Delete", destructive: true, onSelect: () => setToDelete(row.original) },
              ]}
            />
          </div>
        ),
      },
    ],
    [productById, now, isSaving],
  );

  const existing = Boolean(draft && promos.some((promo) => promo.id === draft.id));

  return (
    <PageBody>
      {error && !panelOpen ? <Alert tone="error">{error}</Alert> : null}
      {notice ? <Alert>{notice}</Alert> : null}

      <Section
        actions={
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <FilterTabs
              label="Filter promotions by status"
              value={tab}
              onChange={setTab}
              tabs={[{ value: "all" as Tab, label: "All", count: promos.length }, ...TABS.map((status) => ({ value: status as Tab, label: status, count: counts[status] }))]}
            />
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon-sm" onClick={loadPromos} disabled={isLoading} aria-label="Refresh promotions" title="Refresh promotions" className="rounded-lg shadow-none">
                <RefreshCw className={isLoading ? "animate-spin" : undefined} strokeWidth={1.5} />
              </Button>
              <Button size="sm" onClick={() => openDraft(emptyDraft())} className="h-8 rounded-lg text-[13px]">
                <Plus strokeWidth={1.5} />
                New promo
              </Button>
            </div>
          </div>
        }
      >
        <DataTable
          data={rows}
          columns={columns}
          loading={isLoading && promos.length === 0}
          toolbar={false}
          onRowClick={openDraft}
          initialSort={[{ id: "dates", desc: true }]}
          emptyText={tab === "all" ? "No promos yet." : `No ${tab.toLowerCase()} promos.`}
        />
      </Section>

      {draft ? (
        <EditSheet
          open={panelOpen}
          size="wide"
          onOpenChange={(isOpen) => !isOpen && setPanelOpen(false)}
          title={existing ? draft.name || "Promo" : "New promo"}
          description={existing ? `${promoStatus(draft, now)} · ${dateRange(draft)}` : "Pick the dates and the products it discounts."}
          onSubmit={submitDraft}
          footer={
            <>
              {existing ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setToDelete(draft)}
                  className="mr-auto text-[13px] font-normal text-down hover:bg-down/5 hover:text-down"
                >
                  Delete
                </Button>
              ) : null}
              <Button type="button" variant="ghost" size="sm" onClick={() => setPanelOpen(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSaving}>
                {isSaving ? "Saving" : "Save"}
              </Button>
            </>
          }
        >
          {error ? <Alert tone="error">{error}</Alert> : null}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Promo name" htmlFor="promo-name">
              <Input id="promo-name" value={draft.name} placeholder="Holiday Promo" required onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </Field>
            <Field label="Shop label (optional)" htmlFor="promo-label" hint="Shown to customers.">
              <Input id="promo-label" value={draft.label} placeholder="Holiday Sale" onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
            </Field>
            <Field label="Starts" htmlFor="promo-starts">
              <DatePicker id="promo-starts" value={draft.starts_on} onChange={(value) => value && setDraft({ ...draft, starts_on: value })} />
            </Field>
            <Field label="Ends" htmlFor="promo-ends">
              <DatePicker
                id="promo-ends"
                value={draft.ends_on}
                min={draft.starts_on}
                clearable
                placeholder="No end date"
                onChange={(value) => setDraft({ ...draft, ends_on: value })}
              />
            </Field>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">Philippine time. A promo runs until 11:59 PM on its end date.</p>

          <FieldGroup title="Products">
            <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
              {pickable.map((product) => {
                const pct = draft.discounts[product.id];
                const chosen = pct !== undefined;
                const calculatedPrice = discountedPrice(product.price, pct || 0);
                const calculatedPerCap = discountedPrice(product.perCap, pct || 0);
                return (
                  <div key={product.id} className="flex flex-col gap-3 p-3">
                    <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                      <Checkbox checked={chosen} onCheckedChange={(checked) => setPercent(product.id, checked ? "10" : null)} />
                      <span className="flex-1">{productLabel(product)}</span>
                      <span className="text-[13px] tabular-nums text-muted-foreground">{peso(product.price)}</span>
                    </label>
                    {chosen ? (
                      <>
                        <div className="grid grid-cols-3 gap-3">
                          <Field label="Discount %" htmlFor={`promo-pct-${product.id}`}>
                            <Input
                              id={`promo-pct-${product.id}`}
                              type="number"
                              min={1}
                              max={MAX_PROMO_PERCENT}
                              value={pct || ""}
                              onChange={(e) => setPercent(product.id, e.target.value)}
                            />
                          </Field>
                          <Field label="Final price (₱)" htmlFor={`promo-price-${product.id}`}>
                            <Input
                              id={`promo-price-${product.id}`}
                              type="number"
                              min={1}
                              max={product.price - 1}
                              value={draft.prices[product.id] ?? ""}
                              placeholder={String(calculatedPrice)}
                              onChange={(e) => setTyped("prices", product.id, e.target.value)}
                            />
                          </Field>
                          <Field label="Per capsule (₱)" htmlFor={`promo-percap-${product.id}`}>
                            <Input
                              id={`promo-percap-${product.id}`}
                              type="number"
                              min={1}
                              value={draft.perCap[product.id] ?? ""}
                              placeholder={String(calculatedPerCap)}
                              onChange={(e) => setTyped("perCap", product.id, e.target.value)}
                            />
                          </Field>
                        </div>
                        <p className="text-[13px] tabular-nums text-muted-foreground">
                          {peso(product.price)} → <span className="text-foreground">{peso(draft.prices[product.id] || calculatedPrice)}</span>
                          {" · "}
                          {peso(product.perCap)} → <span className="text-foreground">{peso(draft.perCap[product.id] || calculatedPerCap)}</span> per capsule
                        </p>
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Leave a price blank to use the calculated one. When promos overlap, each product gets the biggest discount. They never add up.
            </p>
          </FieldGroup>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="promo-enabled" className="text-[13px] font-normal">
                Promo is on
              </Label>
              <p className="text-xs text-muted-foreground">Switch off to hide it from the shop without deleting it.</p>
            </div>
            <Switch id="promo-enabled" checked={draft.enabled} onCheckedChange={(enabled) => setDraft({ ...draft, enabled })} />
          </div>
        </EditSheet>
      ) : null}

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(isOpen) => !isOpen && setToDelete(null)}
        title={`Delete ${toDelete?.name ?? "promo"}?`}
        description="Shop prices update immediately. This can't be undone."
        confirmLabel="Delete promo"
        destructive
        busy={isSaving}
        onConfirm={confirmDelete}
      />
    </PageBody>
  );
}
