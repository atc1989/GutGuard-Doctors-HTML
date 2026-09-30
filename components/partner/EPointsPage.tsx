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
  const cyclePct = Math.min(100, (points.points_in_cycle / CYCLE_TARGET) * 100);

  return (
    <>
      <PageHeader kicker="E-Points" title={`${points.lifetime_points} pts earned`} lede="Points from your direct orders and from partners you referred count towards cash rebate milestones." />

      <section className="pp-stats pp-stats-3" aria-label="E-Points summary">
        <StatTile label="Direct points" value={`${points.own_points} pts`} note="from your direct customer orders" />
        <StatTile label="Pass-up points" value={`${points.passup_points} pts`} note="passed up from referred partners" />
        <StatTile label={`Cycle ${points.current_cycle}`} value={`${points.points_in_cycle} pts`} note={`target ${CYCLE_TARGET}`} />
      </section>

      <div className="pp-seg" role="tablist" aria-label="E-Points view">
        <button type="button" role="tab" aria-selected={tab === "points"} className={tab === "points" ? "active" : ""} onClick={() => setTab("points")}>Points log <span>{sources.length}</span></button>
        <button type="button" role="tab" aria-selected={tab === "rebates"} className={tab === "rebates" ? "active" : ""} onClick={() => setTab("rebates")}>Rebates <span>{rebates.length}</span></button>
      </div>

      {tab === "points" ? (
        <section className="pp-card pp-card-flush" aria-label="Points log">
          {sources.length ? (
            <ul className="pp-log">
              {sources.map((source, index) => (
                <li key={`${source.order_code}-${index}`}>
                  <span>
                    <strong>{source.depth === 1 ? `Pass-up from ${source.source_partner}` : `Direct customer order ${source.order_code}`}</strong>
                    <small>Order {source.order_code} · {formatDate(source.created_at)}</small>
                  </span>
                  <b className={source.depth === 1 ? "is-passup" : undefined}>+{source.points} {source.points === 1 ? "pt" : "pts"}</b>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No points recorded yet.">Points from direct orders and referred partners will appear here.</EmptyState>
          )}
        </section>
      ) : (
        <>
          <section className="pp-card" aria-label="Cycle progress">
            <div className="pp-progress-labels">
              <strong>{points.points_in_cycle} E-Points · Cycle {points.current_cycle}</strong>
              <span>Target {CYCLE_TARGET}</span>
            </div>
            <div className="pp-progress" role="progressbar" aria-valuemin={0} aria-valuemax={CYCLE_TARGET} aria-valuenow={Math.min(points.points_in_cycle, CYCLE_TARGET)} aria-label="Cycle progress">
              <div style={{ width: `${cyclePct}%` }} />
            </div>
            <p className="pp-muted">
              {points.points_in_cycle < CYCLE_TARGET
                ? `Earn ${CYCLE_TARGET - points.points_in_cycle} more points to complete Cycle ${points.current_cycle}.`
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
