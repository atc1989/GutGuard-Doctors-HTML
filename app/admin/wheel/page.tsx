"use client";

import { FormEvent, useMemo, useState } from "react";
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
  getNewsletterSendHistory?: (adminPassword: string) => Promise<NewsletterSendHistory[]>;
  sendNewsletter?: (
    adminPassword: string,
    doctorIds: string[],
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
const DOCTORS_PER_PAGE = 8;
const NEWSLETTER_RECIPIENTS_PER_PAGE = 8;

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
  const [newsletterSearch, setNewsletterSearch] = useState("");
  const [newsletterPage, setNewsletterPage] = useState(1);
  const [selectedDoctorIds, setSelectedDoctorIds] = useState<string[]>([]);
  const [newsletterHistory, setNewsletterHistory] = useState<NewsletterSendHistory[]>([]);
  const [newsletterResults, setNewsletterResults] = useState<NewsletterSendResult[]>([]);
  const [isNewsletterSending, setIsNewsletterSending] = useState(false);
  const [needsNewsletterConfirm, setNeedsNewsletterConfirm] = useState(false);
  const [newPrize, setNewPrize] = useState<AdminWheelPrize>(emptyPrize);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
  const totalDoctorPages = Math.max(1, Math.ceil(filteredDoctors.length / DOCTORS_PER_PAGE));
  const visibleDoctors = filteredDoctors.slice(
    (doctorPage - 1) * DOCTORS_PER_PAGE,
    doctorPage * DOCTORS_PER_PAGE,
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
    Math.ceil(filteredNewsletterDoctors.length / NEWSLETTER_RECIPIENTS_PER_PAGE),
  );
  const visibleNewsletterDoctors = filteredNewsletterDoctors.slice(
    (newsletterPage - 1) * NEWSLETTER_RECIPIENTS_PER_PAGE,
    newsletterPage * NEWSLETTER_RECIPIENTS_PER_PAGE,
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
  const visibleSelectedCount = visibleNewsletterDoctors.filter((doctor) =>
    selectedDoctorIds.includes(doctor.id),
  ).length;
  const allVisibleSelected =
    visibleNewsletterDoctors.length > 0 && visibleSelectedCount === visibleNewsletterDoctors.length;

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
    setNeedsNewsletterConfirm(false);
    setSelectedDoctorIds((current) =>
      current.includes(doctorId)
        ? current.filter((id) => id !== doctorId)
        : [...current, doctorId],
    );
  }

  function toggleVisibleNewsletterDoctors() {
    setNeedsNewsletterConfirm(false);
    const visibleIds = visibleNewsletterDoctors.map((doctor) => doctor.id);
    setSelectedDoctorIds((current) => {
      if (visibleIds.every((id) => current.includes(id))) {
        return current.filter((id) => !visibleIds.includes(id));
      }

      return Array.from(new Set([...current, ...visibleIds]));
    });
  }

  async function handleNewsletterSend() {
    if (selectedDoctorIds.length === 0) return;

    if (!needsNewsletterConfirm) {
      setNeedsNewsletterConfirm(true);
      return;
    }

    setError(null);
    setNotice(null);
    setNewsletterResults([]);
    setIsNewsletterSending(true);

    try {
      const api = await loadWheelApi();
      if (!api.sendNewsletter) {
        throw new Error("Missing sendNewsletter helper in lib/api.ts.");
      }

      const response = await api.sendNewsletter(password, selectedDoctorIds);
      setNewsletterResults(response.results);
      setNotice(
        `Newsletter complete: ${response.sent} sent, ${response.failed} failed, ${response.skipped} skipped.`,
      );
      setNeedsNewsletterConfirm(false);
      await refreshNewsletterHistory();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to send newsletter.");
    } finally {
      setIsNewsletterSending(false);
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
            id="admin-password"
            type="password"
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
              Showing {visibleDoctors.length > 0 ? (doctorPage - 1) * DOCTORS_PER_PAGE + 1 : 0}
              {"-"}
              {Math.min(doctorPage * DOCTORS_PER_PAGE, filteredDoctors.length)} of {filteredDoctors.length}
            </p>
            <div className="admin-pagination-controls">
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
              <p>
                {selectedDoctorIds.length} selected
                {needsNewsletterConfirm ? " - click send again to confirm" : ""}
              </p>
              <button
                type="button"
                onClick={handleNewsletterSend}
                disabled={isNewsletterSending || selectedDoctorIds.length === 0}
              >
                {isNewsletterSending
                  ? "Sending"
                  : needsNewsletterConfirm
                    ? `Confirm send to ${selectedDoctorIds.length}`
                    : "Send newsletter"}
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
                          {latestSend
                            ? `${latestSend.status} - ${formatAdminDate(latestSend.sent_at)}`
                            : "Never sent"}
                        </dd>
                      </div>
                      <div>
                        <dt>This send</dt>
                        <dd>{latestResult ? latestResult.status : "--"}</dd>
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
              Showing {visibleNewsletterDoctors.length > 0 ? (newsletterPage - 1) * NEWSLETTER_RECIPIENTS_PER_PAGE + 1 : 0}
              {"-"}
              {Math.min(newsletterPage * NEWSLETTER_RECIPIENTS_PER_PAGE, filteredNewsletterDoctors.length)} of{" "}
              {filteredNewsletterDoctors.length}
            </p>
            <div className="admin-pagination-controls">
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
