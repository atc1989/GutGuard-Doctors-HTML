"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { CircleCheck, Download, FileCode, GripVertical, MousePointerClick, Paperclip, Plus, RefreshCw, Upload, Users, Workflow, X } from "lucide-react";
import { Alert, FilterTabs, MetricCell, MetricStrip, PageBody, StatusDot } from "@/components/admin/blocks";
import { CellStack, DataTable } from "@/components/admin/data-table/data-table";
import { RowActions } from "@/components/admin/data-table/row-actions";
import { ConfirmDialog, EditSheet, Field, FieldGroup } from "@/components/admin/form";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import {
  deleteSequenceStep,
  getSequenceProgress,
  getSequenceSteps,
  reorderSequenceSteps,
  resendSequenceStep,
  upsertSequenceStep,
  type SequenceAttachment,
  type SequenceProgress,
  type SequenceStep,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type Tab = "steps" | "partners";
type Draft = { id?: string; step_number: number; subject: string; html_body: string; attachments: SequenceAttachment[]; fileName: string };
type PendingSend = { row: SequenceProgress; step: number; resend: boolean };

const MAX_HTML_BYTES = 250_000;
// Steps are saved in one request with their attachments as base64 (a third bigger than the file);
// hosting caps a request at about 4.5 MB, so warn before that.
const ATTACHMENT_WARN_BYTES = 3_000_000;

// Preview only. Same keys as renderTemplate() / renderSubject() in supabase/functions/send-sequence-step.
const SAMPLE: Record<string, string> = {
  doctor_name: "Maria Santos",
  name_prefix: "Dr.",
  prefixed_name: "Dr. Maria Santos",
  doctor_email: "maria.santos@example.com",
  doctor_mobile: "09171234567",
  specialty: "Internal Medicine",
  clinic_location: "Makati City",
  routing_url: "https://partners.gutguard.ph/r/maria-santos",
  registered_at: "Jun 12, 2026",
  sequence_click_url: "#",
  next_step_number: "2",
};
const TOKENS = Object.keys(SAMPLE).map((key) => `{{${key}}}`);
const escapeHtml = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const render = (value: string, step: number, html: boolean) =>
  value.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
    const sample = key === "next_step_number" ? String(step + 1) : SAMPLE[key];
    return sample === undefined ? match : html ? escapeHtml(sample) : sample;
  });

