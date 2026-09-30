"use client";

import { useState } from "react";
import { CYCLE_TARGET, EmptyState, PageHeader, StatTile, formatDate, peso, usePartner } from "./shared";

const MILESTONES = [
  { pts: 300, rebate: 18000, label: "Initial group movement" },
  { pts: 750, rebate: 70000, label: "Mid-level group movement" },
  { pts: 1500, rebate: 150000, label: "Full group target" },
];

export default function EPointsPage() {
  const { dashboard } = usePartner();
  const { points, rebates, point_sources: sources = [] } = dashboard;
  const [tab, setTab] = useState<"points" | "rebates">("points");
  const [pointsFilter, setPointsFilter] = useState<"all" | "direct" | "referred">("all");
  const cyclePct = Math.min(100, (points.points_in_cycle / CYCLE_TARGET) * 100);

  const directSources = sources.filter((s) => s.depth === 0);
  const referredSources = sources.filter((s) => s.depth === 1);
  const activeSources = pointsFilter === "direct" ? directSources : pointsFilter === "referred" ? referredSources : sources;

  return (
    <>
      <PageHeader kicker="E-Points" title={`${points.lifetime_points} pts earned`} lede="Points from your direct orders and from partners you referred count towards cash rebate milestones." />

      <section className="pp-stats" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }} aria-label="E-Points summary">
        <StatTile label="Pass-up points (Earned)" value={`${points.passup_points} pts`} note="earned from referred downline partners" />
        <StatTile label="Passed up to upline" value={`${points.passed_up_to_upline_points} pts`} note="passed up to your sponsor/upline" />
        <StatTile label="Direct points (Kept)" value={`${points.own_points} pts`} note="kept from direct customer orders" />
        <StatTile label={`Cycle ${points.current_cycle}`} value={`${points.points_in_cycle} pts`} note={`target ${CYCLE_TARGET}`} />
      </section>

      <div className="pp-seg" role="tablist" aria-label="E-Points view">
        <button type="button" role="tab" aria-selected={tab === "points"} className={tab === "points" ? "active" : ""} onClick={() => setTab("points")}>Points log <span>{sources.length}</span></button>
        <button type="button" role="tab" aria-selected={tab === "rebates"} className={tab === "rebates" ? "active" : ""} onClick={() => setTab("rebates")}>Rebates <span>{rebates.length}</span></button>
      </div>

      {tab === "points" ? (
        <>
          <div className="pp-seg" style={{ marginTop: 0, marginBottom: 16 }} role="tablist" aria-label="Filter points origin">
            <button type="button" role="tab" aria-selected={pointsFilter === "all"} className={pointsFilter === "all" ? "active" : ""} onClick={() => setPointsFilter("all")}>All points <span>{sources.length}</span></button>
            <button type="button" role="tab" aria-selected={pointsFilter === "direct"} className={pointsFilter === "direct" ? "active" : ""} onClick={() => setPointsFilter("direct")}>My shop points <span>{points.own_points} pts</span></button>
            <button type="button" role="tab" aria-selected={pointsFilter === "referred"} className={pointsFilter === "referred" ? "active" : ""} onClick={() => setPointsFilter("referred")}>Referred partners points <span>{points.passup_points} pts</span></button>
          </div>

          {pointsFilter === "referred" && referredSources.length ? (
            <section className="pp-card" style={{ marginBottom: 16 }} aria-label="Pass-up points breakdown by partner">
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--blue)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>Pass-Up Points by Partner</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
                {Array.from(
                  referredSources.reduce((map, item) => {
                    const name = item.source_partner || "Unknown Partner";
                    map.set(name, (map.get(name) || 0) + item.points);
                    return map;
                  }, new Map<string, number>())
                ).map(([partnerName, pts]) => (
                  <div key={partnerName} style={{ background: "var(--paper)", padding: "12px 14px", borderRadius: "var(--r-md)", border: "1px solid var(--rule)" }}>
                    <small style={{ color: "var(--ink-3)", fontSize: 12, display: "block" }}>{partnerName}</small>
                    <strong style={{ color: "var(--blue)", fontSize: 16 }}>+{pts} pts</strong>
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
      ) : (
        <>
          <section className="pp-card" aria-label="Cycle progress" style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>My Shop Points Accumulation</h3>
            <div className="pp-progress-labels">
              <strong>{points.own_points} Direct E-Points Earned</strong>
              <span>Personal Sales</span>
            </div>
            <p className="pp-muted" style={{ marginTop: 8 }}>
              Accumulated directly from customers purchasing through your shop link.
            </p>
          </section>

          <section className="pp-card" aria-label="Referred partners cycle progress">
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--blue)", marginBottom: 12 }}>Referred Partners Points Accumulation</h3>
            <div className="pp-progress-labels">
              <strong>{points.passup_points % CYCLE_TARGET} E-Points · Cycle {points.current_cycle}</strong>
              <span>Target {CYCLE_TARGET}</span>
            </div>
            <div className="pp-progress" role="progressbar" aria-valuemin={0} aria-valuemax={CYCLE_TARGET} aria-valuenow={Math.min(points.passup_points % CYCLE_TARGET, CYCLE_TARGET)} aria-label="Pass-up cycle progress">
              <div style={{ width: `${Math.min(100, ((points.passup_points % CYCLE_TARGET) / CYCLE_TARGET) * 100)}%` }} />
            </div>
            <p className="pp-muted">
              {(points.passup_points % CYCLE_TARGET) < CYCLE_TARGET
                ? `Earn ${CYCLE_TARGET - (points.passup_points % CYCLE_TARGET)} more pass-up points to complete Cycle ${points.current_cycle}.`
                : `Cycle ${points.current_cycle} completed.`}
            </p>
          </section>

          <h2 className="pp-h2">Group target milestones</h2>
          <div className="pp-milestones">
            {MILESTONES.map((milestone) => {
              const unlocked = points.points_in_cycle >= milestone.pts;
              return (
                <article key={milestone.pts} className={unlocked ? "pp-milestone unlocked" : "pp-milestone"}>
                  <span>{unlocked ? "✓ Unlocked" : `${points.points_in_cycle} / ${milestone.pts} pts`}</span>
                  <strong>{peso(milestone.rebate)}</strong>
                  <small>{milestone.label}</small>
                </article>
              );
            })}
          </div>

          <h2 className="pp-h2">{rebates.length ? `${rebates.length} unlocked ${rebates.length === 1 ? "milestone" : "milestones"}` : "Rebate history"}</h2>
          <section className="pp-card pp-card-flush" aria-label="Rebate history">
            {rebates.length ? (
              <ul className="pp-log">
                {rebates.map((rebate, index) => (
                  <li key={index}>
                    <span>
                      <strong>Cycle {rebate.cycle_number} milestone</strong>
                      <small>{rebate.milestone_pts} points reached</small>
                    </span>
                    <span className="pp-log-end">
                      <b className="is-gold">{peso(rebate.rebate_amount)}</b>
                      <small>{formatDate(rebate.created_at)}</small>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No milestones unlocked yet.">Earn points from your direct referrals and their orders to unlock cash rebates.</EmptyState>
            )}
          </section>
        </>
      )}
    </>
  );
}
