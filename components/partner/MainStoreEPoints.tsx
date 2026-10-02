"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, X } from "lucide-react";
import {
  CYCLE_TARGET,
  EmptyState,
  PageHeader,
  Pagination,
  StatTile,
  formatDate,
  peso,
  usePartner,
} from "./shared";

const MILESTONES = [
  { pts: 300, rebate: 18000, label: "Milestone 1" },
  { pts: 750, rebate: 70000, label: "Milestone 2" },
  { pts: 1500, rebate: 150000, label: "Milestone 3 (Full cycle)" },
];

export default function MainStoreEPointsPage() {
  const { dashboard } = usePartner();
  const { points, rebates = [], point_sources: sources = [] } = dashboard;

  const [tab, setTab] = useState<"rebates" | "log">("rebates");
  const [pointsFilter, setPointsFilter] = useState<"all" | "direct" | "referred">("all");
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(10);
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

  const combinedPoints = points.own_points + points.passup_points;
  const cycleNumber = Math.floor(combinedPoints / CYCLE_TARGET) + 1;
  const pointsInCycle = combinedPoints % CYCLE_TARGET;
  const cyclePct = Math.min(100, Math.round((pointsInCycle / CYCLE_TARGET) * 100));

  const nextMilestone = MILESTONES.find((m) => pointsInCycle < m.pts) || null;
  const pointsToNext = nextMilestone ? nextMilestone.pts - pointsInCycle : 0;

  const directSources = sources.filter((s) => s.depth === 0);
  const referredSources = sources.filter((s) => s.depth === 1);
  const activeSources =
    pointsFilter === "direct"
      ? directSources
      : pointsFilter === "referred"
      ? referredSources
      : sources;
  const visibleSources = activeSources.slice(offset, offset + pageSize);
  const visibleRebates = rebates.slice(rebateOffset, rebateOffset + rebatePageSize);

  return (
    <>
      <PageHeader
        kicker="E-Points & rebates"
        title="Points & Cash Rebates"
      />

      {/* Top Overview Stats Bar */}
      <section className="pp-stats" aria-label="E-Points summary">
        <StatTile
          label="Direct shop points"
          value={`${points.own_points} pts`}
          note="Direct Shop QR retail sales"
        />
        <StatTile
          label="Pass-up points"
          value={`${points.passup_points} pts`}
          note="Referred partner stores"
        />
        <StatTile
          label="Cycle balance"
          value={`${pointsInCycle} pts`}
          note={`Target: ${CYCLE_TARGET} pts`}
        />
        <StatTile
          label="Lifetime pooled"
          value={`${combinedPoints} pts`}
          note="All-time earned points"
        />
      </section>

      {/* Main Tab Switcher */}
      <div className="pp-seg" role="tablist" aria-label="E-Points view">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "rebates"}
          className={tab === "rebates" ? "active" : ""}
          onClick={() => setTab("rebates")}
        >
          Rebates
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "log"}
          className={tab === "log" ? "active" : ""}
          onClick={() => {
            setTab("log");
            setOffset(0);
          }}
        >
          Points Log
        </button>
      </div>

      {/* TAB 1: REBATES */}
      {tab === "rebates" && (
        <>
          <section className="pp-card" aria-label="Combined Rebate Track">
            <div className="pp-card-head">
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--ink)" }}>
                  Combined rebate track · Cycle {cycleNumber}
                </h2>
                <p className="pp-muted" style={{ margin: "2px 0 0" }}>
                  Own direct sales and referral pass-up points pooled together
                </p>
              </div>
              <span className="pp-tag pp-tag-blue">
                Pooled track
              </span>
            </div>

            <div className="pp-progress-labels">
              <strong>
                {pointsInCycle} / {CYCLE_TARGET} points
              </strong>
              <span>{cyclePct}%</span>
            </div>
            <div
              className="pp-progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={CYCLE_TARGET}
              aria-valuenow={Math.min(pointsInCycle, CYCLE_TARGET)}
              aria-label="Combined rebate cycle progress"
            >
              <div style={{ width: `${cyclePct}%`, background: "var(--gold)" }} />
            </div>

            <div className="pp-milestones">
              {MILESTONES.map((m) => {
                const unlocked = pointsInCycle >= m.pts;
                return (
                  <article
                    key={`combined-${m.pts}`}
                    className={unlocked ? "pp-milestone unlocked" : "pp-milestone"}
                  >
                    <span>{unlocked ? "Unlocked" : `${m.pts} pts`}</span>
                    <strong>{peso(m.rebate)}</strong>
                    <small>{m.label}</small>
                  </article>
                );
              })}
            </div>

            {nextMilestone ? (
              <p
                className="pp-muted"
                style={{
                  margin: 0,
                  paddingTop: 12,
                  borderTop: "1px solid var(--rule-soft)",
                }}
              >
                Earn <strong>{pointsToNext} more {pointsToNext === 1 ? "point" : "points"}</strong> to unlock {nextMilestone.label} ({peso(nextMilestone.rebate)} cash rebate).
              </p>
            ) : (
              <p
                style={{
                  margin: 0,
                  paddingTop: 12,
                  borderTop: "1px solid var(--rule-soft)",
                  fontSize: 13,
                  color: "var(--green, #107e3e)",
                  fontWeight: 600,
                }}
              >
                All milestones in Cycle {cycleNumber} unlocked! Additional points roll into the next cycle.
              </p>
            )}
          </section>

          {/* Rebate History List */}
          <h2 className="pp-h2">
            {rebates.length
              ? `${rebates.length} unlocked ${rebates.length === 1 ? "milestone" : "milestones"}`
              : "Rebate history"}
          </h2>
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
                      aria-label={`View details for ${peso(rebate.rebate_amount)} rebate`}
                    >
                      <div className="pp-log-lead">
                        <div className="pp-log-title-row">
                          <strong className="pp-log-title">{peso(rebate.rebate_amount)}</strong>
                          <span
                            className={
                              rebate.status === "paid"
                                ? "pp-tag pp-tag-green"
                                : rebate.status === "processing"
                                ? "pp-tag pp-tag-blue"
                                : "pp-tag pp-tag-bone"
                            }
                          >
                            {rebate.status === "paid"
                              ? "Paid"
                              : rebate.status === "processing"
                              ? "Processing"
                              : "Queued"}
                          </span>
                        </div>
                        <span className="pp-log-date">{formatDate(rebate.created_at)}</span>
                      </div>
                      <div className="pp-log-trail">
                        <span className="pp-log-pts">{rebate.milestone_pts} pts milestone</span>
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
                  noun="rebates"
                  onOffset={setRebateOffset}
                  onPageSize={(next) => {
                    setRebatePageSize(next);
                    setRebateOffset(0);
                  }}
                />
              </>
            ) : (
              <EmptyState title="No rebate payouts yet.">
                As your combined points reach 300, 750, and 1,500 points, your cash rebate payouts will appear here.
              </EmptyState>
            )}
          </section>
        </>
      )}

      {/* TAB 2: POINTS LOG */}
      {tab === "log" && (
        <>
          <div
            className="pp-seg"
            role="tablist"
            aria-label="Filter points origin"
          >
            <button
              type="button"
              role="tab"
              aria-selected={pointsFilter === "all"}
              className={pointsFilter === "all" ? "active" : ""}
              onClick={() => {
                setPointsFilter("all");
                setOffset(0);
              }}
            >
              All activity
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={pointsFilter === "direct"}
              className={pointsFilter === "direct" ? "active" : ""}
              onClick={() => {
                setPointsFilter("direct");
                setOffset(0);
              }}
            >
              Direct shop
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={pointsFilter === "referred"}
              className={pointsFilter === "referred" ? "active" : ""}
              onClick={() => {
                setPointsFilter("referred");
                setOffset(0);
              }}
            >
              Downline pass-ups
            </button>
          </div>

          <section className="pp-card pp-card-flush" aria-label="Points log">
            {activeSources.length ? (
              <>
                <ul className="pp-log">
                  {visibleSources.map((source, index) => {
                    const isPassup = source.depth === 1;
                    const title = isPassup
                      ? source.source_partner || "Referred partner"
                      : `Order ${source.order_code}`;
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
                              {isPassup ? "Pass-up" : "Direct sale"}
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
                  onPageSize={(next) => {
                    setPageSize(next);
                    setOffset(0);
                  }}
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

      {/* Point Transaction Detail Modal */}
      {selectedSource ? (
        <div className="pp-sheet-wrap" role="dialog" aria-modal="true" aria-labelledby="pp-sheet-source-title">
          <div className="pp-sheet-backdrop" onClick={() => setSelectedSource(null)} aria-hidden="true" />
          <div className="pp-sheet">
            <div className="pp-sheet-grab" aria-hidden="true" />
            <div className="pp-sheet-head">
              <h3 id="pp-sheet-source-title" className="pp-sheet-title">Point transaction</h3>
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
                  {selectedSource.depth === 1 ? "Referred partner pass-up" : "Direct shop order"}
                </span>
                <strong className="pp-detail-big-val">
                  +{selectedSource.points} {selectedSource.points === 1 ? "Point" : "Points"}
                </strong>
                <span className="pp-log-date">{formatDate(selectedSource.created_at)}</span>
              </div>

              <dl className="pp-detail-grid">
                <div>
                  <dt>Order code</dt>
                  <dd>
                    <code>{selectedSource.order_code}</code>
                  </dd>
                </div>
                <div>
                  <dt>Attribution</dt>
                  <dd>
                    {selectedSource.depth === 1 ? "Referred partner" : "Direct shop"}
                  </dd>
                </div>
                {selectedSource.source_partner ? (
                  <div>
                    <dt>Referring doctor</dt>
                    <dd>{selectedSource.source_partner}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
            <div className="pp-modal-footer">
              <Link href="/partner/reports" className="shop-secondary" onClick={() => setSelectedSource(null)}>
                <span>View in reports & stores →</span>
              </Link>
              <button type="button" className="shop-primary" onClick={() => setSelectedSource(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Rebate Milestone Detail Modal */}
      {selectedRebate ? (
        <div className="pp-sheet-wrap" role="dialog" aria-modal="true" aria-labelledby="pp-sheet-rebate-title">
          <div className="pp-sheet-backdrop" onClick={() => setSelectedRebate(null)} aria-hidden="true" />
          <div className="pp-sheet">
            <div className="pp-sheet-grab" aria-hidden="true" />
            <div className="pp-sheet-head">
              <h3 id="pp-sheet-rebate-title" className="pp-sheet-title">Rebate payout</h3>
              <button
                type="button"
                className="pp-sheet-close"
                onClick={() => setSelectedRebate(null)}
                aria-label="Close rebate details"
              >
                <X size={18} />
              </button>
            </div>
            <div className="pp-sheet-body">
              <div className="pp-detail-hero">
                <span className="pp-detail-kicker">Cycle {selectedRebate.cycle_number} milestone</span>
                <strong className="pp-detail-big-val">{peso(selectedRebate.rebate_amount)}</strong>
                <span className="pp-log-date">Unlocked {formatDate(selectedRebate.created_at)}</span>
              </div>

              <dl className="pp-detail-grid">
                <div>
                  <dt>Milestone requirement</dt>
                  <dd>{selectedRebate.milestone_pts} E-Points</dd>
                </div>
                <div>
                  <dt>Payout status</dt>
                  <dd>
                    <span
                      className={
                        selectedRebate.status === "paid"
                          ? "pp-tag pp-tag-green"
                          : selectedRebate.status === "processing"
                          ? "pp-tag pp-tag-blue"
                          : "pp-tag pp-tag-bone"
                      }
                    >
                      {selectedRebate.status === "paid"
                        ? "Paid"
                        : selectedRebate.status === "processing"
                        ? "Processing"
                        : "Queued"}
                    </span>
                  </dd>
                </div>
              </dl>
            </div>
            <div className="pp-modal-footer">
              <button type="button" className="shop-primary pp-block-btn" onClick={() => setSelectedRebate(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
