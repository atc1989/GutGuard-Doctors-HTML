"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { RefreshCw } from "lucide-react";
import { Alert, FilterTabs, PageBody, Section, StatusDot } from "@/components/admin/blocks";
import { CellStack, DataTable } from "@/components/admin/data-table/data-table";
import { EditSheet, Field } from "@/components/admin/form";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Select } from "@/components/admin/ui/select";
import { Textarea } from "@/components/admin/ui/textarea";
import {
  isPromoLive,
  promoPerCap,
  promoPrice,
  SHOP_IMAGES,
  type Product,
  type ProductStatus,
  type Promo,
} from "@/lib/catalog";

type AdminProduct = Product & { updatedAt: string };

const peso = (value: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(value);

const STATUSES: { value: ProductStatus; label: string; help: string; tone: "green" | "gray" }[] = [
  { value: "active", label: "Active", help: "In the shop and can be bought.", tone: "green" },
  { value: "hidden", label: "Hidden", help: "Not in the shop. Still in promos, so it's easy to bring back.", tone: "gray" },
  { value: "archived", label: "Archived", help: "Retired. Not in the shop or the promo picker. Never deleted.", tone: "gray" },
];
const KIND_LABEL: Record<Product["kind"], string> = { protocol: "Protocol", trial: "Try first" };

async function request<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed.");
  return data as T;
}

const whole = (value: string) => Math.round(Number(value));

