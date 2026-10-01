"use client";

import { useState } from "react";
import { CYCLE_TARGET, EmptyState, PageHeader, StatTile, formatDate, peso, usePartner } from "./shared";

const MILESTONES = [
  { pts: 300, rebate: 18000, label: "Initial movement milestone" },
  { pts: 750, rebate: 70000, label: "Mid-level movement milestone" },
  { pts: 1500, rebate: 150000, label: "Full cycle target milestone" },
];

export default function EPointsPage() {
  const { dashboard } = usePartner();
  const { points, rebates, point_sources: sources = [] } = dashboard;
  const [tab, setTab] = useState<"points" | "rebates">("rebates");
  const [pointsFilter, setPointsFilter] = useState<"direct" | "referred" | "all">("direct");
  const [rebateOffset, setRebateOffset] = useState(0);
  const [rebatePageSize, setRebatePageSize] = useState(10);

  const directSources = sources.filter((s) => s.depth === 0);
  const referredSources = sources.filter((s) => s.depth === 1);
  const activeSources = pointsFilter === "direct" ? directSources : pointsFilter === "referred" ? referredSources : sources;
  const visibleRebates = rebates.slice(rebateOffset, rebateOffset + rebatePageSize);

  return (
    <>
      <PageHeader
        kicker="E-Points & Rebates"
        title="Point Balances & Cash Rebates"
        lede="Track your personal shop sales points and group pass-up points separately. Unlock cash rebates as milestones are achieved."
      />

      {/* 📊 3. Top Overview Stats Bar */}
      <section className="pp-stats" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }} aria-label="E-Points summary">
        <StatTile label="🛒 Direct Shop Points" value={`${points.own_points} pts`} note="kept from direct customer orders" />
        <StatTile label="👥 Referred Pass-Up Points" value={`${points.passup_points} pts`} note="earned from referred downline partners" />
        <StatTile label="Passed Up to Upline" value={`${points.passed_up_to_upline_points} pts`} note="passed up to your sponsor/upline" />
        <StatTile label={`Cycle ${points.current_cycle} Balance`} value={`${points.points_in_cycle} pts`} note={`Target: ${CYCLE_TARGET} pts`} />
      </section>

      <div className="pp-seg" role="tablist" aria-label="E-Points view">
        <button type="button" role="tab" aria-selected={tab === "rebates"} className={tab === "rebates" ? "active" : ""} onClick={() => setTab("rebates")}>
          Rebate History & Tracks <span>{rebates.length}</span>
        </button>
        <button type="button" role="tab" aria-selected={tab === "points"} className={tab === "points" ? "active" : ""} onClick={() => setTab("points")}>
          Points Log <span>{sources.length}</span>
        </button>
      </div>

      {tab === "rebates" ? (
        <>
          {/* 🎨 1. Track A: My Shop Sales Rebate Track */}
          <section className="pp-card" aria-label="Track A My Shop Sales Rebate Track" style={{ marginBottom: 24, border: "1px solid var(--rule)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: 0 }}>🛒 Track A: My Shop Sales Rebate Track</h3>
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

          {/* 🎨 1. Track B: Referred Partners Rebate Track */}
          <section className="pp-card" aria-label="Track B Referred Partners Rebate Track" style={{ marginBottom: 24, border: "1px solid var(--blue-soft, #eef2ff)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--blue)", margin: 0 }}>👥 Track B: Referred Partners Rebate Track</h3>
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
                    <li key={index}>
                      <span>
                        <strong>Cycle {rebate.cycle_number} milestone</strong>
                        <small>{rebate.milestone_pts} points reached</small>
                      </span>
                      <span className="pp-log-end" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: rebate.status === "paid" ? "#15803d" : "#b45309", background: rebate.status === "paid" ? "#dcfce7" : "#fef3c7", padding: "2px 6px", borderRadius: 10 }}>
                            {rebate.status === "paid" ? "Paid out" : "Unlocked · Awaiting Payout"}
                          </span>
                          <b className="is-gold">{peso(rebate.rebate_amount)}</b>
                        </div>
                        <small>{formatDate(rebate.created_at)}</small>
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="partner-pagination" aria-label="Rebate history pages">
                  <label className="partner-pagination-size">Rows<select value={rebatePageSize} onChange={(event) => { setRebatePageSize(Number(event.target.value)); setRebateOffset(0); }}><option value="10">10</option><option value="25">25</option><option value="50">50</option></select></label>
                  <button type="button" className="shop-secondary" disabled={rebateOffset === 0} onClick={() => setRebateOffset(Math.max(0, rebateOffset - rebatePageSize))}>Previous</button>
                  <span>{rebates.length ? `${rebateOffset + 1}–${Math.min(rebateOffset + visibleRebates.length, rebates.length)} of ${rebates.length}` : "0 milestones"}</span>
                  <button type="button" className="shop-secondary" disabled={rebateOffset + visibleRebates.length >= rebates.length} onClick={() => setRebateOffset(rebateOffset + rebatePageSize)}>Next</button>
                </div>
              </>
            ) : (
              <EmptyState title="No milestones unlocked yet.">Earn points from your direct referrals and their orders to unlock cash rebates.</EmptyState>
            )}
          </section>
        </>
      ) : (
        <>
          {/* ⚡ 2. Points Log Tab (Sub-Tab 1: My Shop Points / Sub-Tab 2: Referred Partners Points) */}
          <div className="pp-seg" style={{ marginTop: 0, marginBottom: 16 }} role="tablist" aria-label="Filter points origin">
            <button type="button" role="tab" aria-selected={pointsFilter === "direct"} className={pointsFilter === "direct" ? "active" : ""} onClick={() => setPointsFilter("direct")}>
              🛒 Sub-Tab 1: My Shop Points <span style={{ marginLeft: 6, padding: "2px 8px", background: "var(--bone-soft)", borderRadius: 12, fontSize: 11, fontWeight: 700 }}>{points.own_points} Direct Pts</span>
            </button>
            <button type="button" role="tab" aria-selected={pointsFilter === "referred"} className={pointsFilter === "referred" ? "active" : ""} onClick={() => setPointsFilter("referred")}>
              👥 Sub-Tab 2: Referred Partners Points <span style={{ marginLeft: 6, padding: "2px 8px", background: "var(--blue-soft, #eef2ff)", color: "var(--blue)", borderRadius: 12, fontSize: 11, fontWeight: 700 }}>{points.passup_points} Referred Pts</span>
            </button>
            <button type="button" role="tab" aria-selected={pointsFilter === "all"} className={pointsFilter === "all" ? "active" : ""} onClick={() => setPointsFilter("all")}>
              All Activity <span>{sources.length}</span>
            </button>
          </div>

          {/* Leaderboard Grid when Referred Partners Points selected */}
          {pointsFilter === "referred" && referredSources.length ? (
            <section className="pp-card" style={{ marginBottom: 16 }} aria-label="Downline leaderboard">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--blue)", margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Downline Leaderboard Grid
                </h3>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--blue)" }}>
                  {points.passup_points} Referred Pts Total
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                {Array.from(
                  referredSources.reduce((map, item) => {
                    const name = item.source_partner || "Unknown Partner";
                    map.set(name, (map.get(name) || 0) + item.points);
                    return map;
                  }, new Map<string, number>())
                ).map(([partnerName, pts]) => (
                  <div key={partnerName} style={{ background: "var(--paper)", padding: "14px 16px", borderRadius: "var(--r-md)", border: "1px solid var(--rule-soft)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <small style={{ color: "var(--ink-3)", fontSize: 12, display: "block" }}>Partner</small>
                      <strong style={{ color: "var(--ink)", fontSize: 14, display: "block", marginTop: 2 }}>{partnerName}</strong>
                    </div>
                    <strong style={{ color: "var(--blue)", fontSize: 15, background: "var(--blue-soft, #eef2ff)", padding: "4px 8px", borderRadius: 6 }}>+{pts} pts</strong>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="pp-card pp-card-flush" aria-label="Points log">
            {activeSources.length ? (
              <ul className="pp-log">
                {activeSources.map((source, index) => {
                  const isPassup = source.depth === 1;
                  return (
                    <li key={`${source.order_code}-${index}`} style={{ padding: "14px 16px" }}>
                      <span>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                          <span style={{
                            fontSize: 10,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: isPassup ? "var(--blue-soft, #eef2ff)" : "var(--bone-soft, #f4f4f5)",
                            color: isPassup ? "var(--blue, #2563eb)" : "var(--ink-2, #52525b)"
                          }}>
                            {isPassup ? "👥 Pass-Up" : "🛒 Direct Order"}
                          </span>
                          <strong style={{ fontSize: 14 }}>
                            {isPassup ? `Pass-up from ${source.source_partner}` : `Direct Order ${source.order_code}`}
                          </strong>
                        </div>
                        <small style={{ color: "var(--ink-3)", fontSize: 12 }}>
                          {isPassup ? `Earned from downline order ${source.order_code}` : `Direct shop purchase via your link`} · {formatDate(source.created_at)}
                        </small>
                      </span>
                      <b className={isPassup ? "is-passup" : undefined} style={{ fontSize: 16 }}>
                        +{source.points} {source.points === 1 ? "pt" : "pts"}
                      </b>
                    </li>
                  );
                })}
              </ul>
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
    </>
  );
}
