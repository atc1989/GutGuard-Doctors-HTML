"use client";

import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { RefreshCw, ShoppingBag, Store, UserPlus, Wallet } from "lucide-react";
import type { AdminShop } from "@/app/api/admin/referred-shops/route";
import { Alert, FilterTabs, MetricCell, MetricStrip, PageBody, Section } from "@/components/admin/blocks";
import { CellStack, DataTable } from "@/components/admin/data-table/data-table";
import { RowActions } from "@/components/admin/data-table/row-actions";
import { DetailList, EditSheet } from "@/components/admin/form";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";

const peso = (value: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(value);
const day = (value: string) =>
  new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
const count = (value: number) => value.toLocaleString("en-PH");

const STORE_TYPES: Record<string, string> = { main: "Main Store", lifestyle: "Lifestyle", affiliate: "Affiliate" };
const storeLabel = (type: string) => STORE_TYPES[type] ?? type;
const referrerLabel = (shop: AdminShop) => shop.referrerName || (shop.referrerId ? "Unnamed partner" : "Direct sign-up");

type Tab = "all" | "referred" | "direct";
const TAB_MATCH: Record<Tab, (shop: AdminShop) => boolean> = {
  all: () => true,
  referred: (shop) => Boolean(shop.referrerId),
  direct: (shop) => !shop.referrerId,
};

const searchText = (shop: AdminShop) =>
  [shop.name, shop.specialty, shop.address, shop.referrerName, shop.mobile, shop.email, shop.mainStoreName].join(" ");

export default function AdminReferredShopsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [shops, setShops] = useState<AdminShop[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [selected, setSelected] = useState<AdminShop | null>(null);
  // Separate from `selected` so the panel keeps its content while it slides out.
  const [panelOpen, setPanelOpen] = useState(false);

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/referred-shops");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not load shops.");
      setShops(data.shops);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load shops.");
    } finally {
      setIsLoading(false);
    }
  }

  // AdminShell only renders this page once the admin session is valid.
  useEffect(() => {
    load();
  }, []);

  const open = (shop: AdminShop) => {
    setSelected(shop);
    setPanelOpen(true);
  };

  const metrics = useMemo(() => {
    const referred = shops.filter((shop) => shop.referrerId);
    return {
      direct: shops.length - referred.length,
      referred: referred.length,
      referrers: new Set(referred.map((shop) => shop.referrerId)).size,
      orders: shops.reduce((sum, shop) => sum + shop.orders, 0),
      withOrders: shops.filter((shop) => shop.orders > 0).length,
      sales: shops.reduce((sum, shop) => sum + shop.sales, 0),
      withSales: shops.filter((shop) => shop.sales > 0).length,
    };
  }, [shops]);

  const rows = useMemo(() => shops.filter(TAB_MATCH[tab]), [shops, tab]);

  const columns = useMemo<ColumnDef<AdminShop, unknown>[]>(
    () => [
      {
        id: "name",
        accessorFn: (shop) => shop.name || "Unnamed partner",
        meta: { label: "Shop / owner" },
        cell: ({ row }) => <CellStack title={row.original.name || "Unnamed partner"} sub={row.original.specialty || undefined} />,
      },
      { id: "address", accessorKey: "address", meta: { label: "Clinic address" } },
      { id: "mobile", accessorKey: "mobile", meta: { label: "Mobile" } },
      { id: "email", accessorKey: "email", meta: { label: "Email" } },
      {
        id: "storeType",
        accessorFn: (shop) => storeLabel(shop.storeType),
        meta: { label: "Store type" },
        cell: ({ getValue }) => <Badge>{String(getValue())}</Badge>,
      },
      {
        id: "referrer",
        accessorFn: referrerLabel,
        meta: { label: "Referred by" },
        cell: ({ row }) =>
          row.original.referrerId ? (
            <CellStack
              title={referrerLabel(row.original)}
              sub={row.original.referrerStoreType ? storeLabel(row.original.referrerStoreType) : undefined}
            />
          ) : (
            <span className="text-subtle-foreground">Direct sign-up</span>
          ),
      },
      { id: "mainStore", accessorKey: "mainStoreName", meta: { label: "Main store" } },
      {
        id: "joined",
        accessorKey: "joinedAt",
        meta: { label: "Joined", csv: (shop) => shop.joinedAt.slice(0, 10) },
        cell: ({ row }) => <span className="whitespace-nowrap">{day(row.original.joinedAt)}</span>,
      },
      { id: "orders", accessorKey: "orders", meta: { label: "Orders", align: "right" } },
      {
        id: "sales",
        accessorKey: "sales",
        meta: { label: "Paid sales (PHP)", align: "right" },
        cell: ({ row }) => peso(row.original.sales),
      },
      {
        id: "actions",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <RowActions label={`Actions for ${row.original.name || "shop"}`} actions={[{ label: "View details", onSelect: () => open(row.original) }]} />
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <>
      <MetricStrip>
        <MetricCell label="Shops" icon={Store} loading={isLoading} value={count(shops.length)} footer={["Direct sign-ups", count(metrics.direct)]} />
        <MetricCell
          label="Joined by referral"
          icon={UserPlus}
          loading={isLoading}
          value={count(metrics.referred)}
          footer={["Referring partners", count(metrics.referrers)]}
        />
        <MetricCell
          label="Orders through shop links"
          icon={ShoppingBag}
          loading={isLoading}
          value={count(metrics.orders)}
          footer={["Shops with orders", count(metrics.withOrders)]}
        />
        <MetricCell label="Paid sales" icon={Wallet} loading={isLoading} value={peso(metrics.sales)} footer={["Shops with sales", count(metrics.withSales)]} />
      </MetricStrip>

      <PageBody>
        {error ? <Alert tone="error">{error}</Alert> : null}

        <Section
          actions={
            <FilterTabs
              label="Filter shops by how they joined"
              value={tab}
              onChange={setTab}
              tabs={[
                { value: "all", label: "All", count: shops.length },
                { value: "referred", label: "Referred", count: metrics.referred },
                { value: "direct", label: "Direct", count: metrics.direct },
              ]}
            />
          }
        >
          <DataTable
            data={rows}
            columns={columns}
            loading={isLoading && shops.length === 0}
            searchText={searchText}
            searchPlaceholder="Search shops"
            facets={[
              { column: "storeType", title: "Store type" },
              { column: "referrer", title: "Referred by" },
            ]}
            exportName="gutguard-shops"
            onRowClick={open}
            initialSort={[{ id: "joined", desc: true }]}
            initialHidden={["address", "mobile", "email", "mainStore"]}
            emptyText="No shops yet."
            actions={
              <Button variant="outline" size="icon-sm" onClick={load} disabled={isLoading} aria-label="Refresh shops" title="Refresh shops" className="rounded-lg shadow-none">
                <RefreshCw className={isLoading ? "animate-spin" : undefined} strokeWidth={1.5} />
              </Button>
            }
          />
          <p className="text-xs text-muted-foreground">
            Orders count every order through the shop&apos;s own link; paid sales count paid orders only, the same numbers partners see.
          </p>
        </Section>
      </PageBody>

      {selected ? (
        <EditSheet
          open={panelOpen}
          onOpenChange={setPanelOpen}
          title={selected.name || "Unnamed partner"}
          description={[storeLabel(selected.storeType), selected.specialty].filter(Boolean).join(" · ")}
          onSubmit={(event) => event.preventDefault()}
          footer={
            <Button type="button" variant="ghost" size="sm" onClick={() => setPanelOpen(false)}>
              Close
            </Button>
          }
        >
          <DetailList
            title="Contact"
            items={[
              ["Mobile", selected.mobile],
              ["Email", selected.email],
              ["Clinic address", selected.address],
            ]}
          />
          <DetailList
            title="Network"
            items={[
              ["Store type", storeLabel(selected.storeType)],
              ["Referred by", selected.referrerId ? `${referrerLabel(selected)}${selected.referrerStoreType ? ` · ${storeLabel(selected.referrerStoreType)}` : ""}` : "Direct sign-up"],
              ["Main store", selected.mainStoreName],
              ["Joined", day(selected.joinedAt)],
            ]}
          />
          <DetailList
            title="Sales through the shop link"
            items={[
              ["Orders", count(selected.orders)],
              ["Paid sales", peso(selected.sales)],
            ]}
          />
        </EditSheet>
      ) : null}
    </>
  );
}
