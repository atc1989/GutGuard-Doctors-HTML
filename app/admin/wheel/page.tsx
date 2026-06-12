"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import Header from "@/components/Header";

type AdminWheelPrize = {
  id?: string;
  label: string;
  note: string;
  color: string;
  text: string;
  chance_weight: number;
  total_stock: number;
  remaining_stock: number;
  is_active: boolean;
  sort_order: number;
};

type AdminDoctorRegistration = {
  id: string;
  full_name: string;
  email: string;
  mobile: string;
  tiktok_username: string;
  specialty: string;
  practice_location: string;
  created_at: string;
  prize_label?: string | null;
  prize_claimed_at?: string | null;
};

type NewsletterSendHistory = {
  id: string;
  doctor_id: string;
  newsletter_id?: string | null;
  newsletter_title?: string | null;
  email: string;
  subject: string;
  status: "sent" | "failed" | "skipped";
  resend_id?: string | null;
  error_message?: string | null;
  sent_at: string;
};

type NewsletterSendResult = {
  doctorId: string;
  email: string;
  status: "sent" | "failed" | "skipped";
  resendId?: string | null;
  error?: string | null;
};

type WheelApi = {
  getWheelPrizes?: (adminPassword: string) => Promise<AdminWheelPrize[]>;
  saveWheelPrize?: (adminPassword: string, prize: AdminWheelPrize) => Promise<AdminWheelPrize>;
  createWheelPrize?: (
    adminPassword: string,
    prize: Omit<AdminWheelPrize, "id">,
  ) => Promise<AdminWheelPrize>;
  getDoctorRegistrations?: (adminPassword: string) => Promise<AdminDoctorRegistration[]>;
  updateDoctorRegistration?: (
    adminPassword: string,
    doctor: Pick<
      AdminDoctorRegistration,
      "id" | "full_name" | "email" | "mobile" | "tiktok_username" | "specialty" | "practice_location"
    >,
  ) => Promise<AdminDoctorRegistration>;
  getNewsletterSendHistory?: (adminPassword: string) => Promise<NewsletterSendHistory[]>;
  sendNewsletter?: (
    adminPassword: string,
    doctorIds: string[],
    subject: string,
    html: string,
  ) => Promise<{
    sent: number;
    failed: number;
    skipped: number;
    results: NewsletterSendResult[];
  }>;
};

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
const PAGE_SIZE_OPTIONS = [10, 20, 100];
const PLACEHOLDER_TOKENS = [
  "{{doctor_name}}",
  "{{doctor_email}}",
  "{{doctor_mobile}}",
  "{{tiktok_username}}",
  "{{specialty}}",
  "{{clinic_location}}",
  "{{registered_at}}",
  "{{prize_label}}",
];

async function loadWheelApi(): Promise<WheelApi> {
  const api = (await import("@/lib/api")) as WheelApi;
  return api;
}

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getPrizeOdds(prize: AdminWheelPrize, activeWeightTotal: number) {
  if (!prize.is_active || prize.remaining_stock <= 0 || prize.chance_weight <= 0 || activeWeightTotal <= 0) {
    return 0;
  }

  return (prize.chance_weight / activeWeightTotal) * 100;
}

