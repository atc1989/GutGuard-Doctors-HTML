"use client";

import { useEffect, useMemo, useState } from "react";
import { Send } from "lucide-react";
import { Alert, PageBody } from "@/components/admin/blocks";
import { Field, FieldGroup } from "@/components/admin/form";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { Switch } from "@/components/admin/ui/switch";
import { Textarea } from "@/components/admin/ui/textarea";
import {
  getPartnerReferralEmailSettings,
  savePartnerReferralEmailSettings,
  sendPartnerReferralEmailTest,
  type RegistrationEmailSettings,
} from "@/lib/api";

const empty: RegistrationEmailSettings = { enabled: true, subject: "", replyTo: "", bodyText: "", html: "", attachments: [], updatedAt: "", fromLabel: "" };
const TOKENS = ["{{partner_name}}", "{{new_partner_name}}", "{{new_partner_specialty}}", "{{new_partner_location}}", "{{registered_at}}", "{{dashboard_url}}"];

// Preview only. The values mirror what send-partner-referral-notification fills in, and the
// rendering below copies its render() and renderBodyText() so the preview matches the real email.
const SAMPLE: Record<string, string> = {
  partner_name: "Dr. Angela Lim",
  new_partner_name: "Dr. Marco Reyes",
  new_partner_specialty: "Family Medicine",
  new_partner_location: "Makati City",
  registered_at: new Date().toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }),
  dashboard_url: "https://partners.gutguard.ph/partner",
};
const escapeHtml = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const render = (value: string) =>
  value.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => escapeHtml(SAMPLE[key] ?? `{{${key}}}`));
