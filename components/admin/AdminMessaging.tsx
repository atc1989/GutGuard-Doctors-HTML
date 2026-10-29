"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useAdminAccess } from "@/components/admin/AdminShell";
import AdminPageHeader from "@/components/admin/AdminPageHeader";

type RegistrationEmailAttachment = {
  id?: string;
  filename: string;
  contentType: string;
  size: number;
  path?: string;
  base64Content?: string;
};

type RegistrationEmailSettings = {
  enabled: boolean;
  subject: string;
  replyTo: string;
  bodyText: string;
  html: string;
  attachments: RegistrationEmailAttachment[];
  updatedAt?: string;
  fromLabel?: string;
};

type SequenceAttachment = {
  filename: string;
  content: string; // base64
  content_type: string;
  size: number;
};

type SequenceStep = {
  id?: string;
  step_number: number;
  subject: string;
  html_body: string;
  attachments?: SequenceAttachment[];
  created_at?: string;
  updated_at?: string;
};

type SequenceProgress = {
  id: string;
  doctor_id: string;
  current_step: number;
  enrolled_at: string;
  status: "active" | "completed";
  doctor_registrations: { full_name: string | null; email: string | null } | null;
  email_sequence_sends: { sent_at: string; clicked_at: string | null; status: string; step_id: string }[];
};

const PUBLIC_SITE_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://partners.gutguard.ph").replace(
  /\/$/,
  "",
);
const REGISTRATION_EMAIL_TOKENS = [
  "{{doctor_name}}",
  "{{name_prefix}}",
  "{{prefixed_name}}",
  "{{doctor_email}}",
  "{{doctor_mobile}}",
  "{{specialty}}",
  "{{clinic_location}}",
  "{{routing_url}}",
  "{{registered_at}}",
];
const emptyRegistrationEmailSettings: RegistrationEmailSettings = {
  enabled: false,
  subject: "",
  replyTo: "",
  bodyText: "",
  html: "",
  attachments: [],
};

async function loadWheelApi() {
  return import("@/lib/api");
}

// Email sequence still uses this older page; each route picks its tab.
export type AdminMessagingTab = "registrationEmail" | "sequence";

const TAB_HEADERS: Record<AdminMessagingTab, { kicker: string; title: string; description: string }> = {
  sequence: { kicker: "Automation", title: "Email Sequence", description: "The onboarding emails new partners receive, in order." },
  registrationEmail: { kicker: "Automation", title: "Registration Email", description: "Replaced by Email Sequence." },
};