export default function AdminProductsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [tab, setTab] = useState<ProductStatus>("active");
  const [editing, setEditing] = useState<AdminProduct | null>(null);
  const [draft, setDraft] = useState<AdminProduct | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      const [productData, promoData] = await Promise.all([
        request<{ products: AdminProduct[] }>("/api/admin/products"),
        request<{ promos: Promo[] }>("/api/admin/promos"),
      ]);
      setProducts(productData.products);
      setPromos(promoData.promos);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load products.");
    } finally {
      setIsLoading(false);
    }
  }

  // AdminShell only renders this page once the admin session is valid.
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const now = useMemo(() => new Date(), []);
  const livePromos = useMemo(() => promos.filter((promo) => isPromoLive(promo, now)), [promos, now]);

  const open = (product: AdminProduct) => {
    setEditing(product);
    setDraft(product);
    setNotice(null);
  };
  const close = () => {
    setEditing(null);
    setDraft(null);
  };
  const edit = (patch: Partial<AdminProduct>) => setDraft((current) => (current ? { ...current, ...patch } : current));

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || !draft) return;
    setIsSaving(true);
    setError(null);
    try {
      const { product: saved } = await request<{ product: AdminProduct }>("/api/admin/products", draft);
      setProducts((current) => current.map((row) => (row.id === saved.id ? saved : row)));
      setNotice(saved.status === editing.status ? `${saved.name} saved.` : `${saved.name} is now ${saved.status}.`);
      close();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save product.");
    } finally {
      setIsSaving(false);
    }
  }

  const counts = Object.fromEntries(
    STATUSES.map(({ value }) => [value, products.filter((product) => product.status === value).length]),
  ) as Record<ProductStatus, number>;
  const rows = useMemo(() => products.filter((product) => product.status === tab), [products, tab]);

  const columns = useMemo<ColumnDef<AdminProduct, unknown>[]>(
    () => [
      {
        id: "name",
        accessorKey: "name",
        meta: { label: "Product" },
        cell: ({ row }) => (
          <CellStack
            title={
              <span className="inline-flex items-center gap-2">
                {row.original.name}
                {row.original.tag ? <Badge>{row.original.tag}</Badge> : null}
              </span>
            }
            sub={row.original.phase || undefined}
          />
        ),
      },
      {
        id: "type",
        accessorFn: (product) => KIND_LABEL[product.kind],
        meta: { label: "Type" },
        cell: ({ getValue }) => <Badge>{String(getValue())}</Badge>,
      },
      {
        id: "price",
        accessorKey: "price",
        meta: { label: "Price", align: "right" },
        cell: ({ row }) => {
          const live = promoPrice(row.original.id, row.original.price, livePromos, now);
          return (
            <CellStack
              title={peso(row.original.price)}
              sub={live.promo ? `${peso(live.price)} with ${live.promo.name}` : undefined}
            />
          );
        },
      },
      {
        id: "perCap",
        accessorKey: "perCap",
        meta: { label: "Per capsule", align: "right" },
        cell: ({ row }) => peso(row.original.perCap),
      },
      { id: "caps", accessorKey: "caps", meta: { label: "Capsules", align: "right" } },
      {
        id: "status",
        accessorKey: "status",
        meta: { label: "Status" },
        cell: ({ row }) => {
          const status = STATUSES.find(({ value }) => value === row.original.status);
          return <StatusDot tone={status?.tone ?? "gray"}>{status?.label ?? row.original.status}</StatusDot>;
        },
      },
      { id: "sortOrder", accessorKey: "sortOrder", meta: { label: "Display order", align: "right" } },
      {
        id: "updated",
        accessorKey: "updatedAt",
        meta: { label: "Last changed" },
        cell: ({ row }) => (row.original.updatedAt ? new Date(row.original.updatedAt).toLocaleString("en-PH") : "Never"),
      },
    ],
    [livePromos, now],
  );

  const priceChanged = Boolean(editing && draft && draft.price !== editing.price);
  const dirty = Boolean(editing && draft && JSON.stringify(draft) !== JSON.stringify(editing));

  return (
    <PageBody>
      {error && !editing ? <Alert tone="error">{error}</Alert> : null}
      {notice ? <Alert>{notice}</Alert> : null}

      <Section
        actions={
          <div className="flex items-center gap-2">
            <FilterTabs
              label="Filter products by status"
              value={tab}
              onChange={setTab}
              tabs={STATUSES.map(({ value, label }) => ({ value, label, count: counts[value] }))}
            />
            <Button variant="outline" size="icon-sm" onClick={load} disabled={isLoading} aria-label="Refresh products" title="Refresh products" className="rounded-lg shadow-none">
              <RefreshCw className={isLoading ? "animate-spin" : undefined} strokeWidth={1.5} />
            </Button>
          </div>
        }
      >
        <DataTable
          data={rows}
          columns={columns}
          loading={isLoading && products.length === 0}
          toolbar={false}
          onRowClick={open}
          initialSort={[
            { id: "type", desc: false },
            { id: "sortOrder", desc: false },
          ]}
          initialHidden={["sortOrder", "updated"]}
          emptyText={`No ${tab} products.`}
        />
      </Section>

      {draft && editing ? (
        <EditSheet
          open
          onOpenChange={(isOpen) => !isOpen && close()}
          title={editing.name}
          description={`${KIND_LABEL[editing.kind]} · ID ${editing.id}`}
          onSubmit={save}
          footer={
            <>
              <Button type="button" variant="ghost" size="sm" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={!dirty || isSaving}>
                {isSaving ? "Saving" : priceChanged ? "Save new price" : "Save"}
              </Button>
            </>
          }
        >
          {error ? <Alert tone="error">{error}</Alert> : null}

          <Field label="Name" htmlFor="product-name">
            <Input id="product-name" value={draft.name} onChange={(e) => edit({ name: e.target.value })} required />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Price (₱)" htmlFor="product-price">
              <Input id="product-price" type="number" min={1} value={draft.price || ""} onChange={(e) => edit({ price: whole(e.target.value) })} required />
            </Field>
            <Field label="Per capsule (₱)" htmlFor="product-percap">
              <Input id="product-percap" type="number" min={1} value={draft.perCap || ""} onChange={(e) => edit({ perCap: whole(e.target.value) })} required />
            </Field>
            <Field label="Capsules" htmlFor="product-caps">
              <Input id="product-caps" type="number" min={1} value={draft.caps || ""} onChange={(e) => edit({ caps: whole(e.target.value) })} required />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {draft.kind === "protocol" ? (
              <>
                <Field label="Phase" htmlFor="product-phase">
                  <Input id="product-phase" value={draft.phase} placeholder="30-day" onChange={(e) => edit({ phase: e.target.value })} />
                </Field>
                <Field label="Tag" htmlFor="product-tag">
                  <Input id="product-tag" value={draft.tag} placeholder="Popular" onChange={(e) => edit({ tag: e.target.value })} />
                </Field>
              </>
            ) : (
              <Field label="Image" htmlFor="product-image">
                <Select
                  id="product-image"
                  value={draft.image}
                  onValueChange={(image) => edit({ image })}
                  options={SHOP_IMAGES.map((image) => ({ value: image, label: image.replace("/shop/", "") }))}
                />
              </Field>
            )}
            <Field label="Display order" htmlFor="product-order">
              <Input id="product-order" type="number" value={draft.sortOrder} onChange={(e) => edit({ sortOrder: whole(e.target.value) })} />
            </Field>
          </div>

          {draft.kind === "protocol" ? (
            <>
              <Field label="Dosage line" htmlFor="product-dosage" hint="Shown on the product card.">
                <Input id="product-dosage" value={draft.dosage} placeholder="2–4 capsules a day" onChange={(e) => edit({ dosage: e.target.value })} />
              </Field>
              <Field label="What's included" htmlFor="product-includes" hint="One per line. Shown when the product is selected.">
                <Textarea
                  id="product-includes"
                  value={draft.includes.join("\n")}
                  placeholder={"SynBIOTIC+ (330 capsules)\nLifestyle Protocol"}
                  onChange={(e) => edit({ includes: e.target.value.split("\n") })}
                />
              </Field>
              <Field label="Note under the included list" htmlFor="product-note">
                <Input
                  id="product-note"
                  value={draft.includesNote}
                  placeholder="Lower rate for completing the full 90 days."
                  onChange={(e) => edit({ includesNote: e.target.value })}
                />
              </Field>
            </>
          ) : null}

          <Field label="Status" htmlFor="product-status" hint={STATUSES.find(({ value }) => value === draft.status)?.help}>
            <Select
              id="product-status"
              value={draft.status}
              onValueChange={(status) => edit({ status: status as ProductStatus })}
              options={STATUSES.map(({ value, label }) => ({ value, label }))}
            />
          </Field>

          <div className="flex flex-col gap-1 rounded-lg border border-border bg-chrome p-4 text-[13px]" aria-live="polite">
            <p className="text-xs text-muted-foreground">Shop preview</p>
            <p className="tabular-nums">
              {peso(draft.price)} · {peso(draft.perCap)} per capsule · {draft.caps} capsules
            </p>
            {livePromos
              .filter((promo) => promo.discounts[draft.id])
              .map((promo) => {
                const pricing = promoPrice(draft.id, draft.price, [promo], now);
                const showing = promoPrice(draft.id, draft.price, livePromos, now).promo?.id === promo.id;
                return (
                  <p key={promo.id} className="tabular-nums text-muted-foreground">
                    With {promo.name}: {peso(pricing.price)} · {peso(promoPerCap(draft, pricing))} per capsule
                    {showing ? " (showing now)" : ""}
                  </p>
                );
              })}
          </div>

          {priceChanged ? (
            <Alert tone="warning">Unpaid orders at {peso(editing.price)} will be asked to rebuild their basket.</Alert>
          ) : null}
        </EditSheet>
      ) : null}
    </PageBody>
  );
}
