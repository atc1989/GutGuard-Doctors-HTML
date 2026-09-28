"use client";

import { FormEvent, useState } from "react";
import { getPartnerReferralEmailSettings, savePartnerReferralEmailSettings, sendPartnerReferralEmailTest, type RegistrationEmailSettings } from "@/lib/api";

const empty: RegistrationEmailSettings = { enabled: true, subject: "", replyTo: "", bodyText: "", html: "", attachments: [], updatedAt: "", fromLabel: "" };
const TOKENS = ["{{partner_name}}", "{{new_partner_name}}", "{{new_partner_specialty}}", "{{new_partner_location}}", "{{registered_at}}", "{{dashboard_url}}"];

export default function ReferralEmailAdminPage() {
  const [password, setPassword] = useState("");
  const [settings, setSettings] = useState(empty);
  const [unlocked, setUnlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [testEmail, setTestEmail] = useState("");

  async function unlock(event: FormEvent) { event.preventDefault(); setBusy(true); setMessage(""); try { setSettings(await getPartnerReferralEmailSettings(password)); setUnlocked(true); } catch { setMessage("Unable to load settings. Check the admin password."); } finally { setBusy(false); } }
  async function save() { setBusy(true); setMessage(""); try { setSettings(await savePartnerReferralEmailSettings(password, settings)); setMessage("Referral notification template saved."); } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save settings."); } finally { setBusy(false); } }
  async function sendTest() { setBusy(true); setMessage(""); try { const saved = await savePartnerReferralEmailSettings(password, settings); setSettings(saved); await sendPartnerReferralEmailTest(password, testEmail); setMessage(`Test sent to ${testEmail}.`); } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to send test."); } finally { setBusy(false); } }

  if (!unlocked) return <main className="admin-referral-email"><section><p className="shop-kicker">GutGuard admin</p><h1>Referral notification email</h1><form onSubmit={unlock}><label>Admin password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label><button className="shop-primary" disabled={busy}>{busy ? "Loading…" : "Open settings"}</button></form>{message ? <p role="alert">{message}</p> : null}</section></main>;
  return <main className="admin-referral-email"><section><p className="shop-kicker">Partner referrals</p><h1>Referral notification email</h1><p>Sent once to the referring partner after a successful attributed registration.</p>
    <label className="admin-referral-toggle"><input type="checkbox" checked={settings.enabled} onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })} /> Enable automatic notifications</label>
    <label>Subject<input value={settings.subject} onChange={(e) => setSettings({ ...settings, subject: e.target.value })} /></label>
    <label>Reply-to<input type="email" value={settings.replyTo} onChange={(e) => setSettings({ ...settings, replyTo: e.target.value })} /></label>
    <label>Plain-text fallback<textarea rows={6} value={settings.bodyText} onChange={(e) => setSettings({ ...settings, bodyText: e.target.value })} /></label>
    <label>HTML template<textarea rows={16} value={settings.html} onChange={(e) => setSettings({ ...settings, html: e.target.value })} /></label>
    <aside><strong>Available placeholders</strong><div>{TOKENS.map((token) => <code key={token}>{token}</code>)}</div></aside>
    <div className="admin-referral-actions"><button className="shop-primary" onClick={save} disabled={busy || !settings.subject.trim() || (!settings.html.trim() && !settings.bodyText.trim())}>Save settings</button><input type="email" aria-label="Test recipient email" placeholder="test@example.com" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} /><button className="shop-secondary" onClick={sendTest} disabled={busy || !testEmail.trim()}>Send test</button></div>
    {message ? <p role="status">{message}</p> : null}
  </section></main>;
}
