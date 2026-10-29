"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Gift, Package, PackageX, Plus, RefreshCw, Trophy } from "lucide-react";
import { Alert, MetricCell, MetricStrip, PageBody, Section, StatusDot } from "@/components/admin/blocks";
import { CellStack, DataTable } from "@/components/admin/data-table/data-table";
import { RowActions } from "@/components/admin/data-table/row-actions";
import { EditSheet, Field, FieldGroup } from "@/components/admin/form";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { Switch } from "@/components/admin/ui/switch";
import { createWheelPrize, getWheelPrizes, saveWheelPrize, type AdminWheelPrize } from "@/lib/api";
import { cn } from "@/lib/utils";

const emptyPrize: AdminWheelPrize = {
  label: "",
  note: "",
  color: "#0608A9",
  text: "#F4F1EA",
  chance_weight: 1,
  total_stock: 0,
  remaining_stock: 0,
  is_active: true,
  sort_order: 0,
};

// GutGuard brand colours (styles/globals.css :root); "Custom" covers anything else.
const SWATCHES: [string, string][] = [
  ["Blue", "#0608A9"],
  ["Deep blue", "#04067A"],
  ["Gold", "#B08D5B"],
  ["Light gold", "#C9AC7E"],
  ["Bone", "#F4F1EA"],
  ["Ink", "#0F0F18"],
  ["White", "#FFFFFF"],
];
const isHex = (value: string) => /^#[0-9a-f]{6}$/i.test(value);
const byOrder = (a: AdminWheelPrize, b: AdminWheelPrize) => a.sort_order - b.sort_order;
const onWheel = (prize: AdminWheelPrize) => prize.is_active && prize.remaining_stock > 0 && prize.chance_weight > 0;
const weightTotal = (prizes: AdminWheelPrize[]) => prizes.reduce((sum, prize) => sum + (onWheel(prize) ? prize.chance_weight : 0), 0);
// Same maths as the spin: a prize's weight over the weights of every prize that can land.
const oddsOf = (prize: AdminWheelPrize, total: number) => (onWheel(prize) && total > 0 ? (prize.chance_weight / total) * 100 : 0);
const pct = (value: number) => `${value.toFixed(value > 0 && value < 1 ? 2 : 1)}%`;

function statusOf(prize: AdminWheelPrize): [string, "green" | "amber" | "gray"] {
  if (!prize.is_active) return ["Off", "gray"];
  if (prize.remaining_stock <= 0) return ["Out of stock", "amber"];
  if (prize.chance_weight <= 0) return ["Weight 0, never lands", "amber"];
  return ["On the wheel", "green"];
}

function PrizeChip({ prize }: { prize: Pick<AdminWheelPrize, "label" | "color" | "text"> }) {
  return (
    <span
      className="inline-flex h-6 max-w-56 items-center truncate rounded-md border border-black/10 px-2 text-[13px] font-medium"
      style={{ backgroundColor: prize.color, color: prize.text }}
    >
      {prize.label || "Prize name"}
    </span>
  );
}

function ColourField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  const custom = isHex(value) && !SWATCHES.some(([, hex]) => hex.toLowerCase() === value.toLowerCase());
  const ring = "size-7 rounded-full border border-black/15 focus-ring";
  const picked = "ring-2 ring-foreground ring-offset-2 ring-offset-background";
  return (
    <Field label={label} htmlFor={id} hint={isHex(value) ? undefined : "Use a 6-digit hex code, like #0608A9."}>
      <div className="flex flex-wrap items-center gap-2">
        {SWATCHES.map(([name, hex]) => (
          <button
            key={hex}
            type="button"
            title={name}
            aria-label={name}
            aria-pressed={value.toLowerCase() === hex.toLowerCase()}
            onClick={() => onChange(hex)}
            className={cn(ring, value.toLowerCase() === hex.toLowerCase() && picked)}
            style={{ backgroundColor: hex }}
          />
        ))}
        <label title="Custom colour" className={cn(ring, "relative cursor-pointer overflow-hidden", custom && picked)}>
          <span className="sr-only">Custom colour</span>
          <span
            aria-hidden="true"
            className="absolute inset-0"
            style={{ background: custom ? value : "conic-gradient(#e11d48, #f59e0b, #16a34a, #0ea5e9, #6366f1, #e11d48)" }}
          />
          <input type="color" value={isHex(value) ? value : "#000000"} onChange={(event) => onChange(event.target.value.toUpperCase())} className="absolute inset-0 cursor-pointer opacity-0" />
        </label>
        <Input id={id} value={value} maxLength={7} spellCheck={false} onChange={(event) => onChange(event.target.value.trim())} className="ml-1 w-28 font-mono" />
      </div>
    </Field>
  );
}

