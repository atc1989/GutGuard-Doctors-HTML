"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Check, Download, FileCode, RefreshCw, Send, Upload, X } from "lucide-react";
import { Alert, FilterTabs, PageBody, Section, StatusDot } from "@/components/admin/blocks";
import { CellStack, DataTable } from "@/components/admin/data-table/data-table";
import { ConfirmDialog, EditSheet, Field, FieldGroup } from "@/components/admin/form";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import {
  getDoctorRegistrations,
  getNewsletterSendHistory,
  sendNewsletter,
  type AdminDoctorRegistration,
  type NewsletterResponse,
  type NewsletterSendHistory,
} from "@/lib/api";
import { formatPrefixedName } from "@/lib/validation";

type Tab = "compose" | "sent";
type Status = NewsletterSendHistory["status"];
type Result = NewsletterResponse["results"][number];
type PastSend = { key: string; title: string; subject: string; sentAt: string; rows: NewsletterSendHistory[]; counts: Record<Status, number> };

const STATUS_VIEW: Record<Status, [string, "green" | "red" | "gray"]> = {
  sent: ["Sent", "green"],
  failed: ["Failed", "red"],
  skipped: ["Skipped", "gray"],
};
const MAX_HTML_BYTES = 250_000;

// Preview only. Same keys as renderDoctorTemplate() in supabase/functions/send-newsletter, so the
// preview fills exactly the placeholders the real send fills; unknown ones are left as typed.
const SAMPLE: Record<string, string> = {
  doctor_name: "Maria Santos",
  name_prefix: "Dr.",
  prefixed_name: "Dr. Maria Santos",
  doctor_email: "maria.santos@example.com",
  doctor_mobile: "09171234567",
  specialty: "Internal Medicine",
  clinic_location: "Makati City",
  registered_at: "Jun 12, 2026",
  prize_label: "PHP 50 GCash",
};
const TOKENS = Object.keys(SAMPLE).map((key) => `{{${key}}}`);
const escapeHtml = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const render = (html: string) => html.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => (key in SAMPLE ? escapeHtml(SAMPLE[key]) : match));

const nameOf = (doctor: AdminDoctorRegistration) => formatPrefixedName(doctor.name_prefix, doctor.full_name) || "Unnamed partner";
const day = (value: string) => new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
const when = (value: string) =>
  new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
const searchText = (doctor: AdminDoctorRegistration) =>
  [doctor.full_name, doctor.email, doctor.mobile, doctor.specialty, doctor.practice_location].join(" ");
const summary = (counts: Record<Status, number>) => `Sent ${counts.sent}, failed ${counts.failed}, skipped ${counts.skipped}.`;

function groupSends(history: NewsletterSendHistory[]): PastSend[] {
  const groups = new Map<string, PastSend>();
  for (const row of history) {
    // Older rows have no newsletter_id; the subject plus the minute it went out keeps one send together.
    const key = row.newsletter_id ?? `${row.subject}|${row.sent_at.slice(0, 16)}`;
    const group = groups.get(key) ?? { key, title: row.newsletter_title || row.subject, subject: row.subject, sentAt: row.sent_at, rows: [], counts: { sent: 0, failed: 0, skipped: 0 } };
    group.rows.push(row);
    group.counts[row.status] += 1;
    if (row.sent_at < group.sentAt) group.sentAt = row.sent_at;
    groups.set(key, group);
  }
  return [...groups.values()];
}

