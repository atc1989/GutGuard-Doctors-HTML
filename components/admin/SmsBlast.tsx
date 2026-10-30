"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Check, RefreshCw, Send } from "lucide-react";
import { Alert, FilterTabs, PageBody, Section, StatusDot } from "@/components/admin/blocks";
import { CellStack, DataTable } from "@/components/admin/data-table/data-table";
import { ConfirmDialog, EditSheet, Field, FieldGroup } from "@/components/admin/form";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { Textarea } from "@/components/admin/ui/textarea";
import {
  getDoctorRegistrations,
  getSmsBlastHistory,
  sendSmsBlast,
  type AdminDoctorRegistration,
  type SmsBlastResponse,
  type SmsSendHistory,
} from "@/lib/api";
import { formatPrefixedName } from "@/lib/validation";

type Tab = "compose" | "sent";
type Status = SmsSendHistory["status"];
type Result = SmsBlastResponse["results"][number];
type PastSend = { key: string; title: string; message: string; sentAt: string; rows: SmsSendHistory[]; counts: Record<Status, number> };

const STATUS_VIEW: Record<Status, [string, "green" | "red" | "gray"]> = {
  sent: ["Sent", "green"],
  failed: ["Failed", "red"],
  skipped: ["Skipped", "gray"],
};
// send-sms-blast refuses anything longer.
const MAX_LENGTH = 1_600;

// Preview only. Same keys as the replacements in supabase/functions/send-sms-blast, so the
// preview fills exactly the placeholders the real send fills; unknown ones are left as typed.
const SAMPLE: Record<string, string> = {
  doctor_name: "Maria Santos",
  name_prefix: "Dr.",
  prefixed_name: "Dr. Maria Santos",
  doctor_mobile: "+639171234567",
  specialty: "Internal Medicine",
  clinic_location: "Makati City",
  registered_at: "Jun 12, 2026",
  prize_label: "PHP 50 GCash",
};
const TOKENS = Object.keys(SAMPLE).map((key) => `{{${key}}}`);
const render = (message: string) => message.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => SAMPLE[key] ?? match);

// Plain text fits 160 characters per SMS (153 when split); emoji or accents drop it to 70 (67).
function segmentsOf(message: string) {
  const unicode = /[^\u0000-\u007f]/.test(message);
  const single = unicode ? 70 : 160;
  const segments = message.length === 0 ? 0 : message.length <= single ? 1 : Math.ceil(message.length / (unicode ? 67 : 153));
  return { characters: message.length, single, segments, unicode };
}

// Same rules as normalizeSmsMobile in send-sms-blast: only PH mobiles get a message.
function phMobile(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (/^09\d{9}$/.test(digits)) return `+63${digits.slice(1)}`;
  if (/^639\d{9}$/.test(digits)) return `+${digits}`;
  if (/^9\d{9}$/.test(digits)) return `+63${digits}`;
  return "";
}
const showMobile = (mobile: string) => mobile.replace(/^\+63(\d{3})(\d{3})(\d{4})$/, "+63 $1 $2 $3");

const nameOf = (doctor: AdminDoctorRegistration) => formatPrefixedName(doctor.name_prefix, doctor.full_name) || "Unnamed partner";
const day = (value: string) => new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
const when = (value: string) =>
  new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
const searchText = (doctor: AdminDoctorRegistration) =>
  [doctor.full_name, doctor.email, doctor.mobile, phMobile(doctor.mobile), doctor.specialty, doctor.practice_location].join(" ");
const summary = (counts: Record<Status, number>) => `Sent ${counts.sent}, failed ${counts.failed}, skipped ${counts.skipped}.`;
const smsCount = (count: number) => `${count.toLocaleString()} SMS`;

function groupSends(history: SmsSendHistory[]): PastSend[] {
  const groups = new Map<string, PastSend>();
  for (const row of history) {
    const key = row.sms_campaign_id ?? `${row.sms_campaign_title}|${row.sent_at.slice(0, 16)}`;
    const group = groups.get(key) ?? { key, title: row.sms_campaign_title || "SMS blast", message: row.message, sentAt: row.sent_at, rows: [], counts: { sent: 0, failed: 0, skipped: 0 } };
    group.rows.push(row);
    group.counts[row.status] += 1;
    if (row.sent_at < group.sentAt) group.sentAt = row.sent_at;
    groups.set(key, group);
  }
  return [...groups.values()];
}

