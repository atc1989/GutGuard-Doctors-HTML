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

type WheelApi = {
  getWheelPrizes?: (adminPassword: string) => Promise<AdminWheelPrize[]>;
  saveWheelPrize?: (adminPassword: string, prize: AdminWheelPrize) => Promise<AdminWheelPrize>;
  createWheelPrize?: (
    adminPassword: string,
    prize: Omit<AdminWheelPrize, "id">,
  ) => Promise<AdminWheelPrize>;
  getDoctorRegistrations?: (adminPassword: string) => Promise<AdminDoctorRegistration[]>;
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
  const [activeTab, setActiveTab] = useState<"wheel" | "doctors">("wheel");
  const [password, setPassword] = useState("");
  const [prizes, setPrizes] = useState<AdminWheelPrize[]>([]);
  const [doctors, setDoctors] = useState<AdminDoctorRegistration[]>([]);
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

      const [loadedPrizes, loadedDoctors] = await Promise.all([
        api.getWheelPrizes(password),
        api.getDoctorRegistrations ? api.getDoctorRegistrations(password) : Promise.resolve([]),
      ]);
      setPrizes(loadedPrizes.sort((a, b) => a.sort_order - b.sort_order));
      setDoctors(loadedDoctors);
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
      setNotice("Doctor registrations refreshed.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load doctor registrations.");
    } finally {
      setIsLoading(false);
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
          <span>{activeTab === "wheel" ? `${prizes.length} prizes` : `${doctors.length} doctors`}</span>
          <strong>{activeTab === "wheel" ? activeWeightTotal : doctors.length}</strong>
          <span>{activeTab === "wheel" ? "active weight" : "registrations"}</span>
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
            <button type="button" onClick={refreshDoctors} disabled={isLoading}>
              {isLoading ? "Refreshing" : "Refresh"}
            </button>
          </div>

          <div className="admin-doctor-list">
            {doctors.length > 0 ? (
              doctors.map((doctor) => (
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
                <p>No doctor registrations found.</p>
              </div>
            )}
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
