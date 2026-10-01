"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, Copy, Users, X } from "lucide-react";
import { CYCLE_TARGET, EmptyState, PageHeader, Pagination, StatTile, formatDate, peso, useCopy, usePartner } from "./shared";

const MILESTONES = [
  { pts: 300, rebate: 18000, label: "Initial movement milestone" },
  { pts: 750, rebate: 70000, label: "Mid-level movement milestone" },
  { pts: 1500, rebate: 150000, label: "Full cycle target milestone" },
];

export default function EPointsPage() {
  const { dashboard } = usePartner();
  const { points, rebates, point_sources: sources = [] } = dashboard;
  const { copied, copy } = useCopy();
  const [tab, setTab] = useState<"rebates" | "points">("rebates");
  const [pointsFilter, setPointsFilter] = useState<"direct" | "referred" | "all">("direct");
  const [pointsOffset, setPointsOffset] = useState(0);
  const [pointsPageSize, setPointsPageSize] = useState(10);
  const [rebateOffset, setRebateOffset] = useState(0);
  const [rebatePageSize, setRebatePageSize] = useState(10);
  const [selectedSource, setSelectedSource] = useState<typeof sources[number] | null>(null);
  const [selectedRebate, setSelectedRebate] = useState<typeof rebates[number] | null>(null);

  useEffect(() => {
    if (!selectedSource && !selectedRebate) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedSource(null);
        setSelectedRebate(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selectedSource, selectedRebate]);

  const directSources = sources.filter((s) => s.depth === 0);
  const referredSources = sources.filter((s) => s.depth === 1);
  const activeSources = pointsFilter === "direct" ? directSources : pointsFilter === "referred" ? referredSources : sources;
  const visibleSources = activeSources.slice(pointsOffset, pointsOffset + pointsPageSize);
  const visibleRebates = rebates.slice(rebateOffset, rebateOffset + rebatePageSize);

  return (
    <>
      <PageHeader
        kicker="E-Points & Rebates"
        title="Point Balances & Cash Rebates"
        lede="Track your personal shop sales points and group pass-up points separately. Unlock cash rebates as milestones are achieved."
      />

      {/* Top Overview Stats Bar */}
      <section className="pp-stats" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }} aria-label="E-Points summary">
        <StatTile label="Direct Shop Points" value={`${points.own_points} pts`} note="kept from direct customer orders" />
        <StatTile label="Referred Pass-Up Points" value={`${points.passup_points} pts`} note="earned from referred downline partners" />
        <StatTile label="Passed Up to Upline" value={`${points.passed_up_to_upline_points} pts`} note="passed up to your sponsor/upline" />
        <StatTile label={`Cycle ${points.current_cycle} Balance`} value={`${points.points_in_cycle} pts`} note={`Target: ${CYCLE_TARGET} pts`} />
      </section>

      {/* Main Tab Bar (Shortened, no numbers) */}
      <div className="pp-seg" role="tablist" aria-label="E-Points view">
        <button type="button" role="tab" aria-selected={tab === "rebates"} className={tab === "rebates" ? "active" : ""} onClick={() => setTab("rebates")}>
          Rebates
        </button>
        <button type="button" role="tab" aria-selected={tab === "points"} className={tab === "points" ? "active" : ""} onClick={() => setTab("points")}>
          Points Log
        </button>
      </div>

      {tab === "rebates" ? (
        <>
          {/* Track A: My Shop Sales Rebate Track */}
          <section className="pp-card" aria-label="Track A My Shop Sales Rebate Track" style={{ marginBottom: 24, border: "1px solid var(--rule)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: 0 }}>Track A: My Shop Sales Rebate Track</h3>
                <small style={{ color: "var(--ink-3)", fontSize: 13 }}>Direct Customer Orders</small>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ink)", background: "var(--bone-soft)", padding: "4px 10px", borderRadius: 4 }}>
                Direct Sales Track
              </span>
            </div>
            <div className="pp-progress-labels">
              <strong>{points.own_points} / {CYCLE_TARGET} Direct E-Points (Cycle {points.current_cycle})</strong>
              <span>{Math.min(100, Math.round((points.own_points / CYCLE_TARGET) * 100))}%</span>
            </div>
            <div className="pp-progress" role="progressbar" aria-valuemin={0} aria-valuemax={CYCLE_TARGET} aria-valuenow={Math.min(points.own_points, CYCLE_TARGET)} aria-label="Direct sales cycle progress">
              <div style={{ width: `${Math.min(100, (points.own_points / CYCLE_TARGET) * 100)}%`, background: "var(--gold)" }} />
            </div>

            <div className="pp-milestones" style={{ marginTop: 16 }}>
              {MILESTONES.map((m) => {
                const unlocked = points.own_points >= m.pts;
                return (
                  <article key={`direct-${m.pts}`} className={unlocked ? "pp-milestone unlocked" : "pp-milestone"}>
                    <span>{unlocked ? "✓ Unlocked!" : `🎯 ${m.pts} Direct Pts (${points.own_points} / ${m.pts} pts)`}</span>
                    <strong>{peso(m.rebate)}</strong>
                    <small>{m.label}</small>
                  </article>
                );
              })}
            </div>
          </section>

          {/* Track B: Referred Partners Rebate Track */}
          <section className="pp-card" aria-label="Track B Referred Partners Rebate Track" style={{ marginBottom: 24, border: "1px solid var(--blue-soft, #eef2ff)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--blue)", margin: 0 }}>Track B: Referred Partners Rebate Track</h3>
                <small style={{ color: "var(--ink-3)", fontSize: 13 }}>Group Pass-Ups</small>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--blue)", background: "rgba(4,6,122,0.08)", padding: "4px 10px", borderRadius: 4 }}>
                Referred Group Target
              </span>
            </div>
            <div className="pp-progress-labels">
              <strong>{points.passup_points} / {CYCLE_TARGET} Referred E-Points (Cycle {points.current_cycle})</strong>
              <span>{Math.min(100, Math.round((points.passup_points / CYCLE_TARGET) * 100))}%</span>
            </div>
            <div className="pp-progress" role="progressbar" aria-valuemin={0} aria-valuemax={CYCLE_TARGET} aria-valuenow={Math.min(points.passup_points, CYCLE_TARGET)} aria-label="Referred pass-up cycle progress">
              <div style={{ width: `${Math.min(100, (points.passup_points / CYCLE_TARGET) * 100)}%`, background: "var(--blue)" }} />
            </div>

            <div className="pp-milestones" style={{ marginTop: 16 }}>
              {MILESTONES.map((m) => {
                const unlocked = points.passup_points >= m.pts;
                return (
                  <article key={`referred-${m.pts}`} className={unlocked ? "pp-milestone unlocked" : "pp-milestone"}>
                    <span>{unlocked ? "✓ Unlocked!" : `🎯 ${m.pts} Referred Pts (${points.passup_points} / ${m.pts} pts)`}</span>
                    <strong>{peso(m.rebate)}</strong>
                    <small>{m.label}</small>
                  </article>
                );
              })}
            </div>
          </section>

          <h2 className="pp-h2">{rebates.length ? `${rebates.length} unlocked ${rebates.length === 1 ? "milestone" : "milestones"}` : "Rebate history"}</h2>
          <section className="pp-card pp-card-flush" aria-label="Rebate history">
            {rebates.length ? (
              <>
                <ul className="pp-log">
                  {visibleRebates.map((rebate, index) => (
                    <li
                      key={index}
                      className="pp-log-item-interactive"
                      onClick={() => setSelectedRebate(rebate)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedRebate(rebate);
                        }
                      }}
                      aria-label={`View details for Cycle ${rebate.cycle_number} milestone`}
                    >
                      <div className="pp-log-lead">
                        <div className="pp-log-title-row">
                          <strong className="pp-log-title">Cycle {rebate.cycle_number} Milestone</strong>
                          <span className={rebate.status === "paid" ? "pp-tag pp-tag-success" : "pp-tag pp-tag-warning"}>
                            {rebate.status === "paid" ? "Paid Out" : "Awaiting Payout"}
                          </span>
                        </div>
                        <span className="pp-log-date">{formatDate(rebate.created_at)} · {rebate.milestone_pts} pts</span>
                      </div>

                      <div className="pp-log-trail">
                        <b className="is-gold pp-log-pts">{peso(rebate.rebate_amount)}</b>
                        <ChevronRight size={16} className="pp-log-chevron" aria-hidden="true" />
                      </div>
                    </li>
                  ))}
                </ul>
                <Pagination
                  label="Rebate history pages"
                  offset={rebateOffset}
                  pageSize={rebatePageSize}
                  total={rebates.length}
                  shown={visibleRebates.length}
                  noun="milestones"
                  onOffset={(next) => setRebateOffset(next)}
                  onPageSize={(next) => { setRebatePageSize(next); setRebateOffset(0); }}
                />
              </>
            ) : (
              <EmptyState title="No milestones unlocked yet.">Earn points from your direct referrals and their orders to unlock cash rebates.</EmptyState>
            )}
          </section>
        </>
      ) : (
        <>
          {/* Sub-Tab Bar (Shortened, no numbers, clean layout) */}
          <div className="pp-seg" style={{ marginTop: 0, marginBottom: 16 }} role="tablist" aria-label="Filter points origin">
            <button type="button" role="tab" aria-selected={pointsFilter === "direct"} className={pointsFilter === "direct" ? "active" : ""} onClick={() => { setPointsFilter("direct"); setPointsOffset(0); }}>
              My Shop
            </button>
            <button type="button" role="tab" aria-selected={pointsFilter === "referred"} className={pointsFilter === "referred" ? "active" : ""} onClick={() => { setPointsFilter("referred"); setPointsOffset(0); }}>
              Referred
            </button>
            <button type="button" role="tab" aria-selected={pointsFilter === "all"} className={pointsFilter === "all" ? "active" : ""} onClick={() => { setPointsFilter("all"); setPointsOffset(0); }}>
              All Activity
            </button>
          </div>

          {/* Link banner to Team Hierarchy when Referred filter is active */}
          {pointsFilter === "referred" && (
            <div
              className="pp-card"
              style={{
                marginBottom: 16,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 18px",
                background: "var(--paper)",
                border: "1px solid var(--rule-soft)",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div>
                <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-3)" }}>
                  Network Performance
                </span>
                <strong style={{ display: "block", fontSize: 15, color: "var(--ink)", marginTop: 2 }}>
                  {points.passup_points} Referred E-Points from {referredSources.length} Downline Orders
                </strong>
              </div>
              <Link href="/partner/partners" className="shop-secondary" style={{ minHeight: 38, padding: "0 16px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Users size={16} aria-hidden="true" />
                <span>View Team Hierarchy →</span>
              </Link>
            </div>
          )}

          {/* Points Log Card with Pagination */}
          <section className="pp-card pp-card-flush" aria-label="Points log">
            {activeSources.length ? (
              <>
                <ul className="pp-log">
                  {visibleSources.map((source, index) => {
                    const isPassup = source.depth === 1;
                    const title = isPassup ? (source.source_partner || "Referred Partner") : `Order ${source.order_code}`;
                    return (
                      <li
                        key={`${source.order_code}-${index}`}
                        className="pp-log-item-interactive"
                        onClick={() => setSelectedSource(source)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedSource(source);
                          }
                        }}
                        aria-label={`View details for ${title}`}
                      >
                        <div className="pp-log-lead">
                          <div className="pp-log-title-row">
                            <strong className="pp-log-title">{title}</strong>
                            {pointsFilter === "all" ? (
                              <span className={isPassup ? "pp-tag pp-tag-blue" : "pp-tag pp-tag-bone"}>
                                {isPassup ? "Pass-Up" : "Direct"}
                              </span>
                            ) : null}
                          </div>
                          <span className="pp-log-date">{formatDate(source.created_at)}</span>
                        </div>
                        <div className="pp-log-trail">
                          <b className={isPassup ? "is-passup pp-log-pts" : "pp-log-pts"}>
                            +{source.points} {source.points === 1 ? "pt" : "pts"}
                          </b>
                          <ChevronRight size={16} className="pp-log-chevron" aria-hidden="true" />
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <Pagination
                  label="Points log pages"
                  offset={pointsOffset}
                  pageSize={pointsPageSize}
                  total={activeSources.length}
                  shown={visibleSources.length}
                  noun="transactions"
                  onOffset={(next) => setPointsOffset(next)}
                  onPageSize={(next) => { setPointsPageSize(next); setPointsOffset(0); }}
                />
              </>
            ) : (
              <EmptyState title={pointsFilter === "direct" ? "No direct shop points yet." : pointsFilter === "referred" ? "No pass-up points from referred partners yet." : "No points recorded yet."}>
                {pointsFilter === "direct"
                  ? "Points earned from customers purchasing via your shop link will appear here."
                  : pointsFilter === "referred"
                  ? "Points passed up when partners you referred get paid orders will appear here."
                  : "Points from direct orders and referred partners will appear here."}
              </EmptyState>
            )}
          </section>
        </>
      )}

      {/* Detail Bottom Sheet / Modal (GutGuard Design System Drawer & Modal) */}
      {selectedSource ? (
        <div className="pp-sheet-wrap" role="dialog" aria-modal="true" aria-labelledby="pp-sheet-source-title">
          <div className="pp-sheet-backdrop" onClick={() => setSelectedSource(null)} aria-hidden="true" />
          <div className="pp-sheet">
            <div className="pp-sheet-grab" aria-hidden="true" />
            <div className="pp-sheet-head">
              <h3 id="pp-sheet-source-title" className="pp-sheet-title">Point Transaction</h3>
              <button
                type="button"
                className="pp-sheet-close"
                onClick={() => setSelectedSource(null)}
                aria-label="Close transaction details"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="pp-sheet-body">
              <div className="pp-sheet-hero">
                <span className="pp-sheet-hero-kicker">
                  {selectedSource.depth === 1 ? "Referred Partner Pass-Up" : "Direct Shop Commission"}
                </span>
                <h2 className="pp-sheet-hero-val">+{selectedSource.points} E-Points</h2>
                <span className={selectedSource.depth === 1 ? "pp-tag pp-tag-blue" : "pp-tag pp-tag-bone"}>
                  {selectedSource.depth === 1 ? "Downline Pass-Up" : "Direct Customer Order"}
                </span>
              </div>

              <div className="pp-sheet-dl">
                <div className="pp-sheet-row">
                  <span className="pp-sheet-dt">Source</span>
                  <strong className="pp-sheet-dd">
                    {selectedSource.depth === 1
                      ? (selectedSource.source_partner || "Referred Partner")
                      : "Direct Shop Customer"}
                  </strong>
                </div>

                <div className="pp-sheet-row">
                  <span className="pp-sheet-dt">Order Reference</span>
                  <div className="pp-sheet-dd-with-action">
                    <span className="pp-sheet-code">{selectedSource.order_code}</span>
                    <button
                      type="button"
                      className="pp-sheet-copy-btn"
                      onClick={() => copy(selectedSource.order_code)}
                      aria-label="Copy order code"
                    >
                      {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                      <span>{copied ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                </div>

                <div className="pp-sheet-row">
                  <span className="pp-sheet-dt">Transaction Date</span>
                  <strong className="pp-sheet-dd">{formatDate(selectedSource.created_at)}</strong>
                </div>

                <div className="pp-sheet-row">
                  <span className="pp-sheet-dt">Rebate Track</span>
                  <strong className="pp-sheet-dd">
                    {selectedSource.depth === 1
                      ? "Track B · Referred Partners Track"
                      : "Track A · My Shop Sales Track"}
                  </strong>
                </div>

                <div className="pp-sheet-row">
                  <span className="pp-sheet-dt">Activity Detail</span>
                  <p className="pp-sheet-note">
                    {selectedSource.depth === 1
                      ? `Points passed up from qualifying order placed through referred doctor ${selectedSource.source_partner || "partner"}. Contributes to your group target.`
                      : "Commission points earned directly from a customer purchase through your GutGuard shop link."}
                  </p>
                </div>
              </div>
            </div>

            <div className="pp-sheet-footer">
              <button
                type="button"
                className="shop-secondary pp-sheet-btn-secondary pp-sheet-action-btn"
                onClick={() => setSelectedSource(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedRebate ? (
        <div className="pp-sheet-wrap" role="dialog" aria-modal="true" aria-labelledby="pp-sheet-rebate-title">
          <div className="pp-sheet-backdrop" onClick={() => setSelectedRebate(null)} aria-hidden="true" />
          <div className="pp-sheet">
            <div className="pp-sheet-grab" aria-hidden="true" />
            <div className="pp-sheet-head">
              <h3 id="pp-sheet-rebate-title" className="pp-sheet-title">Milestone Details</h3>
              <button
                type="button"
                className="pp-sheet-close"
                onClick={() => setSelectedRebate(null)}
                aria-label="Close milestone details"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="pp-sheet-body">
              <div className="pp-sheet-hero">
                <span className="pp-sheet-hero-kicker">Cycle {selectedRebate.cycle_number} Unlocked Milestone</span>
                <h2 className="pp-sheet-hero-val is-gold">{peso(selectedRebate.rebate_amount)}</h2>
                <span className={selectedRebate.status === "paid" ? "pp-tag pp-tag-success" : "pp-tag pp-tag-warning"}>
                  {selectedRebate.status === "paid" ? "Paid Out" : "Awaiting Payout"}
                </span>
              </div>

              <div className="pp-sheet-dl">
                <div className="pp-sheet-row">
                  <span className="pp-sheet-dt">Milestone Target</span>
                  <strong className="pp-sheet-dd">{selectedRebate.milestone_pts} Points Reached</strong>
                </div>

                <div className="pp-sheet-row">
                  <span className="pp-sheet-dt">Cycle Stage</span>
                  <strong className="pp-sheet-dd">Cycle {selectedRebate.cycle_number} ({CYCLE_TARGET} pts target)</strong>
                </div>

                <div className="pp-sheet-row">
                  <span className="pp-sheet-dt">Date Unlocked</span>
                  <strong className="pp-sheet-dd">{formatDate(selectedRebate.created_at)}</strong>
                </div>

                <div className="pp-sheet-row">
                  <span className="pp-sheet-dt">Disbursement Status</span>
                  <strong className="pp-sheet-dd">
                    {selectedRebate.status === "paid"
                      ? "Paid Out — Transferred to bank account"
                      : "Awaiting Payout — Pending admin disbursement batch"}
                  </strong>
                </div>

                <div className="pp-sheet-row">
                  <span className="pp-sheet-dt">Information</span>
                  <p className="pp-sheet-note">
                    Cash rebates are audited and disbursed directly to your registered bank account by administration upon cycle validation.
                  </p>
                </div>
              </div>
            </div>

            <div className="pp-sheet-footer">
              <button
                type="button"
                className="shop-secondary pp-sheet-btn-secondary pp-sheet-action-btn"
                onClick={() => setSelectedRebate(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
