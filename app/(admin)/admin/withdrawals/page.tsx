"use client";

import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Check, CircleCheck, CircleX, Clock, Copy, RefreshCw, Wallet } from "lucide-react";
import { Alert, FilterTabs, MetricCell, MetricStrip, PageBody, Section, StatusDot } from "@/components/admin/blocks";
import { CellStack, DataTable } from "@/components/admin/data-table/data-table";
import { RowActions } from "@/components/admin/data-table/row-actions";
import { ConfirmDialog, DetailList, EditSheet, Field } from "@/components/admin/form";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Textarea } from "@/components/admin/ui/textarea";
import type { AdminWithdrawal } from "@/lib/admin-server-api";

type Status = AdminWithdrawal["status"];
type Tab = Status | "all";

const money = (value: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 }).format(value);
const when = (value: string) =>
  new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));

const METHODS: Record<string, string> = { gcash: "GCash", maya: "Maya", bank: "Bank" };
const STATUS_VIEW: Record<Status, [string, "amber" | "green" | "gray"]> = {
  pending: ["Pending", "amber"],
  approved: ["Approved", "green"],
  rejected: ["Rejected", "gray"],
};

const net = (item: AdminWithdrawal) => item.amount - item.fee;
const payTo = (item: AdminWithdrawal) => (item.method === "bank" ? `Bank · ${item.bank_name}` : METHODS[item.method] ?? item.method);
const account = (item: AdminWithdrawal) => [item.account_name, item.account_number].filter(Boolean).join(" · ");
const partnerName = (item: AdminWithdrawal) => item.partner_name || "Unnamed partner";
const searchText = (item: AdminWithdrawal) =>
  [item.partner_name, item.partner_email, item.partner_mobile, item.account_name, item.account_number, item.bank_name, item.reference].join(" ");