export default function AdminMessaging({ tab: activeTab }: { tab: AdminMessagingTab }) {
  const { can } = useAdminAccess();
  const [registrationEmail, setRegistrationEmail] = useState<RegistrationEmailSettings>(emptyRegistrationEmailSettings);
  const [registrationEmailFileName, setRegistrationEmailFileName] = useState("");
  const [registrationEmailFileError, setRegistrationEmailFileError] = useState<string | null>(null);
  const [registrationAttachmentError, setRegistrationAttachmentError] = useState<string | null>(null);
  const [showRegistrationEmailPreview, setShowRegistrationEmailPreview] = useState(false);
  const [showRegistrationEmailToggleConfirm, setShowRegistrationEmailToggleConfirm] = useState(false);
  const [showRegistrationEmailRemoveHtmlConfirm, setShowRegistrationEmailRemoveHtmlConfirm] = useState(false);
  const [pendingRegistrationEmailEnabled, setPendingRegistrationEmailEnabled] = useState(false);
  const [registrationEmailTestAddress, setRegistrationEmailTestAddress] = useState("");
  const [isRegistrationEmailSaving, setIsRegistrationEmailSaving] = useState(false);
  const [isRegistrationEmailRemovingHtml, setIsRegistrationEmailRemovingHtml] = useState(false);
  const [isRegistrationEmailTesting, setIsRegistrationEmailTesting] = useState(false);
  const [sequenceSteps, setSequenceSteps] = useState<SequenceStep[]>([]);
  const [sequenceProgress, setSequenceProgress] = useState<SequenceProgress[]>([]);
  const [sequenceTotalSteps, setSequenceTotalSteps] = useState(0);
  const [editingStep, setEditingStep] = useState<Partial<SequenceStep> | null>(null);
  const [isSavingStep, setIsSavingStep] = useState(false);
  const [isDeletingStepId, setIsDeletingStepId] = useState<string | null>(null);
  const [dragStepId, setDragStepId] = useState<string | null>(null);
  const [dragOverStepId, setDragOverStepId] = useState<string | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  const [previewStep, setPreviewStep] = useState<SequenceStep | null>(null);
  const [resendingKey, setResendingKey] = useState<string | null>(null);
  const [isSequenceLoading, setIsSequenceLoading] = useState(false);
  const [sequenceStepFileName, setSequenceStepFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const detectedRegistrationEmailPlaceholders = useMemo(() => {
    const source = `${registrationEmail.html}\n${registrationEmail.bodyText}`;
    return Array.from(new Set(source.match(/\{\{\s*[a-zA-Z0-9_]+\s*\}\}/g) ?? [])).map((token) =>
      token.replace(/\s+/g, ""),
    );
  }, [registrationEmail.bodyText, registrationEmail.html]);
  const registrationEmailPreviewHtml = useMemo(
    () => renderRegistrationEmailPreview(registrationEmail.html || renderBodyTextPreview(registrationEmail.bodyText)),
    [registrationEmail.bodyText, registrationEmail.html],
  );
  const registrationEmailHasBody =
    registrationEmail.html.trim().length > 0 || registrationEmail.bodyText.trim().length > 0;
  const canSaveRegistrationEmail =
    !registrationEmail.enabled ||
    (registrationEmail.subject.trim().length > 0 && registrationEmailHasBody);
  const canTestRegistrationEmail =
    registrationEmail.subject.trim().length > 0 &&
    registrationEmailHasBody &&
    registrationEmailTestAddress.trim().length > 0;

  // AdminShell only renders this page once the admin session is valid.
  useEffect(() => {
    loadAdminData().catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load admin data."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAdminData() {
    const api = await loadWheelApi();
    // The email settings come from edge functions; one failing must not blank the doctor list
    // (Orders' partner names and partner picker). Its error still shows in the banner.
    const showFailure = <T,>(fallback: T) => (caught: unknown) => {
      setError(caught instanceof Error ? caught.message : "Unable to load admin data.");
      return fallback;
    };

    // Staff logins only load the tabs they can open; the rest would be refused by the API.
    const [loadedRegistrationEmail, loadedSequence] = await Promise.all([
      can("referral-email")
        ? api.getRegistrationEmailSettings().catch(showFailure(emptyRegistrationEmailSettings))
        : Promise.resolve(emptyRegistrationEmailSettings),
      can("sequence") ? api.getSequenceSteps().catch(showFailure([])) : Promise.resolve([]),
    ]);
    setRegistrationEmail(loadedRegistrationEmail);
    setRegistrationEmailFileName(loadedRegistrationEmail.html ? "Saved registration email HTML" : "");
    setSequenceSteps(loadedSequence.sort((a, b) => a.step_number - b.step_number));
  }

  async function handleRegistrationEmailUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setRegistrationEmailFileError(null);

    if (!file) {
      setRegistrationEmailFileName("");
      setRegistrationEmail((current) => ({ ...current, html: "" }));
      return;
    }

    if (!file.name.toLowerCase().endsWith(".html") && file.type !== "text/html") {
      setRegistrationEmailFileName("");
      setRegistrationEmailFileError("Please upload a .html email template.");
      return;
    }

    if (file.size > 250_000) {
      setRegistrationEmailFileName("");
      setRegistrationEmailFileError("Please keep the HTML file under 250 KB.");
      return;
    }

    const content = await file.text();
    setRegistrationEmailFileName(file.name);
    setRegistrationEmail((current) => ({
      ...current,
      html: content,
      subject: current.subject || file.name.replace(/\.html?$/i, "").replace(/[-_]+/g, " "),
    }));
  }

  async function handleRegistrationAttachmentUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    setRegistrationAttachmentError(null);
    event.target.value = "";

    if (files.length === 0) return;

    const currentAttachments = registrationEmail.attachments;
    if (currentAttachments.length + files.length > 5) {
      setRegistrationAttachmentError("Upload up to 5 attachments only.");
      return;
    }

    const nextFiles: RegistrationEmailAttachment[] = [];
    let totalBytes = currentAttachments.reduce((sum, item) => sum + item.size, 0);

    for (const file of files) {
      if (!["application/pdf", "image/png", "image/jpeg"].includes(file.type)) {
        setRegistrationAttachmentError(`${file.name} must be a PDF, PNG, or JPG.`);
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        setRegistrationAttachmentError(`${file.name} must be 10 MB or smaller.`);
        return;
      }

      totalBytes += file.size;
      if (totalBytes > 20 * 1024 * 1024) {
        setRegistrationAttachmentError("Total attachments must be 20 MB or smaller.");
        return;
      }

      nextFiles.push({
        id: `local-${crypto.randomUUID()}`,
        filename: file.name,
        contentType: file.type,
        size: file.size,
        base64Content: await fileToBase64(file),
      });
    }

    setRegistrationEmail((current) => ({
      ...current,
      attachments: [...current.attachments, ...nextFiles],
    }));
  }

  function removeRegistrationAttachment(index: number) {
    setRegistrationAttachmentError(null);
    setRegistrationEmail((current) => ({
      ...current,
      attachments: current.attachments.filter((_, currentIndex) => currentIndex !== index),
    }));
  }

  function requestRegistrationEmailToggle(enabled: boolean) {
    setPendingRegistrationEmailEnabled(enabled);
    setShowRegistrationEmailToggleConfirm(true);
  }

  function confirmRegistrationEmailToggle() {
    setRegistrationEmail((current) => ({ ...current, enabled: pendingRegistrationEmailEnabled }));
    setShowRegistrationEmailToggleConfirm(false);
    setNotice(pendingRegistrationEmailEnabled ? "Registration email enabled. Save settings to apply." : "Registration email disabled. Save settings to apply.");
  }

  async function saveRegistrationEmailSettings() {
    if (registrationEmail.enabled && (!registrationEmail.subject.trim() || !registrationEmailHasBody)) {
      setError("Add a subject and either body text or an HTML template before enabling the registration email.");
      return;
    }

    setError(null);
    setNotice(null);
    setIsRegistrationEmailSaving(true);

    try {
      const api = await loadWheelApi();
      if (!api.saveRegistrationEmailSettings) {
        throw new Error("Missing saveRegistrationEmailSettings helper in lib/api.ts.");
      }

      const saved = await api.saveRegistrationEmailSettings({
        ...registrationEmail,
        subject: registrationEmail.subject.trim(),
        replyTo: registrationEmail.replyTo.trim(),
        bodyText: registrationEmail.bodyText.trim(),
        html: registrationEmail.html.trim(),
      });
      setRegistrationEmail(saved);
      setRegistrationEmailFileName(saved.html ? "Saved registration email HTML" : "");
      setNotice("Registration email settings saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save registration email settings.");
    } finally {
      setIsRegistrationEmailSaving(false);
    }
  }

  async function removeRegistrationEmailHtml() {
    setError(null);
    setNotice(null);
    setIsRegistrationEmailRemovingHtml(true);

    try {
      const api = await loadWheelApi();
      if (!api.saveRegistrationEmailSettings) {
        throw new Error("Missing saveRegistrationEmailSettings helper in lib/api.ts.");
      }

      const saved = await api.saveRegistrationEmailSettings({
        ...registrationEmail,
        enabled: registrationEmail.bodyText.trim().length > 0 ? registrationEmail.enabled : false,
        html: "",
      });
      setRegistrationEmail(saved);
      setRegistrationEmailFileName("");
      setRegistrationEmailFileError(null);
      setShowRegistrationEmailRemoveHtmlConfirm(false);
      setNotice(
        registrationEmail.bodyText.trim().length > 0
          ? "Registration email HTML removed. Body text will be used for automatic sends."
          : "Registration email HTML removed and automatic sending disabled.",
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to remove registration email HTML.");
    } finally {
      setIsRegistrationEmailRemovingHtml(false);
    }
  }

  async function sendRegistrationEmailTest() {
    if (!canTestRegistrationEmail) {
      setError("Enter a subject, add body text or upload an HTML template, and add a test email.");
      return;
    }

    setError(null);
    setNotice(null);
    setIsRegistrationEmailTesting(true);

    try {
      const api = await loadWheelApi();
      if (!api.saveRegistrationEmailSettings) {
        throw new Error("Missing saveRegistrationEmailSettings helper in lib/api.ts.");
      }
      if (!api.sendRegistrationEmailTest) {
        throw new Error("Missing sendRegistrationEmailTest helper in lib/api.ts.");
      }

      const saved = await api.saveRegistrationEmailSettings({
        ...registrationEmail,
        subject: registrationEmail.subject.trim(),
        replyTo: registrationEmail.replyTo.trim(),
        bodyText: registrationEmail.bodyText.trim(),
        html: registrationEmail.html.trim(),
      });
      setRegistrationEmail(saved);
      await api.sendRegistrationEmailTest(registrationEmailTestAddress.trim());
      setNotice(`Test registration email sent to ${registrationEmailTestAddress.trim()}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to send test registration email.");
    } finally {
      setIsRegistrationEmailTesting(false);
    }
  }

  async function handleResendStep(doctorId: string, stepNumber: number, key: string) {
    setError(null);
    setResendingKey(key);
    try {
      const api = await loadWheelApi();
      if (!api.resendSequenceStep) throw new Error("Missing resendSequenceStep helper.");
      await api.resendSequenceStep(doctorId, stepNumber);
      setNotice(`Step ${stepNumber} sent to doctor.`);
      await refreshSequence();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to send step.");
    } finally {
      setResendingKey(null);
    }
  }

  async function handleDropStep(targetId: string) {
    if (!dragStepId || dragStepId === targetId) { setDragStepId(null); setDragOverStepId(null); return; }
    const reordered = [...sequenceSteps];
    const fromIndex = reordered.findIndex((s) => s.id === dragStepId);
    const toIndex = reordered.findIndex((s) => s.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    const renumbered = reordered.map((s, i) => ({ ...s, step_number: i + 1 }));
    setSequenceSteps(renumbered);
    setDragStepId(null);
    setDragOverStepId(null);
    setIsReordering(true);
    try {
      const api = await loadWheelApi();
      if (!api.reorderSequenceSteps) throw new Error("Missing reorderSequenceSteps helper.");
      await api.reorderSequenceSteps(renumbered.map((s) => s.id!));
      setNotice("Sequence reordered.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to reorder steps.");
      await refreshSequence();
    } finally {
      setIsReordering(false);
    }
  }

  async function refreshSequence() {
    setIsSequenceLoading(true);
    try {
      const api = await loadWheelApi();
      const [steps, prog] = await Promise.all([
        api.getSequenceSteps ? api.getSequenceSteps() : Promise.resolve([]),
        api.getSequenceProgress ? api.getSequenceProgress() : Promise.resolve({ progress: [], totalSteps: 0 }),
      ]);
      setSequenceSteps(steps.sort((a, b) => a.step_number - b.step_number));
      setSequenceProgress(prog.progress);
      setSequenceTotalSteps(prog.totalSteps);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load sequence.");
    } finally {
      setIsSequenceLoading(false);
    }
  }

  async function handleSaveSequenceStep() {
    if (!editingStep) return;
    if (!editingStep.subject?.trim()) { setError("Step subject is required."); return; }
    if (!editingStep.html_body?.trim()) { setError("Step HTML is required."); return; }
    setError(null);
    setIsSavingStep(true);
    try {
      const api = await loadWheelApi();
      if (!api.upsertSequenceStep) throw new Error("Missing upsertSequenceStep helper.");
      const saved = await api.upsertSequenceStep({
        id: editingStep.id,
        stepNumber: editingStep.step_number ?? sequenceSteps.length + 1,
        subject: editingStep.subject.trim(),
        htmlBody: editingStep.html_body.trim(),
        attachments: editingStep.attachments ?? [],
      });
      setSequenceSteps((current) => {
        const existing = current.find((s) => s.id === saved.id);
        const updated = existing
          ? current.map((s) => (s.id === saved.id ? saved : s))
          : [...current, saved];
        return updated.sort((a, b) => a.step_number - b.step_number);
      });
      setEditingStep(null);
      setSequenceStepFileName("");
      setNotice(`Step ${saved.step_number} saved.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save step.");
    } finally {
      setIsSavingStep(false);
    }
  }

  async function handleDeleteSequenceStep(stepId: string) {
    setError(null);
    setIsDeletingStepId(stepId);
    try {
      const api = await loadWheelApi();
      if (!api.deleteSequenceStep) throw new Error("Missing deleteSequenceStep helper.");
      await api.deleteSequenceStep(stepId);
      setSequenceSteps((current) => current.filter((s) => s.id !== stepId).map((s, i) => ({ ...s, step_number: i + 1 })));
      setNotice("Step removed and sequence renumbered.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to delete step.");
    } finally {
      setIsDeletingStepId(null);
    }
  }

  async function handleSequenceAttachmentUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    const loaded: SequenceAttachment[] = await Promise.all(
      files.map((file) =>
        new Promise<SequenceAttachment>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            const base64 = dataUrl.split(",")[1];
            resolve({ filename: file.name, content: base64, content_type: file.type || "application/octet-stream", size: file.size });
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        })
      )
    );
    setEditingStep((current) =>
      current ? { ...current, attachments: [...(current.attachments ?? []), ...loaded] } : current
    );
    event.target.value = "";
  }

  async function handleSequenceStepHtmlUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) { setSequenceStepFileName(""); return; }
    if (!file.name.toLowerCase().endsWith(".html") && file.type !== "text/html") {
      setError("Please upload a .html file for the step template.");
      return;
    }
    if (file.size > 250_000) { setError("HTML file must be under 250 KB."); return; }
    const content = await file.text();
    setSequenceStepFileName(file.name);
    setEditingStep((current) => current ? ({
      ...current,
      html_body: content,
      subject: current.subject || file.name.replace(/\.html?$/i, "").replace(/[-_]+/g, " "),
    }) : current);
  }

  // Hero summary, one [status, figure, unit] row per tab.
  const header = TAB_HEADERS[activeTab];

  return (
    <div className="admin-wheel-shell">
      <AdminPageHeader kicker={header.kicker} title={header.title} description={header.description} />

      {error ? <div className="admin-wheel-alert error">{error}</div> : null}
      {notice ? <div className="admin-wheel-alert">{notice}</div> : null}
      {activeTab === "registrationEmail" ? (
        <section className="admin-wheel-panel">
          <div className="admin-wheel-panel-head">
            <div>
              <p className="admin-wheel-kicker">Automatic Email</p>
              <h2>Registration Email</h2>
            </div>
            <div className="admin-registration-email-status">
              <span>{registrationEmail.enabled ? "Enabled" : "Disabled"}</span>
              {registrationEmail.updatedAt ? <small>Updated {formatAdminDate(registrationEmail.updatedAt)}</small> : null}
            </div>
          </div>

          <div className="admin-registration-email-grid">
            <div className="admin-registration-email-main">
              <label className="admin-wheel-toggle registration-email-toggle">
                <input
                  type="checkbox"
                  checked={registrationEmail.enabled}
                  onChange={(event) => requestRegistrationEmailToggle(event.target.checked)}
                />
                Send automatically after registration
              </label>

              <label htmlFor="registration-email-subject">
                Subject
                <input
                  id="registration-email-subject"
                  value={registrationEmail.subject}
                  placeholder="Welcome to GutGuard Doctors"
                  onChange={(event) => setRegistrationEmail({ ...registrationEmail, subject: event.target.value })}
                />
              </label>

              <label htmlFor="registration-email-reply-to">
                Reply-to email
                <input
                  id="registration-email-reply-to"
                  type="email"
                  value={registrationEmail.replyTo}
                  placeholder="hello@gutguard.ph"
                  onChange={(event) => setRegistrationEmail({ ...registrationEmail, replyTo: event.target.value })}
                />
              </label>

              <label htmlFor="registration-email-from">
                From label
                <input id="registration-email-from" value={registrationEmail.fromLabel ?? "Configured in Edge Function"} readOnly />
              </label>

              <label htmlFor="registration-email-body-text">
                Body text
                <textarea
                  id="registration-email-body-text"
                  value={registrationEmail.bodyText}
                  placeholder="Write the email message here if you do not want to upload an HTML template."
                  onChange={(event) => setRegistrationEmail({ ...registrationEmail, bodyText: event.target.value })}
                />
              </label>

              <div className="admin-newsletter-upload registration-email-upload">
                <label htmlFor="registration-email-html-file">
                  Upload HTML template
                  <input
                    id="registration-email-html-file"
                    type="file"
                    accept=".html,text/html"
                    onChange={handleRegistrationEmailUpload}
                  />
                </label>
                <label htmlFor="registration-email-attachments">
                  Upload attachments
                  <input
                    id="registration-email-attachments"
                    type="file"
                    accept=".pdf,application/pdf,.png,image/png,.jpg,.jpeg,image/jpeg"
                    multiple
                    onChange={handleRegistrationAttachmentUpload}
                  />
                </label>
                <div className="registration-email-template-actions">
                  <button
                    className="admin-newsletter-upload-action"
                    type="button"
                    onClick={() => setShowRegistrationEmailPreview(true)}
                    disabled={registrationEmail.html.trim().length === 0}
                  >
                    Preview HTML
                  </button>
                  <button
                    className="admin-newsletter-upload-action"
                    type="button"
                    onClick={() => setShowRegistrationEmailRemoveHtmlConfirm(true)}
                    disabled={registrationEmail.html.trim().length === 0 || isRegistrationEmailRemovingHtml}
                  >
                    Remove HTML
                  </button>
                </div>
              </div>

              <div className="admin-registration-email-actions">
                <button
                  type="button"
                  onClick={saveRegistrationEmailSettings}
                  disabled={isRegistrationEmailSaving || !canSaveRegistrationEmail}
                >
                  {isRegistrationEmailSaving ? "Saving" : "Save settings"}
                </button>
                <label htmlFor="registration-email-test">
                  Test email
                  <input
                    id="registration-email-test"
                    type="email"
                    value={registrationEmailTestAddress}
                    placeholder="you@example.com"
                    onChange={(event) => setRegistrationEmailTestAddress(event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  onClick={sendRegistrationEmailTest}
                  disabled={isRegistrationEmailTesting || !canTestRegistrationEmail}
                >
                  {isRegistrationEmailTesting ? "Sending" : "Send test"}
                </button>
              </div>
            </div>

            <aside className="admin-registration-email-side">
              <div className="admin-newsletter-placeholder-box">
                <div className="admin-registration-html-status">
                  <p>{registrationEmailFileName || "No registration HTML uploaded yet."}</p>
                </div>
                {registrationEmailFileError ? <strong>{registrationEmailFileError}</strong> : null}
                {registrationAttachmentError ? <strong>{registrationAttachmentError}</strong> : null}
                <span>Available placeholders</span>
                <div>
                  {REGISTRATION_EMAIL_TOKENS.map((token) => (
                    <code key={token}>{token}</code>
                  ))}
                </div>
                {detectedRegistrationEmailPlaceholders.length > 0 ? (
                  <>
                    <span>Detected in uploaded HTML</span>
                    <div>
                      {detectedRegistrationEmailPlaceholders.map((token) => (
                        <code key={token}>{token}</code>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>

              <div className="admin-registration-attachments">
                <span>Attachments</span>
                {registrationEmail.attachments.length > 0 ? (
                  registrationEmail.attachments.map((attachment, index) => (
                    <article key={attachment.path ?? attachment.id ?? `${attachment.filename}-${index}`}>
                      <div>
                        <strong>{attachment.filename}</strong>
                        <small>
                          {attachment.contentType} - {formatFileSize(attachment.size)}
                        </small>
                      </div>
                      <button type="button" onClick={() => removeRegistrationAttachment(index)}>
                        Remove
                      </button>
                    </article>
                  ))
                ) : (
                  <p>No attachments uploaded.</p>
                )}
              </div>
            </aside>
          </div>
        </section>
      ) : null}

      {activeTab === "sequence" ? (
        <section className="admin-wheel-panel">
          <div className="admin-wheel-panel-head">
            <div>
              <p className="admin-wheel-kicker">Drip Campaign</p>
              <h2>Email Sequence</h2>
            </div>
            <div className="admin-wheel-panel-actions">
              <button
                type="button"
                onClick={() => {
                  setEditingStep({ step_number: sequenceSteps.length + 1, subject: "", html_body: "", attachments: [] });
                  setSequenceStepFileName("");
                }}
                disabled={!!editingStep}
              >
                + Add Step
              </button>
              <button type="button" onClick={refreshSequence} disabled={isSequenceLoading}>
                {isSequenceLoading ? "Loading…" : "Refresh"}
              </button>
              <a
                href="/sample-upload-newsletter.html"
                download="sequence-template.html"
                className="admin-wheel-btn"
                style={{ textDecoration: "none" }}
              >
                Download Template
              </a>
            </div>
          </div>

          {/* Step list */}
          <div className="admin-sequence-steps">
            <h3>Steps ({sequenceSteps.length})</h3>
            {sequenceSteps.length === 0 && !isSequenceLoading ? (
              <p style={{ color: "#888", fontSize: 14 }}>No steps yet. Click &quot;+ Add Step&quot; to create the first email in the sequence.</p>
            ) : null}
            {sequenceSteps.map((step) => (
              <article
                key={step.id}
                draggable={!editingStep && !isReordering}
                onDragStart={() => setDragStepId(step.id ?? null)}
                onDragOver={(e) => { e.preventDefault(); setDragOverStepId(step.id ?? null); }}
                onDragLeave={() => setDragOverStepId(null)}
                onDrop={() => step.id && handleDropStep(step.id)}
                onDragEnd={() => { setDragStepId(null); setDragOverStepId(null); }}
                className="admin-sequence-step-row"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 0",
                  borderBottom: "1px solid #eee",
                  opacity: dragStepId === step.id ? 0.4 : 1,
                  borderTop: dragOverStepId === step.id && dragStepId !== step.id ? "2px solid #0608a9" : undefined,
                  cursor: editingStep || isReordering ? "default" : "grab",
                  transition: "opacity 0.15s",
                }}
              >
                <span style={{ color: "#bbb", fontSize: 16, userSelect: "none", cursor: "inherit" }}>⠿</span>
                <span style={{ fontWeight: 700, fontSize: 13, color: "#0608a9", minWidth: 28 }}>#{step.step_number}</span>
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: 15 }}>{step.subject}</strong>
                  <br />
                  <small style={{ color: "#888" }}>{step.html_body ? `${step.html_body.length.toLocaleString()} chars` : "No HTML"}</small>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewStep(step)}
                  disabled={!step.html_body}
                >
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => { setEditingStep(step); setSequenceStepFileName(""); }}
                  disabled={!!editingStep || isReordering}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => step.id && handleDeleteSequenceStep(step.id)}
                  disabled={!!editingStep || isReordering || isDeletingStepId === step.id}
                  style={{ color: "#c0392b" }}
                >
                  {isDeletingStepId === step.id ? "Removing…" : "Remove"}
                </button>
              </article>
            ))}
          </div>

          {/* Inline step editor */}
          {editingStep ? (
            <div className="admin-sequence-editor" style={{ marginTop: 24, padding: 20, background: "#f9f8f5", border: "1px solid #ddd6c8" }}>
              <h3 style={{ marginTop: 0 }}>{editingStep.id ? `Editing Step #${editingStep.step_number}` : `New Step #${editingStep.step_number}`}</h3>
              <label style={{ display: "block", marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Subject line</span>
                <input
                  type="text"
                  value={editingStep.subject ?? ""}
                  onChange={(e) => setEditingStep((current) => current ? { ...current, subject: e.target.value } : current)}
                  placeholder="Email subject…"
                  style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 10px", fontSize: 14, border: "1px solid #ccc", borderRadius: 4 }}
                />
              </label>
              <label style={{ display: "block", marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>HTML template (.html file)</span>
                <br />
                <small style={{ color: "#888" }}>
                  Use <code>{"{{sequence_click_url}}"}</code> for the click-tracking button URL. Download the{" "}
                  <a href="/sample-upload-newsletter.html" download>sample template</a> for reference.
                </small>
                <input
                  type="file"
                  accept=".html,text/html"
                  onChange={handleSequenceStepHtmlUpload}
                  style={{ display: "block", marginTop: 8 }}
                />
                {sequenceStepFileName ? (
                  <small style={{ color: "#0608a9" }}>Loaded: {sequenceStepFileName}</small>
                ) : editingStep.html_body ? (
                  <small style={{ color: "#888" }}>{editingStep.html_body.length.toLocaleString()} chars loaded (upload a new file to replace)</small>
                ) : null}
              </label>
              <label style={{ display: "block", marginBottom: 4, marginTop: 16 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Attachments</span>
                <br />
                <small style={{ color: "#888" }}>Any file type, any number. Doctors receive these as email attachments.</small>
                <input type="file" multiple onChange={handleSequenceAttachmentUpload} style={{ display: "block", marginTop: 8 }} />
              </label>
              {(editingStep.attachments ?? []).length > 0 ? (
                <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none" }}>
                  {(editingStep.attachments ?? []).map((att, i) => (
                    <li key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 13 }}>
                      <span>📎 {att.filename}</span>
                      <small style={{ color: "#888" }}>({(att.size / 1024).toFixed(0)} KB)</small>
                      <button
                        type="button"
                        onClick={() => setEditingStep((cur) => cur ? { ...cur, attachments: (cur.attachments ?? []).filter((_, j) => j !== i) } : cur)}
                        style={{ color: "#c0392b", fontSize: 12, padding: "1px 6px" }}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button type="button" onClick={handleSaveSequenceStep} disabled={isSavingStep}>
                  {isSavingStep ? "Saving…" : "Save Step"}
                </button>
                <button type="button" onClick={() => { setEditingStep(null); setSequenceStepFileName(""); }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          {/* Doctor progress */}
          {sequenceProgress.length > 0 ? (
            <div className="admin-sequence-progress" style={{ marginTop: 32 }}>
              <h3>Enrolled Doctors ({sequenceProgress.length})</h3>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #eee", textAlign: "left" }}>
                    <th style={{ padding: "8px 10px" }}>Doctor</th>
                    <th style={{ padding: "8px 10px" }}>Step</th>
                    <th style={{ padding: "8px 10px" }}>Status</th>
                    <th style={{ padding: "8px 10px" }}>Last Clicked</th>
                    <th style={{ padding: "8px 10px" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sequenceProgress.map((row) => {
                    const lastClick = row.email_sequence_sends
                      .map((s) => s.clicked_at)
                      .filter(Boolean)
                      .sort()
                      .at(-1);
                    const resendKey = `resend-${row.doctor_id}-${row.current_step}`;
                    const nextKey = `next-${row.doctor_id}-${row.current_step + 1}`;
                    const isBusy = resendingKey === resendKey || resendingKey === nextKey;
                    const isCompleted = row.status === "completed";
                    return (
                      <tr key={row.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                        <td style={{ padding: "10px 10px" }}>
                          <strong>{row.doctor_registrations?.full_name ?? row.doctor_id}</strong>
                          <br />
                          <small style={{ color: "#888" }}>{row.doctor_registrations?.email ?? ""}</small>
                        </td>
                        <td style={{ padding: "10px 10px" }}>
                          Step {row.current_step} of {sequenceTotalSteps}
                        </td>
                        <td style={{ padding: "10px 10px" }}>
                          <span style={{
                            padding: "2px 8px",
                            borderRadius: 99,
                            fontSize: 12,
                            fontWeight: 700,
                            background: isCompleted ? "#d4edda" : "#cce5ff",
                            color: isCompleted ? "#155724" : "#004085",
                          }}>
                            {row.status}
                          </span>
                        </td>
                        <td style={{ padding: "10px 10px", color: "#888" }}>
                          {lastClick ? formatAdminDate(lastClick) : "—"}
                        </td>
                        <td style={{ padding: "10px 10px" }}>
                          {isCompleted ? (
                            <span style={{ color: "#888", fontSize: 12 }}>Sequence done</span>
                          ) : (
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleResendStep(row.doctor_id, row.current_step, resendKey)}
                                style={{ fontSize: 12, minHeight: 32, padding: "6px 10px" }}
                                title={`Resend Step ${row.current_step} email`}
                              >
                                {resendingKey === resendKey ? "Sending…" : `↺ Resend Step ${row.current_step}`}
                              </button>
                              {row.current_step < sequenceTotalSteps ? (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handleResendStep(row.doctor_id, row.current_step + 1, nextKey)}
                                  style={{ fontSize: 12, minHeight: 32, padding: "6px 10px", background: "#0608a9" }}
                                  title={`Skip to Step ${row.current_step + 1}`}
                                >
                                  {resendingKey === nextKey ? "Sending…" : `→ Send Step ${row.current_step + 1}`}
                                </button>
                              ) : null}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      {showRegistrationEmailPreview ? (
        <div className="admin-modal-backdrop" role="presentation">
          <section
            className="admin-modal admin-newsletter-preview-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="registration-email-preview-title"
          >
            <div className="admin-modal-head">
              <div>
                <p className="admin-wheel-kicker">Registration Email Preview</p>
                <h2 id="registration-email-preview-title">{registrationEmail.subject || "Uploaded HTML"}</h2>
              </div>
              <button type="button" onClick={() => setShowRegistrationEmailPreview(false)}>
                Close
              </button>
            </div>
            <iframe
              className="admin-newsletter-preview-frame"
              title="Registration email HTML preview"
              sandbox=""
              srcDoc={registrationEmailPreviewHtml}
            />
          </section>
        </div>
      ) : null}

      {showRegistrationEmailToggleConfirm ? (
        <div className="admin-modal-backdrop" role="presentation">
          <section
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="registration-email-toggle-title"
          >
            <div className="admin-modal-head">
              <div>
                <p className="admin-wheel-kicker">Confirm Change</p>
                <h2 id="registration-email-toggle-title">
                  {pendingRegistrationEmailEnabled ? "Enable registration email?" : "Disable registration email?"}
                </h2>
              </div>
              <button type="button" onClick={() => setShowRegistrationEmailToggleConfirm(false)}>
                Close
              </button>
            </div>
            <div className="admin-modal-body">
              <p>
                {pendingRegistrationEmailEnabled
                  ? "New doctor registrations will receive this saved email automatically."
                  : "New doctor registrations will no longer receive the automatic registration email."}
              </p>
            </div>
            <div className="admin-modal-actions">
              <button type="button" onClick={() => setShowRegistrationEmailToggleConfirm(false)}>
                Cancel
              </button>
              <button type="button" onClick={confirmRegistrationEmailToggle}>
                Confirm
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {showRegistrationEmailRemoveHtmlConfirm ? (
        <div className="admin-modal-backdrop" role="presentation">
          <section
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="registration-email-remove-html-title"
          >
            <div className="admin-modal-head">
              <div>
                <p className="admin-wheel-kicker">Remove Template</p>
                <h2 id="registration-email-remove-html-title">Remove saved HTML?</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowRegistrationEmailRemoveHtmlConfirm(false)}
                disabled={isRegistrationEmailRemovingHtml}
              >
                Close
              </button>
            </div>
            <div className="admin-modal-body">
              <p>
                This will remove the uploaded registration email HTML. If body text is filled in, automatic emails
                can still send using that text. If body text is empty, automatic sending will be disabled until a new
                body or HTML template is added.
              </p>
            </div>
            <div className="admin-modal-actions">
              <button
                type="button"
                onClick={() => setShowRegistrationEmailRemoveHtmlConfirm(false)}
                disabled={isRegistrationEmailRemovingHtml}
              >
                Cancel
              </button>
              <button type="button" onClick={removeRegistrationEmailHtml} disabled={isRegistrationEmailRemovingHtml}>
                {isRegistrationEmailRemovingHtml ? "Removing" : "Remove HTML"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {previewStep ? (
        <div
          className="admin-modal-backdrop"
          role="presentation"
          onClick={() => setPreviewStep(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 6, width: "100%", maxWidth: 700, maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid #eee" }}>
              <strong style={{ fontSize: 15 }}>Preview — Step #{previewStep.step_number}: {previewStep.subject}</strong>
              <button type="button" onClick={() => setPreviewStep(null)} style={{ fontSize: 18, background: "none", border: "none", cursor: "pointer", lineHeight: 1 }}>✕</button>
            </div>
            <iframe
              title="Step preview"
              style={{ flex: 1, border: "none", minHeight: 500 }}
              srcDoc={previewStep.html_body
                .replace(/\{\{\s*prefixed_name\s*\}\}/g, "Dr. Sample Doctor")
                .replace(/\{\{\s*name_prefix\s*\}\}/g, "Dr.")
                .replace(/\{\{\s*doctor_name\s*\}\}/g, "Sample Doctor")
                .replace(/\{\{\s*doctor_email\s*\}\}/g, "doctor@clinic.com")
                .replace(/\{\{\s*doctor_mobile\s*\}\}/g, "09171234567")
                .replace(/\{\{\s*specialty\s*\}\}/g, "Gastroenterology")
                .replace(/\{\{\s*clinic_location\s*\}\}/g, "Makati City")
                .replace(/\{\{\s*registered_at\s*\}\}/g, "Jun 20, 2026")
                .replace(/\{\{\s*prize_label\s*\}\}/g, "Tote Bag")
                .replace(/\{\{\s*next_step_number\s*\}\}/g, String(previewStep.step_number + 1))
                .replace(/\{\{\s*sequence_click_url\s*\}\}/g, "#")}
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatAdminDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function renderRegistrationEmailPreview(html: string) {
  const replacements: Record<string, string> = {
    doctor_name: "Maria Santos",
    name_prefix: "Dr.",
    prefixed_name: "Dr. Maria Santos",
    doctor_email: "doctor@example.com",
    doctor_mobile: "09171234567",
    specialty: "Internal Medicine",
    clinic_location: "Makati City",
    routing_url: `${PUBLIC_SITE_ORIGIN}/r/maria-santos`,
    registered_at: "Jun 12, 2026",
  };

  return html.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
    if (!(key in replacements)) return match;
    return escapeHtml(replacements[key]);
  });
}

function renderBodyTextPreview(value: string) {
  if (!value.trim()) return "";

  const body = escapeHtml(value)
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br/>")}</p>`)
    .join("");

  return `<div style="font-family:Arial,sans-serif;color:#0F0F18;line-height:1.6">${body}</div>`;
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.ceil(bytes / 1024)} KB`;
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = () => reject(new Error(`${file.name} could not be read.`));
    reader.readAsDataURL(file);
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
