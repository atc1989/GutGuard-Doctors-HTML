"use client";

import { useEffect, useState, type FormEvent } from "react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { NAV_GROUPS } from "@/components/admin/AdminShell";

type StaffMember = { id: string; username: string; modules: string[]; active: boolean; created_at: string };
type Draft = { id: string | null; username: string; password: string; modules: string[] };

// The checklist is the admin menu itself, minus the Dashboard (open to all) and this page (super admin only).
const SECTION_GROUPS = NAV_GROUPS.map((group) => ({
  title: group.title,
  items: group.items
    .map((item) => ({ key: item.href.split("/")[2], label: item.label }))
    .filter((item) => item.key && item.key !== "staff"),
})).filter((group) => group.items.length);
const LABELS = Object.fromEntries(SECTION_GROUPS.flatMap((group) => group.items.map((item) => [item.key, item.label])));

async function call<T>(method: string, body?: unknown, query = ""): Promise<T> {
  const res = await fetch(`/api/admin/staff${query}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed.");
  return data as T;
}

/** Super admin only: staff logins and the admin sections each one can open. */
export default function AdminStaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    try {
      setStaff((await call<{ staff: StaffMember[] }>("GET")).staff);
      setLoaded(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load staff.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(done);
      await load();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const { id, username, password, modules } = draft;
    const ok = id
      ? await run(() => call("PATCH", { id, modules, ...(password ? { password } : {}) }), `${username} saved.`)
      : await run(() => call("POST", { username, password, modules }), `${username} created. Share the password with them privately.`);
    if (ok) setDraft(null);
  }

  const toggle = (key: string, on: boolean) =>
    draft && setDraft({ ...draft, modules: on ? [...draft.modules, key] : draft.modules.filter((m) => m !== key) });

  return (
    <div className="admin-wheel-shell">
      <AdminPageHeader kicker="Settings" title="Staff Accounts" description="Logins for your team and the sections each one can open." />

      {notice ? <div className="admin-wheel-alert">{notice}</div> : null}
      {error ? <div className="admin-wheel-alert error">{error}</div> : null}

      {loaded ? (
        <section className="admin-wheel-panel">
          <div className="admin-wheel-panel-head">
            <div>
              <p className="admin-wheel-kicker">Accounts</p>
              <h2>{staff.length} staff {staff.length === 1 ? "login" : "logins"}</h2>
            </div>
            <p>
              You sign in as <strong>admin</strong> and can open everything. Staff only see the sections ticked
              here; changes apply on their next click.
            </p>
          </div>

          {draft ? (
            <form className="admin-wheel-prize" onSubmit={save}>
              <div className="admin-wheel-prize-main">
                <div className="admin-wheel-grid">
                  <label>
                    Username
                    <input
                      value={draft.username}
                      onChange={(event) => setDraft({ ...draft, username: event.target.value.toLowerCase() })}
                      placeholder="e.g. ana"
                      pattern="[a-z0-9_\-]{3,32}"
                      title="3–32 lowercase letters, numbers, - or _"
                      autoCapitalize="none"
                      autoComplete="off"
                      disabled={Boolean(draft.id)}
                      required
                    />
                  </label>
                  <label>
                    {draft.id ? "New password (blank = keep; a new one signs them out)" : "Password"}
                    <input
                      type="text"
                      value={draft.password}
                      onChange={(event) => setDraft({ ...draft, password: event.target.value })}
                      minLength={8}
                      autoComplete="new-password"
                      required={!draft.id}
                    />
                  </label>
                </div>

                {SECTION_GROUPS.map((group) => (
                  <fieldset key={group.title} style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 6 }}>
                    <legend className="admin-wheel-kicker">{group.title}</legend>
                    {group.items.map((item) => (
                      <label key={item.key} className="admin-wheel-toggle">
                        <input
                          type="checkbox"
                          checked={draft.modules.includes(item.key)}
                          onChange={(event) => toggle(item.key, event.target.checked)}
                        />
                        {item.label}
                      </label>
                    ))}
                  </fieldset>
                ))}
              </div>

              <div className="admin-wheel-prize-footer">
                <button type="button" onClick={() => setDraft(null)} disabled={busy}>
                  Cancel
                </button>
                <button type="submit" disabled={busy}>
                  {busy ? "Saving" : draft.id ? "Save account" : "Create account"}
                </button>
              </div>
            </form>
          ) : (
            <div className="admin-table-row-actions">
              <button type="button" onClick={() => setDraft({ id: null, username: "", password: "", modules: [] })}>
                New staff account
              </button>
            </div>
          )}

          {staff.length ? (
            <div className="admin-shops-table-wrap">
              <table className="admin-shops-table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Can open</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {staff.map((member) => (
                    <tr key={member.id}>
                      <td>
                        <strong>{member.username}</strong>
                      </td>
                      <td>{member.modules.length ? member.modules.map((key) => LABELS[key] ?? key).join(", ") : "Dashboard only"}</td>
                      <td>{member.active ? "Active" : "Turned off"}</td>
                      <td>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            className="admin-overview-action-btn"
                            disabled={busy}
                            onClick={() => setDraft({ id: member.id, username: member.username, password: "", modules: member.modules })}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="admin-overview-action-btn"
                            disabled={busy}
                            onClick={() =>
                              run(
                                () => call("PATCH", { id: member.id, active: !member.active }),
                                `${member.username} turned ${member.active ? "off" : "on"}.`,
                              )
                            }
                          >
                            {member.active ? "Turn off" : "Turn on"}
                          </button>
                          <button
                            type="button"
                            className="admin-overview-action-btn"
                            disabled={busy}
                            onClick={() =>
                              window.confirm(`Delete ${member.username}? They are signed out and can't log in again.`) &&
                              run(() => call("DELETE", undefined, `?id=${encodeURIComponent(member.id)}`), `${member.username} deleted.`)
                            }
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">No staff accounts yet.</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