/** Partners request payouts from /partner/wallet; admin sends the money, then approves here with the reference. */
export default function AdminWithdrawalsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawal[]>([]);
  const [tab, setTab] = useState<Tab>("pending");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Details panel; the open flag is separate so it keeps its content while sliding out.
  const [selected, setSelected] = useState<AdminWithdrawal | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  // Approve / reject window and its required field (transfer reference or reason).
  const [acting, setActing] = useState<{ item: AdminWithdrawal; status: "approved" | "rejected" } | null>(null);
  const [actingOpen, setActingOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function load(clearError = true) {
    setIsLoading(true);
    if (clearError) setError(null);
    try {
      const res = await fetch("/api/admin/withdrawals");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not load withdrawals.");
      setWithdrawals(data.withdrawals);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load withdrawals.");
    } finally {
      setIsLoading(false);
    }
  }

  // AdminShell only renders this page once the admin session is valid.
  useEffect(() => {
    load();
  }, []);

  const open = (item: AdminWithdrawal) => {
    setSelected(item);
    setPanelOpen(true);
    setCopied(false);
  };
  const startAction = (item: AdminWithdrawal, status: "approved" | "rejected") => {
    setActing({ item, status });
    setActingOpen(true);
    setInput("");
  };

  async function process() {
    if (!acting || !input.trim()) return;
    const { item, status } = acting;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(status === "approved" ? { id: item.id, status, reference: input } : { id: item.id, status, note: input }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not update the withdrawal.");
      setNotice(status === "approved" ? `Approved ${money(net(item))} to ${partnerName(item)}.` : `Rejected ${partnerName(item)}'s withdrawal.`);
      setActingOpen(false);
      setPanelOpen(false);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update the withdrawal.");
      setActingOpen(false);
      // The row may have changed meanwhile (another admin, a double submit), so show what is true now.
      await load(false);
    } finally {
      setBusy(false);
    }
  }

  async function copyAccount(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const metrics = useMemo(() => {
    const by = (status: Status) => withdrawals.filter((item) => item.status === status);
    const thisMonth = new Date().getFullYear() * 12 + new Date().getMonth();
    const approved = by("approved");
    return {
      pending: by("pending"),
      approved,
      rejected: by("rejected"),
      approvedThisMonth: approved.filter((item) => {
        const at = new Date(item.processed_at ?? item.created_at);
        return at.getFullYear() * 12 + at.getMonth() === thisMonth;
      }).length,
      paidOut: approved.reduce((sum, item) => sum + net(item), 0),
      fees: approved.reduce((sum, item) => sum + item.fee, 0),
    };
  }, [withdrawals]);

  const rows = useMemo(() => (tab === "all" ? withdrawals : withdrawals.filter((item) => item.status === tab)), [withdrawals, tab]);

  const columns = useMemo<ColumnDef<AdminWithdrawal, unknown>[]>(
    () => [
      {
        id: "partner",
        accessorFn: partnerName,
        meta: { label: "Partner" },
        cell: ({ row }) => <CellStack title={partnerName(row.original)} sub={row.original.partner_mobile || row.original.partner_email || undefined} />,
      },
      {
        id: "requested",
        accessorKey: "created_at",
        meta: { label: "Requested", csv: (item) => item.created_at },
        cell: ({ row }) => <span className="whitespace-nowrap">{when(row.original.created_at)}</span>,
      },
      { id: "amount", accessorKey: "amount", meta: { label: "Amount", align: "right" }, cell: ({ row }) => money(row.original.amount) },
      { id: "fee", accessorKey: "fee", meta: { label: "Fee", align: "right" }, cell: ({ row }) => money(row.original.fee) },
      {
        id: "send",
        accessorFn: net,
        meta: { label: "Send", align: "right" },
        cell: ({ row }) => (
          <CellStack title={money(net(row.original))} sub={`${money(row.original.amount)} − ${money(row.original.fee)}`} />
        ),
      },
      {
        id: "method",
        accessorFn: (item) => METHODS[item.method] ?? item.method,
        meta: { label: "Pay to", csv: (item) => `${payTo(item)} · ${account(item)}` },
        cell: ({ row }) => <CellStack title={payTo(row.original)} sub={account(row.original) || undefined} />,
      },
      {
        id: "status",
        accessorFn: (item) => STATUS_VIEW[item.status]?.[0] ?? item.status,
        meta: { label: "Status" },
        cell: ({ row }) => {
          const [label, tone] = STATUS_VIEW[row.original.status] ?? [row.original.status, "gray"];
          return (
            <CellStack
              title={<StatusDot tone={tone}>{label}</StatusDot>}
              sub={row.original.processed_at ? when(row.original.processed_at) : undefined}
            />
          );
        },
      },
      { id: "reference", accessorKey: "reference", meta: { label: "Reference" } },
      { id: "note", accessorKey: "admin_note", meta: { label: "Admin note" } },
      {
        id: "actions",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <RowActions
              label={`Actions for ${partnerName(row.original)}'s withdrawal`}
              actions={[
                { label: "View details", onSelect: () => open(row.original) },
                ...(row.original.status === "pending"
                  ? [
                      { label: "Approve", onSelect: () => startAction(row.original, "approved") },
                      { label: "Reject", destructive: true, onSelect: () => startAction(row.original, "rejected") },
                    ]
                  : []),
              ]}
            />
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <>
      <MetricStrip>
        <MetricCell
          label="Pending"
          icon={Clock}
          loading={isLoading}
          value={metrics.pending.length}
          footer={["To send", money(metrics.pending.reduce((sum, item) => sum + net(item), 0))]}
        />
        <MetricCell label="Approved" icon={CircleCheck} loading={isLoading} value={metrics.approved.length} footer={["This month", metrics.approvedThisMonth]} />
        <MetricCell
          label="Rejected"
          icon={CircleX}
          loading={isLoading}
          value={metrics.rejected.length}
          footer={["Returned to wallets", money(metrics.rejected.reduce((sum, item) => sum + item.amount, 0))]}
        />
        <MetricCell label="Paid out" icon={Wallet} loading={isLoading} value={money(metrics.paidOut)} footer={["Fees kept", money(metrics.fees)]} />
      </MetricStrip>

      <PageBody>
        {error ? <Alert tone="error">{error}</Alert> : null}
        {notice ? <Alert>{notice}</Alert> : null}

        <Section
          actions={
            <FilterTabs
              label="Filter withdrawals by status"
              value={tab}
              onChange={setTab}
              tabs={[
                { value: "pending" as Tab, label: "Pending", count: metrics.pending.length },
                { value: "approved" as Tab, label: "Approved", count: metrics.approved.length },
                { value: "rejected" as Tab, label: "Rejected", count: metrics.rejected.length },
                { value: "all" as Tab, label: "All", count: withdrawals.length },
              ]}
            />
          }
        >
          <DataTable
            data={rows}
            columns={columns}
            loading={isLoading && withdrawals.length === 0}
            searchText={searchText}
            searchPlaceholder="Search withdrawals"
            facets={[{ column: "method", title: "Method" }]}
            exportName="gutguard-withdrawals"
            onRowClick={open}
            initialSort={[{ id: "requested", desc: true }]}
            initialHidden={["amount", "fee", "reference", "note"]}
            emptyText={tab === "all" ? "No withdrawals yet." : `No ${tab} withdrawals.`}
            actions={
              <Button variant="outline" size="icon-sm" onClick={() => load()} disabled={isLoading} aria-label="Refresh withdrawals" title="Refresh withdrawals" className="rounded-lg shadow-none">
                <RefreshCw className={isLoading ? "animate-spin" : undefined} strokeWidth={1.5} />
              </Button>
            }
          />
        </Section>
      </PageBody>

      {selected ? (
        <EditSheet
          open={panelOpen}
          onOpenChange={setPanelOpen}
          title={partnerName(selected)}
          description={
            <span className="inline-flex flex-wrap items-center gap-x-3">
              {when(selected.created_at)}
              <StatusDot tone={STATUS_VIEW[selected.status]?.[1] ?? "gray"}>{STATUS_VIEW[selected.status]?.[0] ?? selected.status}</StatusDot>
            </span>
          }
          onSubmit={(event) => event.preventDefault()}
          footer={
            selected.status === "pending" ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => startAction(selected, "rejected")}
                  className="mr-auto text-[13px] font-normal text-down hover:bg-down/5 hover:text-down"
                >
                  Reject
                </Button>
                <Button type="button" size="sm" onClick={() => startAction(selected, "approved")}>
                  Approve
                </Button>
              </>
            ) : (
              <Button type="button" variant="ghost" size="sm" onClick={() => setPanelOpen(false)}>
                Close
              </Button>
            )
          }
        >
          <DetailList
            title="Partner"
            items={[
              ["Name", partnerName(selected)],
              ["Mobile", selected.partner_mobile],
              ["Email", selected.partner_email],
            ]}
          />
          <DetailList
            title="Payout"
            items={[
              ["Amount", money(selected.amount)],
              ["Fee", money(selected.fee)],
              ["Send", <span key="send" className="font-medium">{money(net(selected))}</span>],
              ["Method", payTo(selected)],
              ["Account name", selected.account_name],
              [
                "Account number",
                selected.account_number ? (
                  <span key="account" className="inline-flex items-center gap-2">
                    <span className="tabular-nums">{selected.account_number}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => copyAccount(selected.account_number)}
                      aria-label={copied ? "Account number copied" : "Copy account number"}
                      title={copied ? "Copied" : "Copy"}
                      className="text-muted-foreground"
                    >
                      {copied ? <Check strokeWidth={1.5} /> : <Copy strokeWidth={1.5} />}
                    </Button>
                  </span>
                ) : (
                  ""
                ),
              ],
            ]}
          />
          <DetailList
            title="Status"
            items={[
              ["Status", STATUS_VIEW[selected.status]?.[0] ?? selected.status],
              ["Processed", selected.processed_at ? when(selected.processed_at) : ""],
              ["Reference", selected.reference],
              ["Note", selected.admin_note],
            ]}
          />
        </EditSheet>
      ) : null}

      <ConfirmDialog
        open={actingOpen}
        onOpenChange={setActingOpen}
        title={
          acting?.status === "approved"
            ? `Approve ${money(net(acting.item))} to ${partnerName(acting.item)}?`
            : "Reject this withdrawal?"
        }
        description={
          acting?.status === "approved"
            ? `Send ${money(net(acting.item))} to ${payTo(acting.item)} · ${account(acting.item)} first, then enter the transfer reference.`
            : acting
              ? `The full ${money(acting.item.amount)} goes back to the partner's wallet.`
              : undefined
        }
        confirmLabel={acting?.status === "approved" ? "Approve" : "Reject"}
        destructive={acting?.status === "rejected"}
        busy={busy}
        onConfirm={process}
      >
        {acting?.status === "approved" ? (
          <Field label="Transfer reference" htmlFor="withdrawal-reference">
            <Input id="withdrawal-reference" value={input} required maxLength={120} onChange={(event) => setInput(event.target.value)} autoFocus />
          </Field>
        ) : acting ? (
          <Field label="Reason" htmlFor="withdrawal-reason" hint="The partner sees this.">
            <Textarea id="withdrawal-reason" value={input} required maxLength={500} rows={3} onChange={(event) => setInput(event.target.value)} autoFocus />
          </Field>
        ) : null}
      </ConfirmDialog>
    </>
  );
}
