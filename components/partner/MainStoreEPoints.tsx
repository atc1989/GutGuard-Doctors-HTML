"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, Copy, Package, Users, X } from "lucide-react";
import {
  CYCLE_TARGET,
  EmptyState,
  PageHeader,
  Pagination,
  StatTile,
  formatDate,
  peso,
  useCopy,
  usePartner,
} from "./shared";

const MILESTONES = [
  { pts: 300, rebate: 18000, label: "Initial movement milestone" },
  { pts: 750, rebate: 70000, label: "Mid-level movement milestone" },
  { pts: 1500, rebate: 150000, label: "Full cycle target milestone" },
];

export default function MainStoreEPointsPage() {
  const { dashboard } = usePartner();
  const { points, rebates, point_sources: sources = [] } = dashboard;
  const { copied, copy } = useCopy();

  const [tab, setTab] = useState<"rebates" | "log" | "breakdown">("rebates");
  const [pointsFilter, setPointsFilter] = useState<"all" | "direct" | "referred">("all");
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [selectedSource, setSelectedSource] = useState<typeof sources[number] | null>(null);

  useEffect(() => {
    if (!selectedSource) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedSource(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selectedSource]);

  const combinedPoints = points.own_points + points.passup_points;
  const cycleNumber = Math.floor(combinedPoints / CYCLE_TARGET) + 1;
  const pointsInCycle = combinedPoints % CYCLE_TARGET;
  const cyclePct = Math.min(100, Math.round((pointsInCycle / CYCLE_TARGET) * 100));

  const directSources = sources.filter((s) => s.depth === 0);
  const referredSources = sources.filter((s) => s.depth === 1);
  const activeSources = pointsFilter === "direct" ? directSources : pointsFilter === "referred" ? referredSources : sources;
  const visibleSources = activeSources.slice(offset, offset + pageSize);

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

      {/* Main Tab Switcher */}
      <div className="pp-seg" role="tablist" aria-label="Main Store Rebate view" style={{ marginTop: 20, marginBottom: 16 }}>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "rebates"}
          className={tab === "rebates" ? "active" : ""}
          onClick={() => setTab("rebates")}
        >
          Combined Rebate Track
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "log"}
          className={tab === "log" ? "active" : ""}
          onClick={() => { setTab("log"); setOffset(0); }}
        >
          Points & Orders Log ({sources.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "breakdown"}
          className={tab === "breakdown" ? "active" : ""}
          onClick={() => setTab("breakdown")}
        >
          Point Source Breakdown
        </button>
      </div>

      {/* TAB 1: COMBINED REBATES */}
      {tab === "rebates" && (
        <section className="pp-card" aria-label="Combined Rebate Track" style={{ marginBottom: 24, border: "1px solid var(--rule)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", margin: 0 }}>
                Main Store Single Combined Rebate Track
              </h3>
              <small style={{ color: "var(--ink-3)", fontSize: 13 }}>
                Own Sales + Direct Referral Pass-Ups Pooled Together
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
            💡 <strong>How Main Store Rebates Work:</strong> When customers purchase through your Shop QR, you earn 1 point per ₱1,000 spent. When stores directly referred by your registration link make sales, you earn pass-up points. Both flow directly into this combined 1,500-point rebate tracker!
          </div>
        </section>
      )}

      {/* TAB 2: POINTS & ORDERS LOG */}
      {tab === "log" && (
        <>
          <div className="pp-seg" style={{ marginTop: 0, marginBottom: 16 }} role="tablist" aria-label="Filter points origin">
            <button
              type="button"
              role="tab"
              aria-selected={pointsFilter === "all"}
              className={pointsFilter === "all" ? "active" : ""}
              onClick={() => { setPointsFilter("all"); setOffset(0); }}
            >
              All Activity ({sources.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={pointsFilter === "direct"}
              className={pointsFilter === "direct" ? "active" : ""}
              onClick={() => { setPointsFilter("direct"); setOffset(0); }}
            >
              My Direct Shop ({directSources.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={pointsFilter === "referred"}
              className={pointsFilter === "referred" ? "active" : ""}
              onClick={() => { setPointsFilter("referred"); setOffset(0); }}
            >
              Downline Referrals ({referredSources.length})
            </button>
          </div>

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
                            <span className={isPassup ? "pp-tag pp-tag-blue" : "pp-tag pp-tag-bone"}>
                              {isPassup ? "Pass-Up" : "Direct Sale"}
                            </span>
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
                  offset={offset}
                  pageSize={pageSize}
                  total={activeSources.length}
                  shown={visibleSources.length}
                  noun="transactions"
                  onOffset={setOffset}
                  onPageSize={(next) => { setPageSize(next); setOffset(0); }}
                />
              </>
            ) : (
              <EmptyState title="No point transactions found.">
                Points earned from customer purchases via your Shop QR or downline pass-ups will appear here.
              </EmptyState>
            )}
          </section>
        </>
      )}

      {/* TAB 3: BREAKDOWN */}
      {tab === "breakdown" && (
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

      {/* Detail Bottom Sheet / Modal */}
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
                <X size={18} />
              </button>
            </div>
            <div className="pp-sheet-body">
              <div className="pp-detail-hero">
                <span className="pp-detail-kicker">
                  {selectedSource.depth === 1 ? "Referred Partner Pass-Up" : "Direct Shop Order"}
                </span>
                <strong className="pp-detail-big-val">
                  +{selectedSource.points} {selectedSource.points === 1 ? "Point" : "Points"}
                </strong>
                <span className="pp-log-date">{formatDate(selectedSource.created_at)}</span>
              </div>

              <dl className="pp-detail-grid">
                <div>
                  <dt>Order Code</dt>
                  <dd>
                    <code>{selectedSource.order_code}</code>
                  </dd>
                </div>
                <div>
                  <dt>Attribution Type</dt>
                  <dd>
                    {selectedSource.depth === 1 ? "Referred Partner (Depth 1)" : "My Direct Shop (Depth 0)"}
                  </dd>
                </div>
                {selectedSource.source_partner ? (
                  <div>
                    <dt>Referring Doctor</dt>
                    <dd>{selectedSource.source_partner}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
            <div className="pp-modal-footer">
              <Link href="/partner/reports" className="shop-secondary" onClick={() => setSelectedSource(null)}>
                <span>View in Reports & Stores →</span>
              </Link>
              <button type="button" className="shop-primary" onClick={() => setSelectedSource(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
