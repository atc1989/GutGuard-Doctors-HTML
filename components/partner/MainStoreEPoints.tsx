"use client";

import { useState } from "react";
import { CYCLE_TARGET, EmptyState, PageHeader, StatTile, formatDate, peso, usePartner } from "./shared";

const MILESTONES = [
  { pts: 300, rebate: 18000, label: "Initial movement milestone" },
  { pts: 750, rebate: 70000, label: "Mid-level movement milestone" },
  { pts: 1500, rebate: 150000, label: "Full cycle target milestone" },
];

export default function MainStoreEPointsPage() {
  const { dashboard } = usePartner();
  const { points, rebates } = dashboard;
  const [tab, setTab] = useState<"rebates" | "breakdown">("rebates");

  const combinedPoints = points.own_points + points.passup_points;
  const cycleNumber = Math.floor(combinedPoints / CYCLE_TARGET) + 1;
  const pointsInCycle = combinedPoints % CYCLE_TARGET;
  const cyclePct = Math.min(100, Math.round((pointsInCycle / CYCLE_TARGET) * 100));

  return (
    <div className="pp-screen">
      <PageHeader
        kicker="🏢 Main Store Combined Rebates"
        title="Combined E-Points & Cash Rebates"
        lede="Your own direct Shop QR orders and pass-up points from directly referred partner stores are pooled into a single 1,500-point rebate cycle."
      />

      {/* Top Overview Stats Bar */}
      <section className="pp-stats" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }} aria-label="Main Store E-Points summary">
        <StatTile label="Own Shop Points" value={`${points.own_points} pts`} note="earned from direct Shop QR retail sales" />
        <StatTile label="Referred Pass-Up Points" value={`${points.passup_points} pts`} note="earned from direct child lifestyle stores" />
        <StatTile label="Combined Lifetime Points" value={`${combinedPoints} pts`} note="all-time pooled rebate points" />
        <StatTile label={`Cycle ${cycleNumber} Progress`} value={`${pointsInCycle} / ${CYCLE_TARGET} pts`} note={`${cyclePct}% towards cycle completion`} />
      </section>

      <div className="pp-seg" role="tablist" aria-label="Main Store Rebate view">
        <button type="button" role="tab" aria-selected={tab === "rebates"} className={tab === "rebates" ? "active" : ""} onClick={() => setTab("rebates")}>
          Combined Rebate Track
        </button>
        <button type="button" role="tab" aria-selected={tab === "breakdown"} className={tab === "breakdown" ? "active" : ""} onClick={() => setTab("breakdown")}>
          Point Source Breakdown
        </button>
      </div>

      {tab === "rebates" ? (
        <section className="pp-card" aria-label="Combined Rebate Track" style={{ marginBottom: 24, border: "1px solid var(--rule)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", margin: 0 }}>
                Main Store Single Combined Rebate Track
              </h3>
              <small style={{ color: "var(--ink-3)", fontSize: 13 }}>
                Own Sales + Direct Referral Pass-Ups
              </small>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#166534", background: "#dcfce7", padding: "4px 10px", borderRadius: 4 }}>
              Combined Track
            </span>
          </div>

          <div className="pp-progress-labels" style={{ marginTop: 16 }}>
            <strong>{pointsInCycle} / {CYCLE_TARGET} Combined E-Points (Cycle {cycleNumber})</strong>
            <span>{cyclePct}%</span>
          </div>
          <div className="pp-progress" role="progressbar" aria-valuemin={0} aria-valuemax={CYCLE_TARGET} aria-valuenow={Math.min(pointsInCycle, CYCLE_TARGET)} aria-label="Combined rebate cycle progress">
            <div style={{ width: `${cyclePct}%`, background: "var(--gold)" }} />
          </div>

          <div className="pp-milestones" style={{ marginTop: 24 }}>
            {MILESTONES.map((m) => {
              const unlocked = pointsInCycle >= m.pts;
              return (
                <article key={`combined-${m.pts}`} className={unlocked ? "pp-milestone unlocked" : "pp-milestone"}>
                  <span>{unlocked ? "✓ Unlocked!" : `🎯 ${m.pts} Combined Pts (${pointsInCycle} / ${m.pts} pts)`}</span>
                  <strong>{peso(m.rebate)}</strong>
                  <small style={{ color: "var(--ink-3)" }}>{m.label}</small>
                </article>
              );
            })}
          </div>

          <div style={{ marginTop: 24, padding: "16px", background: "var(--bone-soft, #f8fafc)", borderRadius: "8px", fontSize: "13px", color: "var(--ink-2)" }}>
            💡 <strong>How Main Store Rebates Work:</strong> When you sell products via your Shop QR, you earn 1 point per ₱1,000 spent. When stores directly referred by your registration link make sales, you earn pass-up points. Both flow directly into this combined 1,500-point rebate tracker!
          </div>
        </section>
      ) : (
        <section className="pp-card" aria-label="Point Source Breakdown">
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px" }}>Point Contributions</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
            <div style={{ padding: 16, borderRadius: 8, border: "1px solid var(--rule)" }}>
              <div style={{ color: "var(--ink-3)", fontSize: 13 }}>Direct Shop Sales (Depth 0)</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "var(--ink)", margin: "4px 0" }}>{points.own_points} pts</div>
              <small style={{ color: "var(--ink-3)" }}>Points generated directly from your Main Store retail link</small>
            </div>
            <div style={{ padding: 16, borderRadius: 8, border: "1px solid var(--rule)" }}>
              <div style={{ color: "var(--ink-3)", fontSize: 13 }}>Direct Referrals Pass-Up (Depth 1)</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "var(--ink)", margin: "4px 0" }}>{points.passup_points} pts</div>
              <small style={{ color: "var(--ink-3)" }}>Pass-up points generated by Lifestyle stores directly referred by you</small>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