export default function WheelPrizesPage() {
  const [prizes, setPrizes] = useState<AdminWheelPrize[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Edit / new panel; the open flag is separate so it keeps its content while sliding out.
  const [draft, setDraft] = useState<AdminWheelPrize | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function loadPrizes() {
    setIsLoading(true);
    setError(null);
    try {
      setPrizes((await getWheelPrizes()).sort(byOrder));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load prizes.");
    } finally {
      setIsLoading(false);
    }
  }

  // AdminShell only renders this page once the admin session is valid.
  useEffect(() => {
    loadPrizes();
  }, []);

  const open = (prize: AdminWheelPrize) => {
    setDraft({ ...prize });
    setPanelOpen(true);
    setError(null);
  };
  const openNew = () => open({ ...emptyPrize, sort_order: Math.max(0, ...prizes.map((prize) => prize.sort_order)) + 1 });

  const merge = (saved: AdminWheelPrize) =>
    setPrizes((current) => (current.some((prize) => prize.id === saved.id) ? current.map((prize) => (prize.id === saved.id ? saved : prize)) : [...current, saved]).sort(byOrder));

  async function toggle(prize: AdminWheelPrize) {
    setSavingId(prize.id ?? null);
    setError(null);
    setNotice(null);
    try {
      const saved = await saveWheelPrize({ ...prize, is_active: !prize.is_active });
      merge(saved);
      setNotice(`${saved.label} is ${saved.is_active ? "back on the wheel" : "off the wheel"}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this prize.");
    } finally {
      setSavingId(null);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      const { id, ...fields } = draft;
      const saved = id ? await saveWheelPrize(draft) : await createWheelPrize(fields);
      merge(saved);
      setNotice(`${saved.label} ${id ? "saved" : "added to the wheel"}.`);
      setPanelOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this prize.");
    } finally {
      setIsSaving(false);
    }
  }

  const total = weightTotal(prizes);
  const stats = useMemo(() => {
    const live = prizes.filter(onWheel);
    const best = live.reduce<AdminWheelPrize | null>((top, prize) => (!top || prize.chance_weight > top.chance_weight ? prize : top), null);
    return {
      live: live.length,
      left: prizes.reduce((sum, prize) => sum + Math.max(0, prize.remaining_stock), 0),
      given: prizes.reduce((sum, prize) => sum + Math.max(0, prize.total_stock - prize.remaining_stock), 0),
      out: prizes.filter((prize) => prize.is_active && prize.remaining_stock <= 0).length,
      best,
    };
  }, [prizes]);

  const columns = useMemo<ColumnDef<AdminWheelPrize, unknown>[]>(
    () => [
      { id: "order", accessorKey: "sort_order", meta: { label: "#" }, cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{row.original.sort_order}</span> },
      {
        id: "prize",
        accessorKey: "label",
        meta: { label: "Prize" },
        cell: ({ row }) => <CellStack title={<PrizeChip prize={row.original} />} sub={row.original.note || undefined} />,
      },
      {
        id: "odds",
        accessorFn: (prize) => oddsOf(prize, total),
        meta: { label: "Odds", align: "right" },
        cell: ({ row }) => <CellStack title={<span className="tabular-nums">{pct(oddsOf(row.original, total))}</span>} sub={`weight ${row.original.chance_weight}`} />,
      },
      {
        id: "stock",
        accessorKey: "remaining_stock",
        meta: { label: "Stock" },
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums">
            {row.original.remaining_stock} of {row.original.total_stock} left
          </span>
        ),
      },
      {
        id: "status",
        accessorFn: (prize) => statusOf(prize)[0],
        meta: { label: "Status" },
        cell: ({ row }) => {
          const [label, tone] = statusOf(row.original);
          return <StatusDot tone={tone}>{label}</StatusDot>;
        },
      },
      {
        id: "actions",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
          const prize = row.original;
          return (
            <div className="flex justify-end">
              <RowActions
                label={`Actions for ${prize.label}`}
                actions={[
                  { label: "Edit", onSelect: () => open(prize) },
                  { label: prize.is_active ? "Turn off" : "Turn on", disabled: savingId === prize.id, onSelect: () => toggle(prize) },
                ]}
              />
            </div>
          );
        },
      },
    ],
    // open and toggle only use state setters and the row they're given.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [total, savingId],
  );

  // Odds the edited prize would have once saved, against everything else as it is now.
  const draftOdds = draft ? oddsOf(draft, weightTotal([...prizes.filter((prize) => !draft.id || prize.id !== draft.id), draft])) : 0;
  const setNumber = (key: "chance_weight" | "total_stock" | "remaining_stock" | "sort_order", value: string) =>
    setDraft((current) => (current ? { ...current, [key]: Math.max(0, Math.floor(Number(value) || 0)) } : current));
  const canSave = Boolean(draft && draft.label.trim() && isHex(draft.color) && isHex(draft.text) && !isSaving);

  return (
    <>
      <MetricStrip>
        <MetricCell label="On the wheel" icon={Gift} loading={isLoading} value={stats.live} footer={["Total prizes", prizes.length]} />
        <MetricCell label="Prizes left" icon={Package} loading={isLoading} value={stats.left.toLocaleString()} footer={["Given out", stats.given.toLocaleString()]} />
        <MetricCell label="Out of stock" icon={PackageX} loading={isLoading} value={stats.out} />
        <MetricCell
          label="Most likely"
          icon={Trophy}
          loading={isLoading}
          value={
            stats.best ? (
              <span className="flex min-w-0 items-baseline gap-2 text-xl">
                <span className="truncate">{stats.best.label}</span>
                <span className="text-muted-foreground tabular-nums">{pct(oddsOf(stats.best, total))}</span>
              </span>
            ) : (
              <span className="text-xl text-subtle-foreground">Nothing on the wheel</span>
            )
          }
        />
      </MetricStrip>

      <PageBody>
        {error && !panelOpen ? <Alert tone="error">{error}</Alert> : null}
        {notice ? <Alert>{notice}</Alert> : null}
        {!isLoading && prizes.length > 0 && stats.live === 0 ? (
          <Alert tone="warning">No prize can land right now: every prize is off, out of stock or has weight 0.</Alert>
        ) : null}

        <Section
          actions={
            <div className="flex w-full items-center justify-end gap-2">
              <Button variant="outline" size="icon-sm" onClick={loadPrizes} disabled={isLoading} aria-label="Refresh prizes" title="Refresh prizes" className="rounded-lg shadow-none">
                <RefreshCw className={isLoading ? "animate-spin" : undefined} strokeWidth={1.5} />
              </Button>
              <Button size="sm" onClick={openNew} className="h-8 rounded-lg text-[13px]">
                <Plus strokeWidth={1.5} />
                New prize
              </Button>
            </div>
          }
        >
          <DataTable
            data={prizes}
            columns={columns}
            loading={isLoading && prizes.length === 0}
            toolbar={false}
            onRowClick={open}
            initialSort={[{ id: "order", desc: false }]}
            emptyText="No prizes yet."
          />
        </Section>
      </PageBody>

      {draft ? (
        <EditSheet
          open={panelOpen}
          onOpenChange={(isOpen) => !isOpen && setPanelOpen(false)}
          title={draft.id ? draft.label || "Prize" : "New prize"}
          description={draft.id ? <StatusDot tone={statusOf(draft)[1]}>{statusOf(draft)[0]}</StatusDot> : "A new segment on the spin wheel."}
          onSubmit={submit}
          footer={
            <>
              <Button type="button" variant="ghost" size="sm" onClick={() => setPanelOpen(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={!canSave}>
                {isSaving ? "Saving" : draft.id ? "Save" : "Create prize"}
              </Button>
            </>
          }
        >
          {error ? <Alert tone="error">{error}</Alert> : null}

          <Field label="Prize name" htmlFor="prize-label">
            <Input id="prize-label" value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} />
          </Field>
          <Field label="Note" htmlFor="prize-note" hint="Shown under the prize name.">
            <Input id="prize-note" value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} />
          </Field>

          <FieldGroup title="Colours">
            <div className="flex items-center justify-center rounded-lg border border-border bg-chrome p-5">
              <PrizeChip prize={draft} />
            </div>
            <ColourField id="prize-color" label="Segment" value={draft.color} onChange={(color) => setDraft({ ...draft, color })} />
            <ColourField id="prize-text" label="Text" value={draft.text} onChange={(text) => setDraft({ ...draft, text })} />
          </FieldGroup>

          <FieldGroup title="Odds and stock">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Weight" htmlFor="prize-weight" hint="Higher lands more often.">
                <Input id="prize-weight" type="number" min={0} value={draft.chance_weight} onChange={(event) => setNumber("chance_weight", event.target.value)} />
              </Field>
              <Field label="Wheel order" htmlFor="prize-order">
                <Input id="prize-order" type="number" min={0} value={draft.sort_order} onChange={(event) => setNumber("sort_order", event.target.value)} />
              </Field>
              <Field label="Total stock" htmlFor="prize-total">
                <Input id="prize-total" type="number" min={0} value={draft.total_stock} onChange={(event) => setNumber("total_stock", event.target.value)} />
              </Field>
              <Field label="Remaining" htmlFor="prize-remaining" hint={draft.remaining_stock > draft.total_stock ? "More than the total stock." : undefined}>
                <Input id="prize-remaining" type="number" min={0} value={draft.remaining_stock} onChange={(event) => setNumber("remaining_stock", event.target.value)} />
              </Field>
            </div>
            <p className="text-[13px]">
              Odds after saving: <span className="font-medium tabular-nums">{pct(draftOdds)}</span>
              {draftOdds === 0 ? <span className="text-muted-foreground"> (off, out of stock or weight 0)</span> : null}
            </p>
          </FieldGroup>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="prize-active" className="text-[13px] font-normal">
                On the wheel
              </Label>
              <p className="text-xs text-muted-foreground">Switch off to take it off the wheel without losing its stock.</p>
            </div>
            <Switch id="prize-active" checked={draft.is_active} onCheckedChange={(is_active) => setDraft({ ...draft, is_active })} />
          </div>
        </EditSheet>
      ) : null}
    </>
  );
}