const renderBodyText = (value: string) =>
  `<div style="font-family:Arial,sans-serif;color:#0F0F18;line-height:1.6">${escapeHtml(value)
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`)
    .join("")}</div>`;

const when = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
};

export default function ReferralEmailAdminPage() {
  const [settings, setSettings] = useState(empty);
  const [saved, setSaved] = useState(empty);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [testEmail, setTestEmail] = useState("");

  // AdminShell only renders this page once the admin session is valid.
  useEffect(() => {
    getPartnerReferralEmailSettings()
      .then((loaded) => {
        setSettings(loaded);
        setSaved(loaded);
      })
      .catch((error) => setMessage({ tone: "error", text: error instanceof Error ? error.message : "Unable to load settings." }))
      .finally(() => setIsLoading(false));
  }, []);

  const set = (patch: Partial<RegistrationEmailSettings>) => setSettings((current) => ({ ...current, ...patch }));

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const next = await savePartnerReferralEmailSettings(settings);
      setSettings(next);
      setSaved(next);
      setMessage({ tone: "info", text: "Referral notification template saved." });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Unable to save settings." });
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setMessage(null);
    try {
      const next = await savePartnerReferralEmailSettings(settings);
      setSettings(next);
      setSaved(next);
      await sendPartnerReferralEmailTest(testEmail);
      setMessage({ tone: "info", text: `Saved, and sent a test to ${testEmail}.` });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Unable to send test." });
    } finally {
      setBusy(false);
    }
  }

  async function copyToken(token: string) {
    try {
      await navigator.clipboard.writeText(token);
      setMessage({ tone: "info", text: `Copied ${token}.` });
    } catch {
      setMessage({ tone: "error", text: `Couldn't copy. Type ${token} into the template instead.` });
    }
  }

  const complete = settings.subject.trim().length > 0 && (settings.html.trim().length > 0 || settings.bodyText.trim().length > 0);
  const dirty = JSON.stringify(settings) !== JSON.stringify(saved);
  const canSave = !busy && !isLoading && complete && dirty;

  const preview = useMemo(() => {
    const template = settings.html.trim() || (settings.bodyText.trim() ? renderBodyText(settings.bodyText) : "");
    return { subject: render(settings.subject), html: template ? render(template) : "" };
  }, [settings.subject, settings.html, settings.bodyText]);

  return (
    <PageBody>
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="referral-enabled" className="text-[13px] font-normal">
                Send automatically
              </Label>
              <p className="text-xs text-muted-foreground">
                Sent once to the referring partner when a clinic they referred finishes registering.
              </p>
            </div>
            <Switch id="referral-enabled" checked={settings.enabled} disabled={isLoading} onCheckedChange={(enabled) => set({ enabled })} />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Subject" htmlFor="referral-subject">
              <Input id="referral-subject" value={settings.subject} disabled={isLoading} onChange={(event) => set({ subject: event.target.value })} />
            </Field>
            <Field label="Reply-to" htmlFor="referral-reply-to">
              <Input
                id="referral-reply-to"
                type="email"
                value={settings.replyTo}
                disabled={isLoading}
                onChange={(event) => set({ replyTo: event.target.value })}
              />
            </Field>
          </div>

          <Field label="Plain-text fallback" htmlFor="referral-body" hint="Used by email apps that don't show HTML, and for the email when the HTML is empty.">
            <Textarea id="referral-body" rows={6} value={settings.bodyText} disabled={isLoading} onChange={(event) => set({ bodyText: event.target.value })} />
          </Field>

          <Field label="HTML template" htmlFor="referral-html">
            <Textarea
              id="referral-html"
              rows={16}
              value={settings.html}
              disabled={isLoading}
              spellCheck={false}
              className="font-mono text-xs md:text-xs"
              onChange={(event) => set({ html: event.target.value })}
            />
          </Field>

          <FieldGroup title="Placeholders">
            <div className="flex flex-wrap gap-1.5">
              {TOKENS.map((token) => (
                <button key={token} type="button" onClick={() => copyToken(token)} className="rounded focus-ring" title="Copy">
                  <Badge className="cursor-pointer font-mono hover:bg-chrome">{token}</Badge>
                </button>
              ))}
            </div>
            <p className="-mt-1 text-xs text-muted-foreground">Click one to copy it, then paste it into the subject, plain text or HTML.</p>
          </FieldGroup>
        </div>

        <aside className="flex min-w-0 flex-col gap-3 xl:sticky xl:top-6 xl:self-start" aria-label="Email preview">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[13px] font-medium">Preview</h2>
            <Badge title="Sample names and dates fill the placeholders here; the real email uses the partners' details." className="text-muted-foreground">
              Sample data
            </Badge>
          </div>
          <div className="overflow-hidden rounded-xl border border-border">
            <dl className="grid grid-cols-[56px_minmax(0,1fr)] gap-x-2 gap-y-1 border-b border-border bg-chrome px-4 py-3 text-[13px]">
              {saved.fromLabel ? (
                <>
                  <dt className="text-muted-foreground">From</dt>
                  <dd className="truncate">{saved.fromLabel}</dd>
                </>
              ) : null}
              <dt className="text-muted-foreground">Subject</dt>
              <dd className="truncate">
                {isLoading ? <Skeleton className="h-4 w-48" /> : preview.subject || <span className="text-subtle-foreground">No subject yet</span>}
              </dd>
            </dl>
            {preview.html ? (
              // sandbox="" = no scripts, no same-origin access: the template can only be looked at.
              <iframe title="Email preview" sandbox="" srcDoc={preview.html} className="block h-[560px] w-full bg-white" />
            ) : (
              <p className="flex h-40 items-center justify-center px-4 text-center text-[13px] text-muted-foreground">
                {isLoading ? "Loading…" : "Add HTML or plain text to see the email."}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <div className="flex w-full items-center gap-2">
              <Input
                type="email"
                aria-label="Test recipient email"
                placeholder="test@example.com"
                value={testEmail}
                onChange={(event) => setTestEmail(event.target.value)}
                className="h-8 min-w-0 flex-1 rounded-lg text-[13px] md:text-[13px]"
                title="Saves your changes, then sends to this address."
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={sendTest}
                disabled={busy || isLoading || !complete || !testEmail.trim()}
                title="Saves your changes, then sends to this address."
                className="h-8 rounded-lg shadow-none"
              >
                <Send strokeWidth={1.5} />
                {dirty ? "Save and send test" : "Send test"}
              </Button>
              <Button type="button" size="sm" onClick={save} disabled={!canSave} className="h-8 rounded-lg">
                {busy ? "Working" : "Save"}
              </Button>
            </div>
            {saved.updatedAt ? <p className="text-right text-xs text-muted-foreground">Saved {when(saved.updatedAt)}</p> : null}
          </div>
        </aside>
      </div>
    </PageBody>
  );
}