export default function AdminWheelPage() {
  const [activeTab, setActiveTab] = useState<"wheel" | "doctors" | "newsletter">("wheel");
  const [password, setPassword] = useState("");
  const [prizes, setPrizes] = useState<AdminWheelPrize[]>([]);
  const [doctors, setDoctors] = useState<AdminDoctorRegistration[]>([]);
  const [doctorSearch, setDoctorSearch] = useState("");
  const [doctorPage, setDoctorPage] = useState(1);
  const [doctorPageSize, setDoctorPageSize] = useState(10);
  const [newsletterSearch, setNewsletterSearch] = useState("");
  const [newsletterPage, setNewsletterPage] = useState(1);
  const [newsletterPageSize, setNewsletterPageSize] = useState(10);
  const [selectedDoctorIds, setSelectedDoctorIds] = useState<string[]>([]);
  const [newsletterHistory, setNewsletterHistory] = useState<NewsletterSendHistory[]>([]);
  const [newsletterResults, setNewsletterResults] = useState<NewsletterSendResult[]>([]);
  const [isNewsletterSending, setIsNewsletterSending] = useState(false);
  const [showNewsletterConfirm, setShowNewsletterConfirm] = useState(false);
  const [newsletterSubject, setNewsletterSubject] = useState("");
  const [newsletterHtml, setNewsletterHtml] = useState("");
  const [newsletterFileName, setNewsletterFileName] = useState("");
  const [newsletterFileError, setNewsletterFileError] = useState<string | null>(null);
  const [showNewsletterPreview, setShowNewsletterPreview] = useState(false);
  const [historyDoctorId, setHistoryDoctorId] = useState<string | null>(null);
  const [editingDoctor, setEditingDoctor] = useState<AdminDoctorRegistration | null>(null);
  const [isDoctorSaving, setIsDoctorSaving] = useState(false);
  const [newPrize, setNewPrize] = useState<AdminWheelPrize>(emptyPrize);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [newsletterToast, setNewsletterToast] = useState<{
    tone: "success" | "error";
    title: string;
    message: string;
  } | null>(null);

  const activeWeightTotal = useMemo(
    () =>
      prizes.reduce((sum, prize) => {
        if (!prize.is_active || prize.remaining_stock <= 0 || prize.chance_weight <= 0) return sum;
        return sum + prize.chance_weight;
      }, 0),
    [prizes],
  );
  const filteredDoctors = useMemo(() => {
    const query = doctorSearch.trim().toLowerCase();
    if (!query) return doctors;

    return doctors.filter((doctor) =>
      [
        doctor.full_name,
        doctor.email,
        doctor.mobile,
        doctor.tiktok_username,
        doctor.specialty,
        doctor.practice_location,
        doctor.prize_label ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [doctorSearch, doctors]);
  const totalDoctorPages = Math.max(1, Math.ceil(filteredDoctors.length / doctorPageSize));
  const visibleDoctors = filteredDoctors.slice(
    (doctorPage - 1) * doctorPageSize,
    doctorPage * doctorPageSize,
  );
  const filteredNewsletterDoctors = useMemo(() => {
    const query = newsletterSearch.trim().toLowerCase();
    const withEmail = doctors.filter((doctor) => doctor.email);
    if (!query) return withEmail;

    return withEmail.filter((doctor) =>
      [
        doctor.full_name,
        doctor.email,
        doctor.mobile,
        doctor.tiktok_username,
        doctor.specialty,
        doctor.practice_location,
        doctor.prize_label ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [newsletterSearch, doctors]);
  const totalNewsletterPages = Math.max(
    1,
    Math.ceil(filteredNewsletterDoctors.length / newsletterPageSize),
  );
  const visibleNewsletterDoctors = filteredNewsletterDoctors.slice(
    (newsletterPage - 1) * newsletterPageSize,
    newsletterPage * newsletterPageSize,
  );
  const selectedDoctors = useMemo(
    () => doctors.filter((doctor) => selectedDoctorIds.includes(doctor.id)),
    [doctors, selectedDoctorIds],
  );
  const latestNewsletterByDoctor = useMemo(() => {
    return newsletterHistory.reduce<Record<string, NewsletterSendHistory>>((current, item) => {
      const existing = current[item.doctor_id];
      if (!existing || new Date(item.sent_at).getTime() > new Date(existing.sent_at).getTime()) {
        current[item.doctor_id] = item;
      }
      return current;
    }, {});
  }, [newsletterHistory]);
  const newsletterHistoryByDoctor = useMemo(() => {
    return newsletterHistory.reduce<Record<string, NewsletterSendHistory[]>>((current, item) => {
      current[item.doctor_id] = [...(current[item.doctor_id] ?? []), item].sort(
        (a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime(),
      );
      return current;
    }, {});
  }, [newsletterHistory]);
  const historyDoctor = historyDoctorId ? doctors.find((doctor) => doctor.id === historyDoctorId) : null;
  const historyItems = historyDoctorId ? newsletterHistoryByDoctor[historyDoctorId] ?? [] : [];
  const detectedPlaceholders = useMemo(() => {
    return Array.from(new Set(newsletterHtml.match(/\{\{\s*[a-zA-Z0-9_]+\s*\}\}/g) ?? [])).map((token) =>
      token.replace(/\s+/g, ""),
    );
  }, [newsletterHtml]);
  const visibleSelectedCount = visibleNewsletterDoctors.filter((doctor) =>
    selectedDoctorIds.includes(doctor.id),
  ).length;
  const allVisibleSelected =
    visibleNewsletterDoctors.length > 0 && visibleSelectedCount === visibleNewsletterDoctors.length;
  const canSendNewsletter =
    selectedDoctorIds.length > 0 && newsletterSubject.trim().length > 0 && newsletterHtml.trim().length > 0;
  const previewHtml = useMemo(() => renderNewsletterPreview(newsletterHtml), [newsletterHtml]);

  useEffect(() => {
    if (!newsletterToast) return;

    const timeout = window.setTimeout(() => {
      setNewsletterToast(null);
    }, 5200);

    return () => window.clearTimeout(timeout);
  }, [newsletterToast]);

  async function handleUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setIsLoading(true);

    try {
      const api = await loadWheelApi();
      if (!api.getWheelPrizes) {
        throw new Error("Missing getWheelPrizes helper in lib/api.ts.");
      }

      const [loadedPrizes, loadedDoctors, loadedNewsletterHistory] = await Promise.all([
        api.getWheelPrizes(password),
        api.getDoctorRegistrations ? api.getDoctorRegistrations(password) : Promise.resolve([]),
        api.getNewsletterSendHistory ? api.getNewsletterSendHistory(password) : Promise.resolve([]),
      ]);
      setPrizes(loadedPrizes.sort((a, b) => a.sort_order - b.sort_order));
      setDoctors(loadedDoctors);
      setNewsletterHistory(loadedNewsletterHistory);
      setDoctorPage(1);
      setNewsletterPage(1);
      setIsUnlocked(true);
      setNotice("Admin data loaded.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load wheel prizes.");
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshDoctors() {
    setError(null);
    setNotice(null);
    setIsLoading(true);

    try {
      const api = await loadWheelApi();
      if (!api.getDoctorRegistrations) {
        throw new Error("Missing getDoctorRegistrations helper in lib/api.ts.");
      }

      setDoctors(await api.getDoctorRegistrations(password));
      setDoctorPage(1);
      setNotice("Doctor registrations refreshed.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load doctor registrations.");
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshNewsletterHistory() {
    const api = await loadWheelApi();
    if (!api.getNewsletterSendHistory) return;
    setNewsletterHistory(await api.getNewsletterSendHistory(password));
  }

  function toggleNewsletterDoctor(doctorId: string) {
    setShowNewsletterConfirm(false);
    setSelectedDoctorIds((current) =>
      current.includes(doctorId)
        ? current.filter((id) => id !== doctorId)
        : [...current, doctorId],
    );
  }

  function toggleVisibleNewsletterDoctors() {
    setShowNewsletterConfirm(false);
    const visibleIds = visibleNewsletterDoctors.map((doctor) => doctor.id);
    setSelectedDoctorIds((current) => {
      if (visibleIds.every((id) => current.includes(id))) {
        return current.filter((id) => !visibleIds.includes(id));
      }

      return Array.from(new Set([...current, ...visibleIds]));
    });
  }

  async function handleNewsletterUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setNewsletterFileError(null);
    setShowNewsletterConfirm(false);

    if (!file) {
      setNewsletterFileName("");
      setNewsletterHtml("");
      return;
    }

    if (!file.name.toLowerCase().endsWith(".html") && file.type !== "text/html") {
      setNewsletterFileName("");
      setNewsletterHtml("");
      setNewsletterFileError("Please upload a .html newsletter file.");
      return;
    }

    if (file.size > 250_000) {
      setNewsletterFileName("");
      setNewsletterHtml("");
      setNewsletterFileError("Please keep the HTML file under 250 KB.");
      return;
    }

    const content = await file.text();
    setNewsletterFileName(file.name);
    setNewsletterHtml(content);

    if (!newsletterSubject.trim()) {
      setNewsletterSubject(file.name.replace(/\.html?$/i, "").replace(/[-_]+/g, " "));
    }
  }

  async function handleNewsletterSend() {
    if (!canSendNewsletter) {
      setError("Upload an HTML file, enter a subject, and select at least one recipient.");
      return;
    }

    setShowNewsletterConfirm(true);
  }

  async function confirmNewsletterSend() {
    if (!canSendNewsletter) return;

    setError(null);
    setNotice(null);
    setNewsletterResults([]);
    setIsNewsletterSending(true);

    try {
      const api = await loadWheelApi();
      if (!api.sendNewsletter) {
        throw new Error("Missing sendNewsletter helper in lib/api.ts.");
      }

      const response = await api.sendNewsletter(
        password,
        selectedDoctorIds,
        newsletterSubject.trim(),
        newsletterHtml,
      );
      setNewsletterResults(response.results);
      setNewsletterToast({
        tone: "success",
        title: "Newsletter send complete",
        message: `Newsletter sent: ${response.sent} sent, ${response.failed} failed, ${response.skipped} skipped.`,
      });
      setNotice(
        `Newsletter complete: ${response.sent} sent, ${response.failed} failed, ${response.skipped} skipped.`,
      );
      setShowNewsletterConfirm(false);
      await refreshNewsletterHistory();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to send newsletter.";
      setError(message);
      setNewsletterToast({
        tone: "error",
        title: "Newsletter send failed",
        message,
      });
    } finally {
      setIsNewsletterSending(false);
    }
  }

  function openDoctorEditor(doctor: AdminDoctorRegistration) {
    setError(null);
    setNotice(null);
    setEditingDoctor({ ...doctor });
  }

  async function saveDoctorEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingDoctor) return;

    setError(null);
    setNotice(null);
    setIsDoctorSaving(true);

    try {
      const api = await loadWheelApi();
      if (!api.updateDoctorRegistration) {
        throw new Error("Missing updateDoctorRegistration helper in lib/api.ts.");
      }

      const updatedDoctor = await api.updateDoctorRegistration(password, {
        id: editingDoctor.id,
        full_name: editingDoctor.full_name.trim(),
        email: editingDoctor.email.trim(),
        mobile: editingDoctor.mobile.trim(),
        tiktok_username: editingDoctor.tiktok_username.trim().replace(/^@+/, ""),
        specialty: editingDoctor.specialty.trim(),
        practice_location: editingDoctor.practice_location.trim(),
      });
      setDoctors((current) =>
        current.map((doctor) => (doctor.id === updatedDoctor.id ? { ...doctor, ...updatedDoctor } : doctor)),
      );
      setEditingDoctor(null);
      setNotice("Doctor details updated.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update doctor details.");
    } finally {
      setIsDoctorSaving(false);
    }
  }

  function updatePrize(index: number, patch: Partial<AdminWheelPrize>) {
    setPrizes((current) =>
      current.map((prize, currentIndex) => (currentIndex === index ? { ...prize, ...patch } : prize)),
    );
  }

  async function handleSave(prize: AdminWheelPrize) {
    setError(null);
    setNotice(null);
    setSavingId(prize.id ?? prize.label);

    try {
      const api = await loadWheelApi();
      if (!api.saveWheelPrize) {
        throw new Error("Missing saveWheelPrize helper in lib/api.ts.");
      }

      const savedPrize = await api.saveWheelPrize(password, prize);
      setPrizes((current) =>
        current
          .map((item) => (item.id === prize.id ? savedPrize : item))
          .sort((a, b) => a.sort_order - b.sort_order),
      );
      setNotice(`${savedPrize.label || "Prize"} saved.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save this prize.");
    } finally {
      setSavingId(null);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setIsCreating(true);

    try {
      const api = await loadWheelApi();
      if (!api.createWheelPrize) {
        throw new Error("Missing createWheelPrize helper in lib/api.ts.");
      }

      const createdPrize = await api.createWheelPrize(password, {
        label: newPrize.label,
        note: newPrize.note,
        color: newPrize.color,
        text: newPrize.text,
        chance_weight: newPrize.chance_weight,
        total_stock: newPrize.total_stock,
        remaining_stock: newPrize.remaining_stock,
        is_active: newPrize.is_active,
        sort_order: newPrize.sort_order,
      });
      setPrizes((current) => [...current, createdPrize].sort((a, b) => a.sort_order - b.sort_order));
      setNewPrize({ ...emptyPrize, sort_order: prizes.length + 1 });
      setNotice(`${createdPrize.label || "Prize"} created.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create prize.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <main className="admin-wheel-shell">
      <Header dateLabel="Admin Wheel" />

      <section className="admin-wheel-hero">
        <div>
          <p className="admin-wheel-kicker">Prize Operations</p>
          <h1>
            Wheel
            <br />
            <em>Admin</em>
          </h1>
        </div>
        <div className="admin-wheel-summary" aria-live="polite">
          <span>
            {activeTab === "wheel"
              ? `${prizes.length} prizes`
              : activeTab === "doctors"
                ? `${doctors.length} doctors`
                : `${selectedDoctorIds.length} selected`}
          </span>
          <strong>
            {activeTab === "wheel"
              ? activeWeightTotal
              : activeTab === "doctors"
                ? doctors.length
                : selectedDoctorIds.length}
          </strong>
          <span>
            {activeTab === "wheel"
              ? "active weight"
              : activeTab === "doctors"
                ? "registrations"
                : "newsletter recipients"}
          </span>
        </div>
      </section>

      <nav className="admin-tabs" aria-label="Admin sections">
        <button
          className={activeTab === "wheel" ? "active" : ""}
          onClick={() => setActiveTab("wheel")}
          type="button"
        >
          Wheel
        </button>
        <button
          className={activeTab === "doctors" ? "active" : ""}
          onClick={() => setActiveTab("doctors")}
          type="button"
        >
          Doctors
        </button>
        <button
          className={activeTab === "newsletter" ? "active" : ""}
          onClick={() => setActiveTab("newsletter")}
          type="button"
        >
          Newsletter
        </button>
      </nav>

      <form className="admin-wheel-auth" onSubmit={handleUnlock}>
        <label htmlFor="admin-password">Admin password</label>
        <div className="admin-wheel-auth-row">
          <input
            className="admin-hidden-username"
            type="text"
            name="username"
            autoComplete="username"
            value="gutguard-admin"
            readOnly
            aria-hidden="true"
            tabIndex={-1}
          />
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            placeholder="Enter password"
            onChange={(event) => setPassword(event.target.value)}
          />
          <button type="submit" disabled={isLoading || password.trim().length === 0}>
            {isLoading ? "Loading" : isUnlocked ? "Refresh" : "Unlock"}
          </button>
        </div>
      </form>

      {error ? <div className="admin-wheel-alert error">{error}</div> : null}
      {notice ? <div className="admin-wheel-alert">{notice}</div> : null}
      {newsletterToast ? (
        <div className={`admin-toast ${newsletterToast.tone}`} role="status" aria-live="polite">
          <div>
            <strong>{newsletterToast.title}</strong>
            <span>{newsletterToast.message}</span>
          </div>
          <button type="button" onClick={() => setNewsletterToast(null)} aria-label="Dismiss notification">
            Close
          </button>
        </div>
      ) : null}

      {isUnlocked && activeTab === "wheel" ? (
        <>
          <section className="admin-wheel-panel">
            <div className="admin-wheel-panel-head">
              <div>
                <p className="admin-wheel-kicker">Current Wheel</p>
                <h2>Prizes and Stock</h2>
              </div>
              <p>{activeWeightTotal > 0 ? "Odds recalculate from active, in-stock weight." : "No active stock available."}</p>
            </div>

            <div className="admin-wheel-list">
              {prizes.map((prize, index) => {
                const odds = getPrizeOdds(prize, activeWeightTotal);
                const saveKey = prize.id ?? prize.label;

                return (
                  <article className="admin-wheel-prize" key={prize.id ?? `${prize.label}-${index}`}>
                    <div className="admin-wheel-prize-main">
                      <label>
                        Label
                        <input value={prize.label} onChange={(event) => updatePrize(index, { label: event.target.value })} />
                      </label>
                      <label>
                        Note
                        <textarea value={prize.note} onChange={(event) => updatePrize(index, { note: event.target.value })} />
                      </label>
                    </div>

                    <div className="admin-wheel-grid">
                      <label>
                        Color
                        <input
                          type="color"
                          value={prize.color}
                          onChange={(event) => updatePrize(index, { color: event.target.value })}
                        />
                      </label>
                      <label>
                        Text
                        <input type="color" value={prize.text} onChange={(event) => updatePrize(index, { text: event.target.value })} />
                      </label>
                      <label>
                        Weight
                        <input
                          type="number"
                          min="0"
                          value={prize.chance_weight}
                          onChange={(event) => updatePrize(index, { chance_weight: toNumber(event.target.value) })}
                        />
                      </label>
                      <label>
                        Total
                        <input
                          type="number"
                          min="0"
                          value={prize.total_stock}
                          onChange={(event) => updatePrize(index, { total_stock: toNumber(event.target.value) })}
                        />
                      </label>
                      <label>
                        Remaining
                        <input
                          type="number"
                          min="0"
                          value={prize.remaining_stock}
                          onChange={(event) => updatePrize(index, { remaining_stock: toNumber(event.target.value) })}
                        />
                      </label>
                      <label>
                        Sort
                        <input
                          type="number"
                          value={prize.sort_order}
                          onChange={(event) => updatePrize(index, { sort_order: toNumber(event.target.value) })}
                        />
                      </label>
                    </div>

                    <div className="admin-wheel-prize-footer">
                      <label className="admin-wheel-toggle">
                        <input
                          type="checkbox"
                          checked={prize.is_active}
                          onChange={(event) => updatePrize(index, { is_active: event.target.checked })}
                        />
                        Active
                      </label>
                      <div className="admin-wheel-odds">
                        <span>Odds</span>
                        <strong>{odds.toFixed(2)}%</strong>
                      </div>
                      <button type="button" onClick={() => handleSave(prize)} disabled={savingId === saveKey}>
                        {savingId === saveKey ? "Saving" : "Save"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="admin-wheel-panel">
            <div className="admin-wheel-panel-head">
              <div>
                <p className="admin-wheel-kicker">New Prize</p>
                <h2>Create Segment</h2>
              </div>
            </div>

            <form className="admin-wheel-create" onSubmit={handleCreate}>
              <label>
                Label
                <input required value={newPrize.label} onChange={(event) => setNewPrize({ ...newPrize, label: event.target.value })} />
              </label>
              <label>
                Note
                <textarea value={newPrize.note} onChange={(event) => setNewPrize({ ...newPrize, note: event.target.value })} />
              </label>
              <div className="admin-wheel-grid">
                <label>
                  Color
                  <input type="color" value={newPrize.color} onChange={(event) => setNewPrize({ ...newPrize, color: event.target.value })} />
                </label>
                <label>
                  Text
                  <input type="color" value={newPrize.text} onChange={(event) => setNewPrize({ ...newPrize, text: event.target.value })} />
                </label>
                <label>
                  Weight
                  <input
                    type="number"
                    min="0"
                    value={newPrize.chance_weight}
                    onChange={(event) => setNewPrize({ ...newPrize, chance_weight: toNumber(event.target.value) })}
                  />
                </label>
                <label>
                  Total
                  <input
                    type="number"
                    min="0"
                    value={newPrize.total_stock}
                    onChange={(event) => setNewPrize({ ...newPrize, total_stock: toNumber(event.target.value) })}
                  />
                </label>
                <label>
                  Remaining
                  <input
                    type="number"
                    min="0"
                    value={newPrize.remaining_stock}
                    onChange={(event) => setNewPrize({ ...newPrize, remaining_stock: toNumber(event.target.value) })}
                  />
                </label>
                <label>
                  Sort
                  <input
                    type="number"
                    value={newPrize.sort_order}
                    onChange={(event) => setNewPrize({ ...newPrize, sort_order: toNumber(event.target.value) })}
                  />
                </label>
              </div>
              <label className="admin-wheel-toggle">
                <input
                  type="checkbox"
                  checked={newPrize.is_active}
                  onChange={(event) => setNewPrize({ ...newPrize, is_active: event.target.checked })}
                />
                Active on wheel
              </label>
              <button type="submit" disabled={isCreating || newPrize.label.trim().length === 0}>
                {isCreating ? "Creating" : "Create prize"}
              </button>
            </form>
          </section>
        </>
      ) : null}

      {isUnlocked && activeTab === "doctors" ? (
        <section className="admin-wheel-panel">
          <div className="admin-wheel-panel-head">
            <div>
              <p className="admin-wheel-kicker">Registered Doctors</p>
              <h2>Doctor Directory</h2>
            </div>
            <div className="admin-doctor-actions">
              <label htmlFor="doctor-search">
                Search
                <input
                  id="doctor-search"
                  type="search"
                  value={doctorSearch}
                  placeholder="Name, email, TikTok, clinic..."
                  onChange={(event) => {
                    setDoctorSearch(event.target.value);
                    setDoctorPage(1);
                  }}
                />
              </label>
              <button type="button" onClick={refreshDoctors} disabled={isLoading}>
                {isLoading ? "Refreshing" : "Refresh"}
              </button>
            </div>
          </div>

          <div className="admin-doctor-list">
            {visibleDoctors.length > 0 ? (
              visibleDoctors.map((doctor) => (
                <article className="admin-doctor-row" key={doctor.id}>
                  <div className="admin-doctor-primary">
                    <strong>{doctor.full_name || "Unnamed doctor"}</strong>
                    <span>@{doctor.tiktok_username || "no-handle"}</span>
                  </div>
                  <dl className="admin-doctor-details">
                    <div>
                      <dt>Email</dt>
                      <dd>{doctor.email || "--"}</dd>
                    </div>
                    <div>
                      <dt>Mobile</dt>
                      <dd>{doctor.mobile || "--"}</dd>
                    </div>
                    <div>
                      <dt>Specialty</dt>
                      <dd>{doctor.specialty || "--"}</dd>
                    </div>
                    <div>
                      <dt>Clinic</dt>
                      <dd>{doctor.practice_location || "--"}</dd>
                    </div>
                    <div>
                      <dt>Prize</dt>
                      <dd>{doctor.prize_label || "Not spun"}</dd>
                    </div>
                    <div>
                      <dt>Registered</dt>
                      <dd>{formatAdminDate(doctor.created_at)}</dd>
                    </div>
                  </dl>
                  <div className="admin-doctor-row-actions">
                    <button type="button" onClick={() => openDoctorEditor(doctor)}>
                      Edit
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="admin-wheel-empty">
                <p>{doctors.length > 0 ? "No doctors match that search." : "No doctor registrations found."}</p>
              </div>
            )}
          </div>

          <div className="admin-pagination">
            <p>
              Showing {visibleDoctors.length > 0 ? (doctorPage - 1) * doctorPageSize + 1 : 0}
              {"-"}
              {Math.min(doctorPage * doctorPageSize, filteredDoctors.length)} of {filteredDoctors.length}
            </p>
            <div className="admin-pagination-controls">
              <label htmlFor="doctor-page-size">
                Show
                <select
                  id="doctor-page-size"
                  value={doctorPageSize}
                  onChange={(event) => {
                    setDoctorPageSize(Number(event.target.value));
                    setDoctorPage(1);
                  }}
                >
                  {PAGE_SIZE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => setDoctorPage((current) => Math.max(1, current - 1))}
                disabled={doctorPage <= 1}
              >
                Previous
              </button>
              <span>
                Page {doctorPage} of {totalDoctorPages}
              </span>
              <button
                type="button"
                onClick={() => setDoctorPage((current) => Math.min(totalDoctorPages, current + 1))}
                disabled={doctorPage >= totalDoctorPages}
              >
                Next
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {isUnlocked && activeTab === "newsletter" ? (
        <section className="admin-wheel-panel">
          <div className="admin-wheel-panel-head">
            <div>
              <p className="admin-wheel-kicker">Bulk Email</p>
              <h2>Newsletter Send</h2>
            </div>
            <div className="admin-doctor-actions">
              <label htmlFor="newsletter-search">
                Search recipients
                <input
                  id="newsletter-search"
                  type="search"
                  value={newsletterSearch}
                  placeholder="Name, email, TikTok, clinic..."
                  onChange={(event) => {
                    setNewsletterSearch(event.target.value);
                    setNewsletterPage(1);
                  }}
                />
              </label>
              <button type="button" onClick={refreshNewsletterHistory} disabled={isLoading}>
                Refresh history
              </button>
            </div>
          </div>

          <div className="admin-newsletter-upload">
            <label htmlFor="newsletter-subject">
              Newsletter subject
              <input
                id="newsletter-subject"
                value={newsletterSubject}
                placeholder="GutGuard Doctors Newsletter"
                onChange={(event) => {
                  setNewsletterSubject(event.target.value);
                  setShowNewsletterConfirm(false);
                }}
              />
            </label>
            <label htmlFor="newsletter-html-file">
              Upload HTML file
              <input id="newsletter-html-file" type="file" accept=".html,text/html" onChange={handleNewsletterUpload} />
            </label>
            <button
              className="admin-newsletter-upload-action"
              type="button"
              onClick={() => setShowNewsletterPreview(true)}
              disabled={newsletterHtml.trim().length === 0}
            >
              Preview HTML
            </button>
            <a
              className="admin-newsletter-download"
              href="/sample-upload-newsletter.html"
              download="sample-upload-newsletter.html"
            >
              Download sample HTML
            </a>
            <div className="admin-newsletter-placeholder-box">
              <p>{newsletterFileName ? `Loaded ${newsletterFileName}` : "No newsletter uploaded yet."}</p>
              {newsletterFileError ? <strong>{newsletterFileError}</strong> : null}
              <span>Available placeholders</span>
              <div>
                {PLACEHOLDER_TOKENS.map((token) => (
                  <code key={token}>{token}</code>
                ))}
              </div>
              {detectedPlaceholders.length > 0 ? (
                <>
                  <span>Detected in uploaded HTML</span>
                  <div>
                    {detectedPlaceholders.map((token) => (
                      <code key={token}>{token}</code>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          </div>

          <div className="admin-newsletter-toolbar">
            <label className="admin-newsletter-select-all">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleVisibleNewsletterDoctors}
              />
              Select visible recipients
            </label>
            <div className="admin-newsletter-sendbox">
              <p>{selectedDoctorIds.length} selected</p>
              <button
                type="button"
                onClick={handleNewsletterSend}
                disabled={isNewsletterSending || !canSendNewsletter}
              >
                {isNewsletterSending ? "Sending" : "Review and send"}
              </button>
            </div>
          </div>

          {selectedDoctors.length > 0 ? (
            <div className="admin-newsletter-selected">
              <p>Selected emails</p>
              <div>
                {selectedDoctors.map((doctor) => (
                  <span key={doctor.id}>{doctor.email}</span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="admin-doctor-list">
            {visibleNewsletterDoctors.length > 0 ? (
              visibleNewsletterDoctors.map((doctor) => {
                const latestSend = latestNewsletterByDoctor[doctor.id];
                const doctorHistory = newsletterHistoryByDoctor[doctor.id] ?? [];
                const latestResult = newsletterResults.find((result) => result.doctorId === doctor.id);

                return (
                  <article className="admin-doctor-row newsletter" key={doctor.id}>
                    <label className="admin-newsletter-recipient">
                      <input
                        type="checkbox"
                        checked={selectedDoctorIds.includes(doctor.id)}
                        onChange={() => toggleNewsletterDoctor(doctor.id)}
                      />
                      <span>
                        <strong>{doctor.full_name || "Unnamed doctor"}</strong>
                        <em>{doctor.email}</em>
                      </span>
                    </label>
                    <dl className="admin-doctor-details">
                      <div>
                        <dt>TikTok</dt>
                        <dd>@{doctor.tiktok_username || "no-handle"}</dd>
                      </div>
                      <div>
                        <dt>Clinic</dt>
                        <dd>{doctor.practice_location || "--"}</dd>
                      </div>
                      <div>
                        <dt>Last newsletter</dt>
                        <dd>
                          {doctorHistory.length > 1 ? (
                            <button
                              className="admin-history-link"
                              type="button"
                              onClick={() => setHistoryDoctorId(doctor.id)}
                            >
                              {doctorHistory.length} newsletters sent
                            </button>
                          ) : latestSend ? (
                            `${latestSend.newsletter_title || latestSend.subject} - ${formatAdminDate(latestSend.sent_at)}`
                          ) : (
                            "Never sent"
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Send result</dt>
                        <dd>{latestResult ? formatSendResult(latestResult) : "--"}</dd>
                      </div>
                    </dl>
                  </article>
                );
              })
            ) : (
              <div className="admin-wheel-empty">
                <p>No email-ready doctors match that search.</p>
              </div>
            )}
          </div>

          <div className="admin-pagination">
            <p>
              Showing {visibleNewsletterDoctors.length > 0 ? (newsletterPage - 1) * newsletterPageSize + 1 : 0}
              {"-"}
              {Math.min(newsletterPage * newsletterPageSize, filteredNewsletterDoctors.length)} of{" "}
              {filteredNewsletterDoctors.length}
            </p>
            <div className="admin-pagination-controls">
              <label htmlFor="newsletter-page-size">
                Show
                <select
                  id="newsletter-page-size"
                  value={newsletterPageSize}
                  onChange={(event) => {
                    setNewsletterPageSize(Number(event.target.value));
                    setNewsletterPage(1);
                  }}
                >
                  {PAGE_SIZE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => setNewsletterPage((current) => Math.max(1, current - 1))}
                disabled={newsletterPage <= 1}
              >
                Previous
              </button>
              <span>
                Page {newsletterPage} of {totalNewsletterPages}
              </span>
              <button
                type="button"
                onClick={() => setNewsletterPage((current) => Math.min(totalNewsletterPages, current + 1))}
                disabled={newsletterPage >= totalNewsletterPages}
              >
                Next
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {showNewsletterPreview ? (
        <div className="admin-modal-backdrop" role="presentation">
          <section
            className="admin-modal admin-newsletter-preview-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="newsletter-preview-title"
          >
            <div className="admin-modal-head">
              <div>
                <p className="admin-wheel-kicker">Newsletter Preview</p>
                <h2 id="newsletter-preview-title">{newsletterSubject || "Uploaded HTML"}</h2>
              </div>
              <button type="button" onClick={() => setShowNewsletterPreview(false)}>
                Close
              </button>
            </div>
            <iframe
              className="admin-newsletter-preview-frame"
              title="Newsletter HTML preview"
              sandbox=""
              srcDoc={previewHtml}
            />
          </section>
        </div>
      ) : null}

      {showNewsletterConfirm ? (
        <div className="admin-modal-backdrop" role="presentation">
          <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="newsletter-confirm-title">
            <div className="admin-modal-head">
              <div>
                <p className="admin-wheel-kicker">Confirm Newsletter</p>
                <h2 id="newsletter-confirm-title">Send to {selectedDoctors.length} doctors</h2>
              </div>
              <button type="button" onClick={() => setShowNewsletterConfirm(false)}>
                Close
              </button>
            </div>
            <div className="admin-modal-body">
              <dl className="admin-confirm-summary">
                <div>
                  <dt>Subject</dt>
                  <dd>{newsletterSubject}</dd>
                </div>
                <div>
                  <dt>HTML file</dt>
                  <dd>{newsletterFileName || "Uploaded HTML"}</dd>
                </div>
              </dl>
              <div className="admin-email-list">
                {selectedDoctors.map((doctor) => (
                  <span key={doctor.id}>{doctor.email}</span>
                ))}
              </div>
            </div>
            <div className="admin-modal-actions">
              <button type="button" onClick={() => setShowNewsletterConfirm(false)}>
                Cancel
              </button>
              <button type="button" onClick={confirmNewsletterSend} disabled={isNewsletterSending}>
                {isNewsletterSending ? "Sending" : "Send newsletter"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {historyDoctor ? (
        <div className="admin-modal-backdrop" role="presentation">
          <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="newsletter-history-title">
            <div className="admin-modal-head">
              <div>
                <p className="admin-wheel-kicker">Newsletter History</p>
                <h2 id="newsletter-history-title">{historyDoctor.full_name || "Unnamed doctor"}</h2>
              </div>
              <button type="button" onClick={() => setHistoryDoctorId(null)}>
                Close
              </button>
            </div>
            <div className="admin-history-list">
              {historyItems.map((item) => (
                <article key={item.id}>
                  <strong>{item.newsletter_title || item.subject}</strong>
                  <span>
                    {item.status} - {formatAdminDate(item.sent_at)}
                  </span>
                  {item.error_message ? <p>{item.error_message}</p> : null}
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {editingDoctor ? (
        <div className="admin-modal-backdrop" role="presentation">
          <form className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="doctor-edit-title" onSubmit={saveDoctorEdit}>
            <div className="admin-modal-head">
              <div>
                <p className="admin-wheel-kicker">Edit Doctor</p>
                <h2 id="doctor-edit-title">Registration Details</h2>
              </div>
              <button type="button" onClick={() => setEditingDoctor(null)}>
                Close
              </button>
            </div>
            <div className="admin-edit-grid">
              <label>
                Name
                <input
                  required
                  value={editingDoctor.full_name}
                  onChange={(event) => setEditingDoctor({ ...editingDoctor, full_name: event.target.value })}
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={editingDoctor.email}
                  onChange={(event) => setEditingDoctor({ ...editingDoctor, email: event.target.value })}
                />
              </label>
              <label>
                Mobile
                <input
                  required
                  value={editingDoctor.mobile}
                  onChange={(event) => setEditingDoctor({ ...editingDoctor, mobile: event.target.value })}
                />
              </label>
              <label>
                TikTok username
                <input
                  required
                  value={editingDoctor.tiktok_username}
                  onChange={(event) => setEditingDoctor({ ...editingDoctor, tiktok_username: event.target.value })}
                />
              </label>
              <label>
                Specialty
                <input
                  required
                  value={editingDoctor.specialty}
                  onChange={(event) => setEditingDoctor({ ...editingDoctor, specialty: event.target.value })}
                />
              </label>
              <label>
                Clinic location
                <input
                  required
                  value={editingDoctor.practice_location}
                  onChange={(event) => setEditingDoctor({ ...editingDoctor, practice_location: event.target.value })}
                />
              </label>
            </div>
            <div className="admin-modal-actions">
              <button type="button" onClick={() => setEditingDoctor(null)}>
                Cancel
              </button>
              <button type="submit" disabled={isDoctorSaving}>
                {isDoctorSaving ? "Saving" : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {!isUnlocked ? (
        <section className="admin-wheel-empty">
          <p>Enter the admin password to load wheel prizes and doctor registrations.</p>
        </section>
      ) : null}
    </main>
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

function formatSendResult(result: NewsletterSendResult) {
  if (result.status === "sent") return "Sent";
  if (result.status === "skipped") return `Skipped${result.error ? ` - ${result.error}` : ""}`;
  return `Failed${result.error ? ` - ${result.error}` : ""}`;
}

function renderNewsletterPreview(html: string) {
  const replacements: Record<string, string> = {
    doctor_name: "Dr. Maria Santos",
    doctor_email: "doctor@example.com",
    doctor_mobile: "09171234567",
    tiktok_username: "gutguarddoctor",
    specialty: "Internal Medicine",
    clinic_location: "Makati City",
    registered_at: "Jun 12, 2026",
    prize_label: "GutGuard Tote",
  };

  return html.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
    if (!(key in replacements)) return match;
    return escapeHtml(replacements[key]);
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
