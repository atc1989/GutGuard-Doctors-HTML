"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  getPartnerWallet, requestPartnerWithdrawal, type PartnerWallet, type PartnerWithdrawal, type WithdrawalMethod,
} from "@/lib/api";
import { EmptyState, Loading, PageHeader, StatTile, formatDate } from "./shared";

// Must match request_partner_withdrawal (20261030000000_partner_wallet.sql).
const MIN_WITHDRAWAL = 500;
const FEE = 60;

const METHODS: Record<WithdrawalMethod, string> = { gcash: "GCash", maya: "Maya", bank: "Bank transfer" };
const STATUS_LABELS: Record<PartnerWithdrawal["status"], string> = { pending: "Pending", approved: "Approved", rejected: "Rejected" };

// Centavos matter here, unlike the whole-peso `peso` used for sales.
const money = (value: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 }).format(value);

function errorMessage(error: unknown, fallback: string) {
  const message = error && typeof error === "object" ? (error as { message?: unknown }).message : undefined;
  return typeof message === "string" && message ? message : fallback;
}

export default function WalletPage() {
  const [wallet, setWallet] = useState<PartnerWallet | null>(null);
  const [loadError, setLoadError] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<WithdrawalMethod | "">("");
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");

  function load() {
    return getPartnerWallet()
      .then((next) => { setWallet(next); setLoadError(""); })
      .catch(() => setLoadError("Your wallet could not be loaded. Please try again."));
  }

  useEffect(() => { load(); }, []);

  const requested = Number(amount) || 0;
  const net = requested >= MIN_WITHDRAWAL ? requested - FEE : 0;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!wallet || !method) return;
    setFormError("");
    setNotice("");
    if (requested < MIN_WITHDRAWAL) return setFormError(`The minimum withdrawal is ${money(MIN_WITHDRAWAL)}.`);
    if (requested > wallet.available) return setFormError("That is more than your available balance.");
    setBusy(true);
    try {
      await requestPartnerWithdrawal({ amount: requested, method, accountName, accountNumber, bankName });
      setAmount("");
      setNotice(`Withdrawal of ${money(requested)} sent for approval. You will receive ${money(requested - FEE)}.`);
      await load();
    } catch (error) {
      setFormError(errorMessage(error, "The request could not be sent. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  if (!wallet) {
    return loadError ? <EmptyState title={loadError} /> : <Loading>Loading your wallet…</Loading>;
  }

  const canWithdraw = wallet.available >= MIN_WITHDRAWAL;

  return (
    <>
      <PageHeader kicker="Wallet" title="Rebate wallet" />

      <section className="pp-stats" aria-label="Wallet balance">
        <StatTile label="Available" value={money(wallet.available)} note="Ready to withdraw" />
        <StatTile label="Pending" value={money(wallet.pending)} note="Waiting for approval" />
        <StatTile label="Withdrawn" value={money(wallet.withdrawn)} note="Approved payouts" />
        <StatTile label="Rebates earned" value={money(wallet.earned)} note="From G-Points milestones" />
      </section>

      <section className="pp-card" aria-labelledby="pp-withdraw-title">
        <div className="pp-card-head"><h2 id="pp-withdraw-title">Request a withdrawal</h2></div>
        <p className="pp-muted">
          Minimum {money(MIN_WITHDRAWAL)}. A fixed {money(FEE)} processing fee is deducted from the amount you request.
          Every request is reviewed by an admin before it is sent.
        </p>
        {canWithdraw ? (
          <form className="partner-form pp-wallet-form" onSubmit={submit}>
            <label htmlFor="wd-amount">Amount (PHP)</label>
            <input
              id="wd-amount" type="number" inputMode="decimal" min={MIN_WITHDRAWAL} max={wallet.available} step="0.01" required
              value={amount} onChange={(event) => setAmount(event.target.value)} placeholder={`${MIN_WITHDRAWAL} to ${wallet.available}`}
            />
            <label htmlFor="wd-method">Payout method</label>
            <select id="wd-method" required value={method} onChange={(event) => setMethod(event.target.value as WithdrawalMethod)}>
              <option value="" disabled>Select a payout method</option>
              {Object.entries(METHODS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            {method === "bank" ? (
              <>
                <label htmlFor="wd-bank">Bank name</label>
                <input id="wd-bank" required maxLength={80} value={bankName} onChange={(event) => setBankName(event.target.value)} placeholder="e.g. BDO" />
              </>
            ) : null}
            <label htmlFor="wd-account-name">Account name</label>
            <input id="wd-account-name" required maxLength={120} autoComplete="name" value={accountName} onChange={(event) => setAccountName(event.target.value)} />
            <label htmlFor="wd-account-number">{method === "bank" ? "Account number" : "Mobile number"}</label>
            <input
              id="wd-account-number" required maxLength={40} inputMode={method === "bank" ? "numeric" : "tel"}
              value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)}
            />

            <dl className="pp-wallet-summary">
              <div><dt>Requested amount</dt><dd>{money(requested)}</dd></div>
              <div><dt>Processing fee</dt><dd>−{money(requested >= MIN_WITHDRAWAL ? FEE : 0)}</dd></div>
              <div className="is-total"><dt>You receive</dt><dd>{money(net)}</dd></div>
            </dl>

            {formError ? <p className="shop-error" role="alert">{formError}</p> : null}
            <button type="submit" className="shop-primary" disabled={busy}>{busy ? "Sending…" : "Request withdrawal"}</button>
          </form>
        ) : (
          <p className="pp-muted"><strong>You can withdraw once your available balance reaches {money(MIN_WITHDRAWAL)}.</strong></p>
        )}
        {notice ? <p className="pp-wallet-notice" role="status">{notice}</p> : null}
      </section>

      <h2 className="pp-h2">Withdrawal history</h2>
      <section className="pp-card pp-card-flush" aria-label="Withdrawal history">
        {wallet.withdrawals.length ? (
          <ul className="pp-log">
            {wallet.withdrawals.map((item) => (
              <li key={item.id}>
                <span>
                  <strong>
                    {money(item.amount)}{" "}
                    <span className={`partner-badge ${item.status === "approved" ? "paid" : item.status}`}>{STATUS_LABELS[item.status]}</span>
                  </strong>
                  <small>
                    {item.method === "bank" ? item.bank_name : METHODS[item.method]} · {item.account_name} · {item.account_number}
                  </small>
                  <small>
                    Requested {formatDate(item.created_at)}
                    {item.processed_at ? ` · Processed ${formatDate(item.processed_at)}` : ""}
                  </small>
                  {item.reference ? <small>Reference: {item.reference}</small> : null}
                  {item.status === "rejected" && item.admin_note ? <small>Reason: {item.admin_note}</small> : null}
                </span>
                <span className="pp-log-end">
                  <b>{money(item.amount - item.fee)}</b>
                  <small>net of {money(item.fee)} fee</small>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No withdrawals yet.">Your requests and their status will show here.</EmptyState>
        )}
      </section>
    </>
  );
}