const day = (value: string) => new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
const size = (bytes: number) => (bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`);
const nameOf = (row: SequenceProgress) => row.doctor_registrations?.full_name?.trim() || "Unnamed partner";
const lastClick = (row: SequenceProgress) =>
  row.email_sequence_sends
    .map((send) => send.clicked_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? "";
const fromStep = (step: SequenceStep): Draft => ({
  id: step.id,
  step_number: step.step_number,
  subject: step.subject,
  html_body: step.html_body,
  attachments: step.attachments ?? [],
  fileName: "",
});

function readBase64(file: File) {
  return new Promise<SequenceAttachment>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({ filename: file.name, content: String(reader.result).split(",")[1] ?? "", content_type: file.type || "application/octet-stream", size: file.size });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function EmailSequence() {
  const [tab, setTab] = useState<Tab>("steps");
  const [steps, setSteps] = useState<SequenceStep[]>([]);
  const [progress, setProgress] = useState<SequenceProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Step panel; the open flag is separate so it keeps its content while sliding out.
  const [draft, setDraft] = useState<Draft | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);
  const htmlInput = useRef<HTMLInputElement>(null);
  const filesInput = useRef<HTMLInputElement>(null);

  const [toDelete, setToDelete] = useState<SequenceStep | null>(null);
  const [pendingSend, setPendingSend] = useState<PendingSend | null>(null);
  // Which confirm window is open; the step / send above stay set so the window keeps its text while fading out.
  const [confirming, setConfirming] = useState<"delete" | "send" | null>(null);
  const openDelete = (step: SequenceStep) => {
    setToDelete(step);
    setConfirming("delete");
  };
  const openSend = (send: PendingSend) => {
    setPendingSend(send);
    setConfirming("send");
  };
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  async function load() {
    setIsLoading(true);
    try {
      const [loadedSteps, loadedProgress] = await Promise.all([getSequenceSteps(), getSequenceProgress()]);
      setSteps(loadedSteps.sort((a, b) => a.step_number - b.step_number));
      setProgress(loadedProgress.progress);
    } catch (caught) {
      setMessage({ tone: "error", text: caught instanceof Error ? caught.message : "Could not load the sequence." });
    } finally {
      setIsLoading(false);
    }
  }

  // AdminShell only renders this page once the admin session is valid.
  useEffect(() => {
    load();
  }, []);

  const openDraft = (next: Draft) => {
    setDraft(next);
    setPanelError(null);
    setPanelOpen(true);
  };

  async function reorder(ids: string[]) {
    const byId = new Map(steps.map((step) => [step.id, step]));
    const previous = steps;
    setSteps(ids.map((id, index) => ({ ...byId.get(id)!, step_number: index + 1 })));
    setMessage(null);
    try {
      await reorderSequenceSteps(ids);
      setMessage({ tone: "info", text: "Order saved." });
    } catch (caught) {
      setSteps(previous);
      setMessage({ tone: "error", text: caught instanceof Error ? caught.message : "Could not save the new order." });
    }
  }

  const move = (step: SequenceStep, by: -1 | 1) => {
    const ids = steps.map((item) => item.id!);
    const from = ids.indexOf(step.id!);
    const to = from + by;
    if (from < 0 || to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    reorder(ids);
  };

  function drop(targetId: string) {
    const ids = steps.map((item) => item.id!);
    const from = ids.indexOf(dragId ?? "");
    const to = ids.indexOf(targetId);
    setDragId(null);
    setOverId(null);
    if (from < 0 || to < 0 || from === to) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    reorder(ids);
  }

  async function uploadHtml(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !draft) return;
    if (!file.name.toLowerCase().endsWith(".html") && file.type !== "text/html") return setPanelError("Upload a .html file.");
    if (file.size > MAX_HTML_BYTES) return setPanelError("Keep the HTML file under 250 KB.");
    setPanelError(null);
    const html = await file.text();
    setDraft((current) =>
      current ? { ...current, html_body: html, fileName: file.name, subject: current.subject || file.name.replace(/\.html?$/i, "").replace(/[-_]+/g, " ") } : current,
    );
  }

  async function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    try {
      const added = await Promise.all(files.map(readBase64));
      setDraft((current) => (current ? { ...current, attachments: [...current.attachments, ...added] } : current));
    } catch {
      setPanelError("Couldn't read one of those files.");
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    setBusy(true);
    setPanelError(null);
    try {
      const saved = await upsertSequenceStep({
        id: draft.id,
        stepNumber: draft.step_number,
        subject: draft.subject.trim(),
        htmlBody: draft.html_body.trim(),
        attachments: draft.attachments,
      });
      setSteps((current) => (current.some((step) => step.id === saved.id) ? current.map((step) => (step.id === saved.id ? saved : step)) : [...current, saved]).sort((a, b) => a.step_number - b.step_number));
      setMessage({ tone: "info", text: `Step ${saved.step_number} saved.` });
      setPanelOpen(false);
    } catch (caught) {
      setPanelError(caught instanceof Error ? caught.message : "Could not save this step.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!toDelete?.id) return;
    setBusy(true);
    setMessage(null);
    try {
      await deleteSequenceStep(toDelete.id);
      setSteps((current) => current.filter((step) => step.id !== toDelete.id).map((step, index) => ({ ...step, step_number: index + 1 })));
      setMessage({ tone: "info", text: `Step ${toDelete.step_number} deleted.` });
      setPanelOpen(false);
    } catch (caught) {
      setMessage({ tone: "error", text: caught instanceof Error ? caught.message : "Could not delete this step." });
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  }

  async function confirmSend() {
    if (!pendingSend) return;
    const { row, step } = pendingSend;
    setBusy(true);
    setMessage(null);
    try {
      await resendSequenceStep(row.doctor_id, step);
      setMessage({ tone: "info", text: `Step ${step} sent to ${nameOf(row)}.` });
      setProgress((await getSequenceProgress()).progress);
    } catch (caught) {
      setMessage({ tone: "error", text: caught instanceof Error ? caught.message : "Could not send the step." });
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  }

  const total = steps.length;
  const onStep = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const row of progress) if (row.status === "active") counts[row.current_step] = (counts[row.current_step] ?? 0) + 1;
    return counts;
  }, [progress]);
  const stats = useMemo(
    () => ({
      active: progress.filter((row) => row.status === "active").length,
      finished: progress.filter((row) => row.status === "completed").length,
      clicked: progress.filter((row) => lastClick(row)).length,
    }),
    [progress],
  );

  const columns = useMemo<ColumnDef<SequenceProgress, unknown>[]>(() => {
    const statusOf = (row: SequenceProgress): [string, "green" | "ink" | "amber"] =>
      row.status === "completed" ? ["Finished", "green"] : row.current_step > total ? ["Step missing", "amber"] : ["In progress", "ink"];
    return [
      {
        id: "partner",
        accessorFn: nameOf,
        meta: { label: "Partner" },
        cell: ({ row }) => <CellStack title={nameOf(row.original)} sub={row.original.doctor_registrations?.email || undefined} />,
      },
      {
        id: "step",
        accessorKey: "current_step",
        meta: { label: "Step" },
        cell: ({ row }) =>
          row.original.current_step > total ? (
            <span className="whitespace-nowrap text-[#b45309]" title="This step was deleted after they got it. Send them a step that exists.">
              Step {row.original.current_step}: no longer exists
            </span>
          ) : (
            <span className="whitespace-nowrap tabular-nums">
              Step {row.original.current_step} of {total}
            </span>
          ),
      },
      {
        id: "status",
        accessorFn: (row) => statusOf(row)[0],
        meta: { label: "Status" },
        cell: ({ row }) => {
          const [label, tone] = statusOf(row.original);
          return <StatusDot tone={tone}>{label}</StatusDot>;
        },
      },
      {
        id: "enrolled",
        accessorKey: "enrolled_at",
        meta: { label: "Enrolled", csv: (row) => row.enrolled_at },
        cell: ({ row }) => <span className="whitespace-nowrap">{day(row.original.enrolled_at)}</span>,
      },
      {
        id: "clicked",
        accessorFn: lastClick,
        meta: { label: "Last clicked" },
        cell: ({ row }) => {
          const clicked = lastClick(row.original);
          return clicked ? <span className="whitespace-nowrap">{day(clicked)}</span> : <span className="text-subtle-foreground">Never</span>;
        },
      },
      {
        id: "actions",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
          const enrollment = row.original;
          const step = enrollment.current_step;
          const actions = [];
          if (enrollment.status === "active" && step <= total) actions.push({ label: `Resend step ${step}`, onSelect: () => openSend({ row: enrollment, step, resend: true }) });
          if (enrollment.status === "active" && step + 1 <= total) actions.push({ label: `Send step ${step + 1}`, onSelect: () => openSend({ row: enrollment, step: step + 1, resend: false }) });
          // A partner stuck on a deleted step can be put back on the last real one.
          if (enrollment.status === "active" && step > total && total > 0) actions.push({ label: `Send step ${total}`, onSelect: () => openSend({ row: enrollment, step: total, resend: false }) });
          return actions.length ? (
            <div className="flex justify-end">
              <RowActions label={`Actions for ${nameOf(enrollment)}`} actions={actions} />
            </div>
          ) : null;
        },
      },
    ];
  }, [total]);

  const attachmentBytes = draft?.attachments.reduce((sum, file) => sum + file.size, 0) ?? 0;
  const pendingStep = pendingSend ? steps.find((step) => step.step_number === pendingSend.step) : undefined;
  const deleteCount = toDelete ? onStep[toDelete.step_number] ?? 0 : 0;

  return (
    <>
      <MetricStrip>
        <MetricCell label="Enrolled" icon={Users} loading={isLoading} value={progress.length.toLocaleString()} />
        <MetricCell label="In progress" icon={Workflow} loading={isLoading} value={stats.active.toLocaleString()} />
        <MetricCell label="Finished" icon={CircleCheck} loading={isLoading} value={stats.finished.toLocaleString()} />
        <MetricCell label="Clicked a step" icon={MousePointerClick} loading={isLoading} value={stats.clicked.toLocaleString()} />
      </MetricStrip>

      <PageBody>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FilterTabs
            label="Email sequence view"
            value={tab}
            onChange={setTab}
            tabs={[
              { value: "steps" as Tab, label: "Steps", count: total },
              { value: "partners" as Tab, label: "Partners", count: progress.length },
            ]}
          />
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon-sm" onClick={load} disabled={isLoading} aria-label="Refresh" title="Refresh steps and partners" className="rounded-lg shadow-none">
              <RefreshCw className={isLoading ? "animate-spin" : undefined} strokeWidth={1.5} />
            </Button>
            {tab === "steps" ? (
              <Button size="sm" onClick={() => openDraft({ step_number: total + 1, subject: "", html_body: "", attachments: [], fileName: "" })} className="h-8 rounded-lg text-[13px]">
                <Plus strokeWidth={1.5} />
                New step
              </Button>
            ) : null}
          </div>
        </div>

        {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}

        {tab === "steps" ? (
          <>
            <p className="text-[13px] text-muted-foreground">
              New partners get step 1 when they register. Clicking the button in a step&apos;s email sends them the next step; after the last one they&apos;re finished.
            </p>
            {isLoading && !steps.length ? (
              <div className="h-16 animate-pulse rounded-xl border border-border bg-chrome" />
            ) : steps.length ? (
              <ol className="overflow-hidden rounded-xl border border-border">
                {steps.map((step, index) => (
                  <li
                    key={step.id}
                    draggable
                    onDragStart={() => setDragId(step.id ?? null)}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setOverId(step.id ?? null);
                    }}
                    onDragLeave={() => setOverId(null)}
                    onDrop={() => step.id && drop(step.id)}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverId(null);
                    }}
                    onClick={() => openDraft(fromStep(step))}
                    className={cn(
                      "flex h-16 cursor-pointer items-center gap-3 border-b border-border px-4 text-sm last:border-0 hover:bg-chrome/60",
                      dragId === step.id && "opacity-40",
                      overId === step.id && dragId !== step.id && "shadow-[inset_0_2px_0_var(--foreground)]",
                    )}
                  >
                    <GripVertical className="size-4 shrink-0 cursor-grab text-subtle-foreground" strokeWidth={1.5} aria-hidden="true" />
                    <span className="w-5 shrink-0 text-muted-foreground tabular-nums">{step.step_number}</span>
                    <span className="min-w-0 flex-1 truncate">{step.subject}</span>
                    <span className="hidden shrink-0 text-[13px] text-muted-foreground tabular-nums sm:inline">{(onStep[step.step_number] ?? 0).toLocaleString()} here</span>
                    {step.attachments?.length ? (
                      <Badge className="shrink-0 gap-1">
                        <Paperclip className="size-3" strokeWidth={1.5} aria-hidden="true" />
                        {step.attachments.length}
                      </Badge>
                    ) : null}
                    <RowActions
                      label={`Actions for step ${step.step_number}`}
                      actions={[
                        { label: "Edit", onSelect: () => openDraft(fromStep(step)) },
                        { label: "Move up", disabled: index === 0, onSelect: () => move(step, -1) },
                        { label: "Move down", disabled: index === steps.length - 1, onSelect: () => move(step, 1) },
                        { label: "Delete", destructive: true, onSelect: () => openDelete(step) },
                      ]}
                    />
                  </li>
                ))}
              </ol>
            ) : (
              <p className="rounded-xl border border-border px-4 py-10 text-center text-sm text-muted-foreground">No steps yet. New partners get nothing until you add step 1.</p>
            )}
          </>
        ) : (
          <DataTable
            data={progress}
            columns={columns}
            loading={isLoading && progress.length === 0}
            searchText={(row) => `${nameOf(row)} ${row.doctor_registrations?.email ?? ""}`}
            searchPlaceholder="Search partners"
            facets={[{ column: "status", title: "Status" }]}
            exportName="email-sequence-partners"
            initialSort={[{ id: "enrolled", desc: true }]}
            emptyText="No partners enrolled yet."
          />
        )}
      </PageBody>

      {draft ? (
        <EditSheet
          open={panelOpen}
          onOpenChange={(open) => !open && setPanelOpen(false)}
          size="wide"
          title={draft.id ? `Step ${draft.step_number}` : `New step ${draft.step_number}`}
          description={draft.id ? `${(onStep[draft.step_number] ?? 0).toLocaleString()} partners on this step` : "Goes out after the current last step."}
          onSubmit={save}
          footer={
            <>
              {draft.id ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => openDelete(steps.find((step) => step.id === draft.id)!)}
                  className="mr-auto text-[13px] font-normal text-down hover:bg-down/5 hover:text-down"
                >
                  Delete
                </Button>
              ) : null}
              <Button type="button" variant="ghost" size="sm" onClick={() => setPanelOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={busy || !draft.subject.trim() || !draft.html_body.trim()}>
                {busy ? "Saving" : "Save"}
              </Button>
            </>
          }
        >
          {panelError ? <Alert tone="error">{panelError}</Alert> : null}

          <Field label="Subject" htmlFor="step-subject">
            <Input id="step-subject" value={draft.subject} placeholder="Welcome to GutGuard Doctors, {{doctor_name}}" onChange={(event) => setDraft({ ...draft, subject: event.target.value })} />
          </Field>

          <div className="flex flex-col gap-1.5">
            <span className="text-[13px]">Email HTML</span>
            <input ref={htmlInput} type="file" accept=".html,text/html" hidden onChange={uploadHtml} />
            {draft.html_body ? (
              <div className="flex items-center gap-2 rounded-lg border border-border p-2 pl-3 text-[13px]">
                <FileCode className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{draft.fileName || `Saved HTML · ${draft.html_body.length.toLocaleString()} characters`}</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => htmlInput.current?.click()} className="h-7 text-[13px] font-normal">
                  Replace
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="outline" size="sm" onClick={() => htmlInput.current?.click()} className="shadow-none">
                  <Upload strokeWidth={1.5} />
                  Upload HTML
                </Button>
                <span className="text-xs text-muted-foreground">A .html file under 250 KB.</span>
              </div>
            )}
            <a href="/sample-upload-newsletter.html" download="sequence-template.html" className="inline-flex w-fit items-center gap-1 rounded text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-ring">
              <Download className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
              Download a template
            </a>
          </div>

          <FieldGroup title="Preview">
            <div className="overflow-hidden rounded-xl border border-border">
              <dl className="grid grid-cols-[56px_minmax(0,1fr)] gap-x-2 border-b border-border bg-chrome px-4 py-3 text-[13px]">
                <dt className="text-muted-foreground">Subject</dt>
                <dd className="truncate">{draft.subject.trim() ? render(draft.subject, draft.step_number, false) : <span className="text-subtle-foreground">No subject yet</span>}</dd>
              </dl>
              {draft.html_body.trim() ? (
                // sandbox="" = no scripts, no same-origin access: the template can only be looked at.
                <iframe title="Step preview" sandbox="" srcDoc={render(draft.html_body, draft.step_number, true)} className="block h-[420px] w-full bg-white" />
              ) : (
                <p className="flex h-32 items-center justify-center px-4 text-center text-[13px] text-muted-foreground">Upload the HTML to see the email.</p>
              )}
            </div>
            <p className="-mt-1 text-xs text-muted-foreground">Sample names fill the placeholders; the button links do nothing here.</p>
          </FieldGroup>

          <FieldGroup title="Placeholders">
            <div className="flex flex-wrap gap-1.5">
              {TOKENS.map((token) => (
                <button
                  key={token}
                  type="button"
                  className="rounded focus-ring"
                  title="Copy"
                  onClick={() =>
                    navigator.clipboard
                      .writeText(token)
                      .then(() => setPanelError(null))
                      .catch(() => setPanelError(`Couldn't copy. Type ${token} into the HTML instead.`))
                  }
                >
                  <Badge className="cursor-pointer font-mono hover:bg-chrome">{token}</Badge>
                </button>
              ))}
            </div>
            <p className="-mt-1 text-xs text-muted-foreground">
              Click to copy. Use <code className="font-mono">{"{{sequence_click_url}}"}</code> as the button link: clicking it sends the partner the next step.
            </p>
          </FieldGroup>

          <FieldGroup title="Attachments">
            <input ref={filesInput} type="file" multiple hidden onChange={addFiles} />
            {draft.attachments.length ? (
              <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
                {draft.attachments.map((file, index) => (
                  <li key={`${file.filename}-${index}`} className="flex items-center gap-2 py-1.5 pr-1.5 pl-3 text-[13px]">
                    <Paperclip className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{file.filename}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{size(file.size)}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${file.filename}`}
                      onClick={() => setDraft({ ...draft, attachments: draft.attachments.filter((_, item) => item !== index) })}
                    >
                      <X strokeWidth={1.5} />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
            <Button type="button" variant="outline" size="sm" onClick={() => filesInput.current?.click()} className="w-fit shadow-none">
              <Paperclip strokeWidth={1.5} />
              Add files
            </Button>
            {attachmentBytes > ATTACHMENT_WARN_BYTES ? (
              <Alert tone="warning">These files add up to {size(attachmentBytes)}. Large attachments may fail to save; link to big files from the email instead.</Alert>
            ) : null}
          </FieldGroup>
        </EditSheet>
      ) : null}

      <ConfirmDialog
        open={confirming === "delete"}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={`Delete step ${toDelete?.step_number ?? ""}?`}
        description={toDelete?.subject}
        confirmLabel="Delete step"
        destructive
        busy={busy}
        onConfirm={confirmDelete}
      >
        <p className="text-[13px] text-muted-foreground">
          {deleteCount ? `${deleteCount.toLocaleString()} ${deleteCount === 1 ? "partner is" : "partners are"} on this step. ` : ""}
          The steps after it move up one. Partners keep their step number, so anyone further along gets the step that moves into their number.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirming === "send"}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={pendingSend ? `${pendingSend.resend ? "Resend" : "Send"} step ${pendingSend.step} to ${nameOf(pendingSend.row)}?` : ""}
        description={pendingStep?.subject}
        confirmLabel={pendingSend?.resend ? "Resend email" : "Send email"}
        busy={busy}
        onConfirm={confirmSend}
      >
        <p className="text-[13px] text-muted-foreground">It goes to {pendingSend?.row.doctor_registrations?.email || "their email"} straight away.</p>
      </ConfirmDialog>
    </>
  );
}
