"use client";

import { useEffect, useState } from "react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import {
  getPartnerReferralEmailSettings,
  savePartnerReferralEmailSettings,
  sendPartnerReferralEmailTest,
  type RegistrationEmailSettings,
} from "@/lib/api";

const empty: RegistrationEmailSettings = { enabled: true, subject: "", replyTo: "", bodyText: "", html: "", attachments: [], updatedAt: "", fromLabel: "" };
const TOKENS = ["{{partner_name}}", "{{new_partner_name}}", "{{new_partner_specialty}}", "{{new_partner_location}}", "{{registered_at}}", "{{dashboard_url}}"];

export default function ReferralEmailAdminPage() {
  const [settings, setSettings] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [testEmail, setTestEmail] = useState("");

  // AdminShell only renders this page once the admin session is valid.
  useEffect(() => {
    setBusy(true);
    getPartnerReferralEmailSettings()
      .then(setSettings)
      .catch((error) => setMessage(error instanceof Error ? error.message : "Unable to load settings."))
      .finally(() => setBusy(false));
  }, []);

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      setSettings(await savePartnerReferralEmailSettings(settings));
      setMessage("Referral notification template saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save settings.");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setMessage("");
    try {
      setSettings(await savePartnerReferralEmailSettings(settings));
      await sendPartnerReferralEmailTest(testEmail);
      setMessage(`Test sent to ${testEmail}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to send test.");
    } finally {
      setBusy(false);
    }
  }

  const canSave = !busy && settings.subject.trim().length > 0 && (settings.html.trim().length > 0 || settings.bodyText.trim().length > 0);

  return (
    <div className="admin-wheel-shell admin-referral-email">
      <AdminPageHeader
        kicker="Partner referrals"
        title="Referral Email"
        description="Sent once to the referring partner after a successful attributed registration."
      />

      {message ? <div className="admin-wheel-alert" role="status">{message}</div> : null}

      <section className="admin-wheel-panel">
        <div className="admin-wheel-panel-head">
          <div>
            <p className="admin-wheel-kicker">Template</p>
            <h2>Notification email</h2>
          </div>
          <p>Partners receive this once, when a clinic they referred completes registration.</p>
        </div>

        <label className="admin-referral-toggle">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(event) => setSettings({ ...settings, enabled: event.target.checked })}
          />
          Enable automatic notifications
        </label>

        <label htmlFor="referral-subject">Subject</label>
        <input
          id="referral-subject"
          value={settings.subject}
          onChange={(event) => setSettings({ ...settings, subject: event.target.value })}
        />

        <label htmlFor="referral-reply-to">Reply-to</label>
        <input
          id="referral-reply-to"
          type="email"
          value={settings.replyTo}
          onChange={(event) => setSettings({ ...settings, replyTo: event.target.value })}
        />

        <label htmlFor="referral-body">Plain-text fallback</label>
        <textarea
          id="referral-body"
          rows={6}
          value={settings.bodyText}
          onChange={(event) => setSettings({ ...settings, bodyText: event.target.value })}
        />

        <label htmlFor="referral-html">HTML template</label>
        <textarea
          id="referral-html"
          rows={16}
          value={settings.html}
          onChange={(event) => setSettings({ ...settings, html: event.target.value })}
        />

        <aside className="admin-referral-tokens">
          <strong>Available placeholders</strong>
          <div>
            {TOKENS.map((token) => (
              <code key={token}>{token}</code>
            ))}
          </div>
        </aside>

        <div className="admin-referral-actions">
          <button type="button" onClick={save} disabled={!canSave}>
            {busy ? "Working" : "Save settings"}
          </button>
          <input
            type="email"
            aria-label="Test recipient email"
            placeholder="test@example.com"
            value={testEmail}
            onChange={(event) => setTestEmail(event.target.value)}
          />
          <button type="button" onClick={sendTest} disabled={busy || !testEmail.trim()}>
            Send test
          </button>
        </div>
      </section>
    </div>
  );
}