export default function SmsBlast() {
  const [tab, setTab] = useState<Tab>("compose");
  const [doctors, setDoctors] = useState<AdminDoctorRegistration[]>([]);
  const [history, setHistory] = useState<SmsSendHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);

  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const textRef = useRef<HTMLTextAreaElement>(null);

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
      const [loadedDoctors, loadedHistory] = await Promise.all([getDoctorRegistrations(), getSmsBlastHistory()]);
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

  // Placeholders go in where the cursor is (or replace the selected text).
  function insertToken(token: string) {
    const field = textRef.current;
    const start = field?.selectionStart ?? text.length;
    const end = field?.selectionEnd ?? text.length;
    const next = (text.slice(0, start) + token + text.slice(end)).slice(0, MAX_LENGTH);
    setText(next);
    // After React has written the new value, put the cursor just after the placeholder.
    setTimeout(() => {
      field?.focus();
      field?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  async function send() {
    setIsSending(true);
    setMessage(null);
    try {
      const response = await sendSmsBlast(selected, title.trim(), text.trim());
      setResults(Object.fromEntries(response.results.map((result) => [result.doctorId, result])));
      setMessage({ tone: response.failed ? "error" : "info", text: summary(response) });
      // Cleared so a second click can't send the same message twice.
      setSelected([]);
      setConfirmOpen(false);
      setHistory(await getSmsBlastHistory());
    } catch (caught) {
      setMessage({ tone: "error", text: caught instanceof Error ? caught.message : "Could not send the SMS." });
      setConfirmOpen(false);
    } finally {
      setIsSending(false);
    }
  }

  const recipients = useMemo(() => doctors.filter((doctor) => phMobile(doctor.mobile)), [doctors]);
  const doctorById = useMemo(() => new Map(doctors.map((doctor) => [doctor.id, doctor])), [doctors]);
  const latestByDoctor = useMemo(() => {
    const latest: Record<string, SmsSendHistory> = {};
    for (const row of history) if (!latest[row.doctor_id] || row.sent_at > latest[row.doctor_id].sent_at) latest[row.doctor_id] = row;
    return latest;
  }, [history]);
  const pastSends = useMemo(() => groupSends(history), [history]);
  const used = useMemo(() => new Set((text.match(/\{\{\s*[a-zA-Z0-9_]+\s*\}\}/g) ?? []).map((token) => token.replace(/\s+/g, ""))), [text]);
  const preview = render(text.trim());
  const typed = segmentsOf(text);
  const sample = segmentsOf(preview);
  const selectedMobiles = useMemo(() => recipients.filter((doctor) => selected.includes(doctor.id)).map((doctor) => phMobile(doctor.mobile)), [recipients, selected]);

  const missing = !title.trim() ? "Add a campaign name first." : !text.trim() ? "Write the message first." : !selected.length ? "Tick at least one partner." : "";

  const columns = useMemo<ColumnDef<AdminDoctorRegistration, unknown>[]>(
    () => [
      {
        id: "partner",
        accessorFn: nameOf,
        meta: { label: "Partner" },
        cell: ({ row }) => <CellStack title={nameOf(row.original)} sub={showMobile(phMobile(row.original.mobile))} />,
      },
      { id: "location", accessorKey: "practice_location", meta: { label: "Location" } },
      {
        id: "last",
        accessorFn: (doctor) => latestByDoctor[doctor.id]?.sent_at ?? "",
        meta: { label: "Last SMS" },
        cell: ({ row }) => {
          const last = latestByDoctor[row.original.id];
          return last ? <CellStack title={last.sms_campaign_title || "SMS blast"} sub={day(last.sent_at)} /> : <span className="text-subtle-foreground">Never</span>;
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
        id: "campaign",
        accessorKey: "title",
        meta: { label: "Campaign" },
        cell: ({ row }) => <CellStack title={row.original.title} sub={<span className="block max-w-sm truncate">{row.original.message}</span>} />,
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

  const left = doctors.length - recipients.length;

  return (
    <>
      <PageBody>
        <div className="flex items-center justify-between gap-3">
          <FilterTabs
            label="SMS view"
            value={tab}
            onChange={setTab}
            tabs={[
              { value: "compose" as Tab, label: "Compose" },
              { value: "sent" as Tab, label: "Past sends", count: pastSends.length },
            ]}
          />
          <Button variant="outline" size="icon-sm" onClick={load} disabled={isLoading} aria-label="Refresh" title="Refresh partners and past sends" className="rounded-lg shadow-none">
            <RefreshCw className={isLoading ? "animate-spin" : undefined} strokeWidth={1.5} />
          </Button>
        </div>

        {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}

        {tab === "compose" ? (
          <>
            <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
              <div className="flex min-w-0 flex-col gap-5">
                <Field label="Campaign name" htmlFor="sms-title" hint="Only you see this, in Past sends.">
                  <Input id="sms-title" value={title} placeholder="June booth reminder" onChange={(event) => setTitle(event.target.value)} />
                </Field>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="sms-message" className="text-[13px] font-normal">
                    Message
                  </Label>
                  <Textarea
                    ref={textRef}
                    id="sms-message"
                    rows={5}
                    maxLength={MAX_LENGTH}
                    value={text}
                    placeholder="Hi {{prefixed_name}}, your GutGuard update…"
                    onChange={(event) => setText(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {typed.characters.toLocaleString()} / {typed.single} · {smsCount(typed.segments)} per partner
                    {typed.unicode ? " · emoji or accents: 70 characters per SMS" : ""}
                  </p>
                </div>

                <FieldGroup title="Placeholders">
                  <div className="flex flex-wrap gap-1.5">
                    {TOKENS.map((token) => (
                      <button key={token} type="button" onClick={() => insertToken(token)} className="rounded focus-ring" title="Insert at the cursor">
                        <Badge className="cursor-pointer gap-1 font-mono hover:bg-chrome">
                          {used.has(token) ? <Check className="size-3" strokeWidth={2} aria-hidden="true" /> : null}
                          {token}
                        </Badge>
                      </button>
                    ))}
                  </div>
                  <p className="-mt-1 text-xs text-muted-foreground">Click one to insert it at the cursor. Each partner&apos;s details fill it in.</p>
                </FieldGroup>
              </div>

              <aside className="flex min-w-0 flex-col gap-3" aria-label="SMS preview">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-[13px] font-medium">Preview</h2>
                  <Badge title="Sample names fill the placeholders here; each partner gets their own details." className="text-muted-foreground">
                    Sample data
                  </Badge>
                </div>
                <div className="flex min-h-48 flex-col justify-end rounded-xl border border-border bg-chrome p-4">
                  {preview ? (
                    <p className="max-w-[85%] self-start rounded-2xl rounded-bl-md border border-border bg-background px-3.5 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap">
                      {preview}
                    </p>
                  ) : (
                    <p className="self-center pb-12 text-[13px] text-muted-foreground">Write a message to see it here.</p>
                  )}
                </div>
                {preview ? (
                  <p className="text-xs text-muted-foreground tabular-nums">
                    This sample: {sample.characters.toLocaleString()} characters · {smsCount(sample.segments)}. Longer names can add one.
                  </p>
                ) : null}
              </aside>
            </div>

            <p className="text-xs text-muted-foreground">
              Sending needs an SMS gateway set up on the server (SMS_PROVIDER). Without one, sending stops with an error and nothing goes out.
            </p>

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
                emptyText="No partners with a PH mobile number yet."
              />
              {!isLoading && left > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {left.toLocaleString()} {left === 1 ? "partner isn't" : "partners aren't"} listed: no valid PH mobile number.
                </p>
              ) : null}
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
            emptyText="No SMS sent yet."
          />
        )}
      </PageBody>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Send to ${selected.length.toLocaleString()} ${selected.length === 1 ? "partner" : "partners"}?`}
        description={`About ${smsCount(selected.length * typed.segments)} in total (${smsCount(typed.segments)} each).`}
        confirmLabel="Send SMS"
        busy={isSending}
        onConfirm={send}
      >
        <div className="flex flex-col gap-2 text-[13px]">
          <p className="rounded-lg border border-border bg-chrome px-3 py-2 whitespace-pre-wrap">{preview}</p>
          <ul className="max-h-40 overflow-y-auto rounded-lg border border-border px-3 py-2 text-xs leading-6 tabular-nums">
            {selectedMobiles.map((mobile) => (
              <li key={mobile}>{showMobile(mobile)}</li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">Messages go out straight away and can&apos;t be recalled.</p>
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
          <FieldGroup title="Message">
            <p className="rounded-lg border border-border bg-chrome px-3 py-2 text-sm whitespace-pre-wrap">{openSend.message}</p>
          </FieldGroup>
          <FieldGroup title="Recipients">
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
              {openSend.rows.map((row) => {
                const doctor = doctorById.get(row.doctor_id);
                const [label, tone] = STATUS_VIEW[row.status];
                return (
                  <li key={row.id} className="flex items-start justify-between gap-3 px-3 py-2.5 text-[13px]">
                    <div className="min-w-0">
                      <p className="truncate">{doctor ? nameOf(doctor) : showMobile(row.mobile)}</p>
                      {doctor ? <p className="truncate text-muted-foreground tabular-nums">{showMobile(row.mobile)}</p> : null}
                      {row.error_message ? <p className="mt-1 text-xs text-down">{row.error_message}</p> : null}
                    </div>
                    <StatusDot tone={tone}>{label}</StatusDot>
                  </li>
                );
              })}
            </ul>
          </FieldGroup>
        </EditSheet>
      ) : null}
    </>
  );
}
