"use client";

import { useEffect, useState, type FormEvent } from "react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import type { AdminWithdrawal } from "@/lib/admin-server-api";

const money = (value: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 }).format(value);
const when = (value: string) =>
  new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));

const METHODS: Record<string, string> = { gcash: "GCash", maya: "Maya", bank: "Bank" };
type Filter = "pending" | "approved" | "rejected" | "all";

/** Partners request payouts from /partner/wallet; admin sends the money, then approves here with the reference. */
export default function AdminWithdrawalsPage() {
  const [loaded, setLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawal[]>([]);
  const [filter, setFilter] = useState<Filter>("pending");
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<{ id: string; status: "approved" | "rejected" } | null>(null);
  const [input, setInput] = useState("");

  // AdminShell only renders this page once the admin session is valid.
  useEffect(() => {
    load();
  }, []);

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/withdrawals");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not load withdrawals.");
      setWithdrawals(data.withdrawals);
      setLoaded(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load withdrawals.");
    } finally {
      setIsLoading(false);
    }
  }

  // Inline form, not window.prompt: in-app browsers and some phones block prompts.
  async function process(event: FormEvent, item: AdminWithdrawal) {
    event.preventDefault();
    if (!acting || !input.trim()) return;
    const { status } = acting;

    setBusyId(item.id);
    setError(null);
    try {
      const res = await fetch("/api/admin/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(status === "approved" ? { id: item.id, status, reference: input } : { id: item.id, status, note: input }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not update the withdrawal.");
      setActing(null);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update the withdrawal.");
    } finally {
      setBusyId(null);
    }
  }

  const visible = filter === "all" ? withdrawals : withdrawals.filter((item) => item.status === filter);
  const pendingTotal = withdrawals.filter((item) => item.status === "pending").reduce((sum, item) => sum + item.amount - item.fee, 0);

  return (
    <div className="admin-wheel-shell admin-shop-orders-shell">
      <AdminPageHeader kicker="Partner payouts" title="Withdrawals" description="Rebate withdrawal requests from partners.">
        <button type="button" className="admin-overview-action-btn" onClick={load} disabled={isLoading}>
          {isLoading ? "Loading" : "Refresh"}
        </button>
      </AdminPageHeader>

      {error ? <div className="admin-wheel-alert error">{error}</div> : null}

      {loaded ? (
        <section className="admin-wheel-panel">
          <div className="admin-wheel-panel-head">
            <div>
              <p className="admin-wheel-kicker">Requests</p>
              <h2>{withdrawals.filter((item) => item.status === "pending").length} pending · {money(pendingTotal)} to send</h2>
            </div>
            <p>
              Send the net amount to the partner&apos;s account first, then approve with the transfer reference. Rejecting
              returns the full amount to the partner&apos;s wallet.
            </p>
          </div>

          <div className="admin-shops-toolbar">
            <label>
              Status
              <select value={filter} onChange={(event) => setFilter(event.target.value as Filter)}>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="all">All</option>
              </select>
            </label>
          </div>

          {visible.length ? (
            <div className="admin-shops-table-wrap">
              <table className="admin-shops-table">
                <thead>
                  <tr>
                    <th>Partner</th>
                    <th>Requested</th>
                    <th className="num">Amount</th>
                    <th className="num">Fee</th>
                    <th className="num">Send</th>
                    <th>Pay to</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.partner_name || "Unnamed partner"}</strong>
                        <small>{item.partner_mobile || item.partner_email}</small>
                      </td>
                      <td>{when(item.created_at)}</td>
                      <td className="num">{money(item.amount)}</td>
                      <td className="num">{money(item.fee)}</td>
                      <td className="num"><strong>{money(item.amount - item.fee)}</strong></td>
                      <td>
                        <strong>{item.method === "bank" ? `${METHODS.bank} · ${item.bank_name}` : METHODS[item.method]}</strong>
                        <small>{item.account_name}</small>
                        <small>{item.account_number}</small>
                      </td>
                      <td>
                        {item.status}
                        {item.processed_at ? <small>{when(item.processed_at)}</small> : null}
                        {item.reference ? <small>Ref: {item.reference}</small> : null}
                        {item.admin_note ? <small>{item.admin_note}</small> : null}
                      </td>
                      <td>
                        {item.status !== "pending" ? null : acting?.id === item.id ? (
                          <form onSubmit={(event) => process(event, item)} style={{ display: "grid", gap: 6, minWidth: 220 }}>
                            <label>
                              {acting.status === "approved"
                                ? `Send ${money(item.amount - item.fee)} first, then enter the transfer reference`
                                : "Reason for rejecting (the partner sees this)"}
                              <input
                                autoFocus required maxLength={acting.status === "approved" ? 120 : 500}
                                value={input} onChange={(event) => setInput(event.target.value)}
                                aria-label={acting.status === "approved" ? "Transfer reference" : "Rejection reason"}
                              />
                            </label>
                            <div style={{ display: "flex", gap: 8 }}>
                              <button type="submit" className="admin-overview-action-btn" disabled={busyId === item.id}>
                                {acting.status === "approved" ? "Confirm approve" : "Confirm reject"}
                              </button>
                              <button type="button" className="admin-overview-action-btn" disabled={busyId === item.id} onClick={() => setActing(null)}>
                                Cancel
                              </button>
                            </div>
                          </form>
                        ) : (
                          <div style={{ display: "flex", gap: 8 }}>
                            <button type="button" className="admin-overview-action-btn" onClick={() => { setActing({ id: item.id, status: "approved" }); setInput(""); }}>
                              Approve
                            </button>
                            <button type="button" className="admin-overview-action-btn" onClick={() => { setActing({ id: item.id, status: "rejected" }); setInput(""); }}>
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">No {filter === "all" ? "" : `${filter} `}withdrawals.</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