export default function Newsletter() {
  const [tab, setTab] = useState<Tab>("compose");
  const [doctors, setDoctors] = useState<AdminDoctorRegistration[]>([]);
  const [history, setHistory] = useState<NewsletterSendHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);

  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [fileName, setFileName] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const [selected, setSelected] = useState<string[]>([]);
  const [results, setResults] = useState<Record<string, Result>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Past send panel; the open flag is separate so it keeps its content while sliding out.
  const [openSend, setOpenSend] = useState<PastSend | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  async function load() {
    setIsLoading(true);
    try {
      const [loadedDoctors, loadedHistory] = await Promise.all([getDoctorRegistrations(), getNewsletterSendHistory()]);
      setDoctors(loadedDoctors);
      setHistory(loadedHistory);
    } catch (caught) {
      setMessage({ tone: "error", text: caught instanceof Error ? caught.message : "Could not load partners." });
    } finally {
      setIsLoading(false);
    }
  }

  // AdminShell only renders this page once the admin session is valid.
  useEffect(() => {
    load();
  }, []);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // so picking the same file again still fires
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".html") && file.type !== "text/html") {
      setMessage({ tone: "error", text: "Upload a .html file." });
      return;
    }
    if (file.size > MAX_HTML_BYTES) {
      setMessage({ tone: "error", text: "Keep the HTML file under 250 KB." });
      return;
    }
    setMessage(null);
    setHtml(await file.text());
    setFileName(file.name);
    if (!subject.trim()) setSubject(file.name.replace(/\.html?$/i, "").replace(/[-_]+/g, " "));
  }

  async function copyToken(token: string) {
    try {
      await navigator.clipboard.writeText(token);
      setMessage({ tone: "info", text: `Copied ${token}.` });
    } catch {
      setMessage({ tone: "error", text: `Couldn't copy. Type ${token} into the HTML instead.` });
    }
  }

  async function send() {
    setIsSending(true);
    setMessage(null);
    try {
      const response = await sendNewsletter(selected, subject.trim(), html);
      setResults(Object.fromEntries(response.results.map((result) => [result.doctorId, result])));
      setMessage({ tone: response.failed ? "error" : "info", text: summary(response) });
      // Cleared so a second click can't send the same newsletter twice.
      setSelected([]);
      setConfirmOpen(false);
      setHistory(await getNewsletterSendHistory());
    } catch (caught) {
      setMessage({ tone: "error", text: caught instanceof Error ? caught.message : "Could not send the newsletter." });
      setConfirmOpen(false);
    } finally {
      setIsSending(false);
    }
  }

  const recipients = useMemo(() => doctors.filter((doctor) => doctor.email), [doctors]);
  const doctorById = useMemo(() => new Map(doctors.map((doctor) => [doctor.id, doctor])), [doctors]);
  const latestByDoctor = useMemo(() => {
    const latest: Record<string, NewsletterSendHistory> = {};
    for (const row of history) if (!latest[row.doctor_id] || row.sent_at > latest[row.doctor_id].sent_at) latest[row.doctor_id] = row;
    return latest;
  }, [history]);
  const pastSends = useMemo(() => groupSends(history), [history]);
  const found = useMemo(() => new Set((html.match(/\{\{\s*[a-zA-Z0-9_]+\s*\}\}/g) ?? []).map((token) => token.replace(/\s+/g, ""))), [html]);
  const preview = useMemo(() => (html.trim() ? render(html) : ""), [html]);
  const selectedEmails = useMemo(() => recipients.filter((doctor) => selected.includes(doctor.id)).map((doctor) => doctor.email), [recipients, selected]);

  const missing = !subject.trim() ? "Add a subject first." : !html.trim() ? "Upload the HTML first." : !selected.length ? "Tick at least one partner." : "";

  const columns = useMemo<ColumnDef<AdminDoctorRegistration, unknown>[]>(
    () => [
      {
        id: "partner",
        accessorFn: nameOf,
        meta: { label: "Partner" },
        cell: ({ row }) => <CellStack title={nameOf(row.original)} sub={row.original.email} />,
      },
      { id: "location", accessorKey: "practice_location", meta: { label: "Location" } },
      {
        id: "last",
        accessorFn: (doctor) => latestByDoctor[doctor.id]?.sent_at ?? "",
        meta: { label: "Last newsletter" },
        cell: ({ row }) => {
          const last = latestByDoctor[row.original.id];
          return last ? (
            <CellStack title={last.newsletter_title || last.subject} sub={day(last.sent_at)} />
          ) : (
            <span className="text-subtle-foreground">Never</span>
          );
        },
      },
      {
        id: "result",
        accessorFn: (doctor) => results[doctor.id]?.status ?? "",
        meta: { label: "Result" },
        cell: ({ row }) => {
          const result = results[row.original.id];
          if (!result) return null;
          const [label, tone] = STATUS_VIEW[result.status];
          return (
            <span title={result.error ?? undefined}>
              <StatusDot tone={tone}>{label}</StatusDot>
            </span>
          );
        },
      },
    ],
    [latestByDoctor, results],
  );

  const pastColumns = useMemo<ColumnDef<PastSend, unknown>[]>(
    () => [
      {
        id: "newsletter",
        accessorKey: "title",
        meta: { label: "Newsletter" },
        cell: ({ row }) => <CellStack title={row.original.title} sub={row.original.subject !== row.original.title ? row.original.subject : undefined} />,
      },
      { id: "date", accessorKey: "sentAt", meta: { label: "Sent on" }, cell: ({ row }) => <span className="whitespace-nowrap">{when(row.original.sentAt)}</span> },
      ...(["sent", "failed", "skipped"] as Status[]).map(
        (status): ColumnDef<PastSend, unknown> => ({
          id: status,
          accessorFn: (send) => send.counts[status],
          meta: { label: STATUS_VIEW[status][0], align: "right" },
          cell: ({ row }) => <span className={row.original.counts[status] ? undefined : "text-subtle-foreground"}>{row.original.counts[status]}</span>,
        }),
      ),
    ],
    [],
  );

  const refreshButton = (
    <Button variant="outline" size="icon-sm" onClick={load} disabled={isLoading} aria-label="Refresh" title="Refresh partners and past sends" className="rounded-lg shadow-none">
      <RefreshCw className={isLoading ? "animate-spin" : undefined} strokeWidth={1.5} />
    </Button>
  );

  return (
    <>
      <PageBody>
        <div className="flex items-center justify-between gap-3">
          <FilterTabs
            label="Newsletter view"
            value={tab}
            onChange={setTab}
            tabs={[
              { value: "compose" as Tab, label: "Compose" },
              { value: "sent" as Tab, label: "Past sends", count: pastSends.length },
            ]}
          />
          {refreshButton}
        </div>

        {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}

        {tab === "compose" ? (
          <>
            <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
              <div className="flex min-w-0 flex-col gap-5">
                <Field label="Subject" htmlFor="newsletter-subject">
                  <Input id="newsletter-subject" value={subject} placeholder="GutGuard Doctors Newsletter" onChange={(event) => setSubject(event.target.value)} />
                </Field>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[13px]">Email HTML</span>
                  <input ref={fileInput} type="file" accept=".html,text/html" hidden onChange={upload} />
                  {fileName ? (
                    <div className="flex items-center gap-2 rounded-lg border border-border p-2 pl-3 text-[13px]">
                      <FileCode className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate">{fileName}</span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => fileInput.current?.click()} className="h-7 text-[13px] font-normal">
                        Replace
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Remove the HTML file"
                        onClick={() => {
                          setHtml("");
                          setFileName("");
                        }}
                      >
                        <X strokeWidth={1.5} />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()} className="shadow-none">
                        <Upload strokeWidth={1.5} />
                        Upload HTML
                      </Button>
                      <span className="text-xs text-muted-foreground">A .html file under 250 KB.</span>
                    </div>
                  )}
                  <a href="/sample-upload-newsletter.html" download className="inline-flex w-fit items-center gap-1 rounded text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-ring">
                    <Download className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
                    Download a sample HTML
                  </a>
                </div>

                <FieldGroup title="Placeholders">
                  <div className="flex flex-wrap gap-1.5">
                    {TOKENS.map((token) => (
                      <button key={token} type="button" onClick={() => copyToken(token)} className="rounded focus-ring" title={found.has(token) ? "Used in this HTML. Click to copy." : "Click to copy."}>
                        <Badge className="cursor-pointer gap-1 font-mono hover:bg-chrome">
                          {found.has(token) ? <Check className="size-3" strokeWidth={2} aria-hidden="true" /> : null}
                          {token}
                        </Badge>
                      </button>
                    ))}
                  </div>
                  <p className="-mt-1 text-xs text-muted-foreground">Each partner&apos;s details fill these in. ✓ marks the ones your HTML uses.</p>
                </FieldGroup>
              </div>

              <aside className="flex min-w-0 flex-col gap-3" aria-label="Newsletter preview">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-[13px] font-medium">Preview</h2>
                  <Badge title="Sample names fill the placeholders here; each partner gets their own details." className="text-muted-foreground">
                    Sample data
                  </Badge>
                </div>
                <div className="overflow-hidden rounded-xl border border-border">
                  <dl className="grid grid-cols-[56px_minmax(0,1fr)] gap-x-2 border-b border-border bg-chrome px-4 py-3 text-[13px]">
                    <dt className="text-muted-foreground">Subject</dt>
                    <dd className="truncate">{subject.trim() || <span className="text-subtle-foreground">No subject yet</span>}</dd>
                  </dl>
                  {preview ? (
                    // sandbox="" = no scripts, no same-origin access: the upload can only be looked at.
                    <iframe title="Newsletter preview" sandbox="" srcDoc={preview} className="block h-[560px] w-full bg-white" />
                  ) : (
                    <p className="flex h-40 items-center justify-center px-4 text-center text-[13px] text-muted-foreground">Upload the HTML to see the email.</p>
                  )}
                </div>
              </aside>
            </div>

            <Section
              title="Recipients"
              count={recipients.length}
              actions={
                <div className="flex items-center gap-3">
                  {selected.length ? (
                    <button type="button" onClick={() => setSelected([])} className="rounded text-[13px] text-muted-foreground hover:text-foreground focus-ring">
                      {selected.length.toLocaleString()} selected · Clear
                    </button>
                  ) : null}
                  <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={Boolean(missing) || isSending} title={missing || undefined} className="h-8 rounded-lg text-[13px]">
                    <Send strokeWidth={1.5} />
                    Review and send
                  </Button>
                </div>
              }
            >
              <DataTable
                data={recipients}
                columns={columns}
                loading={isLoading && doctors.length === 0}
                searchText={searchText}
                searchPlaceholder="Search partners"
                selection={{ getId: (doctor) => doctor.id, selected, onChange: setSelected }}
                initialSort={[{ id: "partner", desc: false }]}
                emptyText="No partners with an email yet."
              />
            </Section>
          </>
        ) : (
          <DataTable
            data={pastSends}
            columns={pastColumns}
            loading={isLoading && history.length === 0}
            toolbar={false}
            onRowClick={(send) => {
              setOpenSend(send);
              setPanelOpen(true);
            }}
            initialSort={[{ id: "date", desc: true }]}
            emptyText="No newsletters sent yet."
          />
        )}
      </PageBody>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Send to ${selected.length.toLocaleString()} ${selected.length === 1 ? "partner" : "partners"}?`}
        description={subject.trim()}
        confirmLabel="Send newsletter"
        busy={isSending}
        onConfirm={send}
      >
        <div className="flex flex-col gap-2 text-[13px]">
          <p className="text-muted-foreground">{fileName}</p>
          <ul className="max-h-40 overflow-y-auto rounded-lg border border-border bg-chrome px-3 py-2 text-xs leading-6">
            {selectedEmails.map((email) => (
              <li key={email} className="truncate">
                {email}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">Emails go out straight away and can&apos;t be recalled.</p>
        </div>
      </ConfirmDialog>

      {openSend ? (
        <EditSheet
          open={panelOpen}
          onOpenChange={setPanelOpen}
          title={openSend.title}
          description={`${when(openSend.sentAt)} · ${summary(openSend.counts)}`}
          onSubmit={(event) => event.preventDefault()}
          footer={
            <Button type="button" variant="outline" size="sm" onClick={() => setPanelOpen(false)} className="shadow-none">
              Close
            </Button>
          }
        >
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {openSend.rows.map((row) => {
              const doctor = doctorById.get(row.doctor_id);
              const [label, tone] = STATUS_VIEW[row.status];
              return (
                <li key={row.id} className="flex items-start justify-between gap-3 px-3 py-2.5 text-[13px]">
                  <div className="min-w-0">
                    <p className="truncate">{doctor ? nameOf(doctor) : row.email}</p>
                    {doctor ? <p className="truncate text-muted-foreground">{row.email}</p> : null}
                    {row.error_message ? <p className="mt-1 text-xs text-down">{row.error_message}</p> : null}
                  </div>
                  <StatusDot tone={tone}>{label}</StatusDot>
                </li>
              );
            })}
          </ul>
        </EditSheet>
      ) : null}
    </>
  );
}
