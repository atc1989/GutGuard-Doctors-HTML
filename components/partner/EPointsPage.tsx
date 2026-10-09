"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, Copy, Users, X } from "lucide-react";
import { CYCLE_TARGET, EmptyState, PageHeader, Pagination, StatTile, formatDate, peso, useCopy, usePartner } from "./shared";
import MainStoreEPointsPage from "./MainStoreEPoints";

const MILESTONES = [
  { pts: 300, rebate: 18000, label: "Initial movement milestone" },
  { pts: 750, rebate: 70000, label: "Mid-level movement milestone" },
  { pts: 1500, rebate: 150000, label: "Full cycle target milestone" },
];

// Each track runs its own 1,500-point cycle; milestones are measured inside the current cycle.
function trackCycle(trackPoints: number) {
  return { cycle: Math.floor(trackPoints / CYCLE_TARGET) + 1, inCycle: trackPoints % CYCLE_TARGET };
}

export default function EPointsPage() {
  const { dashboard } = usePartner();
  // Separate components so a store_type change between renders never changes the hook order.
  return dashboard.partner.store_type === "main" ? <MainStoreEPointsPage /> : <PartnerEPointsPage />;
}

function PartnerEPointsPage() {
  const { dashboard } = usePartner();
  const { points, rebates, point_sources: sources = [] } = dashboard;
  const direct = trackCycle(points.own_points);
  const referred = trackCycle(points.passup_points);
  const { copied, copy } = useCopy();
  const [tab, setTab] = useState<"rebates" | "points">("rebates");
  const [pointsFilter, setPointsFilter] = useState<"direct" | "referred" | "all">("direct");
  const [pointsOffset, setPointsOffset] = useState(0);
  const [pointsPageSize, setPointsPageSize] = useState(10);
  const [rebateOffset, setRebateOffset] = useState(0);
  const [rebatePageSize, setRebatePageSize] = useState(10);
  const [selectedSource, setSelectedSource] = useState<typeof sources[number] | null>(null);
  const [selectedRebate, setSelectedRebate] = useState<typeof rebates[number] | null>(null);

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
      />

      {/* Top Overview Stats Bar */}
      <section className="pp-stats" aria-label="E-Points summary">
        <StatTile label="Direct Shop Points" value={`${points.own_points} pts`} note="kept from direct customer orders" />
        <StatTile label="Referred Pass-Up Points" value={`${points.passup_points} pts`} note="earned from referred downline partners" />
        <StatTile label="Lifetime E-Points" value={`${points.lifetime_points} pts`} note="direct and pass-up points combined" />
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
              <strong>{direct.inCycle} / {CYCLE_TARGET} Direct E-Points (Cycle {direct.cycle})</strong>
              <span>{Math.round((direct.inCycle / CYCLE_TARGET) * 100)}%</span>
            </div>
            <div className="pp-progress" role="progressbar" aria-valuemin={0} aria-valuemax={CYCLE_TARGET} aria-valuenow={direct.inCycle} aria-label="Direct sales cycle progress">
              <div style={{ width: `${(direct.inCycle / CYCLE_TARGET) * 100}%`, background: "var(--gold)" }} />
            </div>

            <div className="pp-milestones" style={{ marginTop: 16 }}>
              {MILESTONES.map((m) => {
                const reached = direct.inCycle >= m.pts;
                return (
                  <article key={`direct-${m.pts}`} className={reached ? "pp-milestone unlocked" : "pp-milestone"}>
                    <span>{reached ? "✓ Milestone reached" : `🎯 ${m.pts} Direct Pts (${direct.inCycle} / ${m.pts} pts)`}</span>
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
              <strong>{referred.inCycle} / {CYCLE_TARGET} Referred E-Points (Cycle {referred.cycle})</strong>
              <span>{Math.round((referred.inCycle / CYCLE_TARGET) * 100)}%</span>
            </div>
            <div className="pp-progress" role="progressbar" aria-valuemin={0} aria-valuemax={CYCLE_TARGET} aria-valuenow={referred.inCycle} aria-label="Referred pass-up cycle progress">
              <div style={{ width: `${(referred.inCycle / CYCLE_TARGET) * 100}%`, background: "var(--blue)" }} />
            </div>

            <div className="pp-milestones" style={{ marginTop: 16 }}>
              {MILESTONES.map((m) => {
                const reached = referred.inCycle >= m.pts;
                return (
                  <article key={`referred-${m.pts}`} className={reached ? "pp-milestone unlocked" : "pp-milestone"}>
                    <span>{reached ? "✓ Milestone reached" : `🎯 ${m.pts} Referred Pts (${referred.inCycle} / ${m.pts} pts)`}</span>
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
                          <span className={rebate.status === "paid" ? "partner-badge paid" : "partner-badge pending"}>
                            {rebate.status === "paid" ? "paid" : "processing"}
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
          <div className="pp-seg" role="tablist" aria-label="Filter points origin">
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

      {/* Detail Drawer (GutGuard Design System Universal Drawer) */}
      {selectedSource ? (
        <PointTransactionDrawer
          source={selectedSource}
          copied={copied}
          onCopy={copy}
          onClose={() => setSelectedSource(null)}
        />
      ) : null}

      {selectedRebate ? (
        <RebateMilestoneDrawer
          rebate={selectedRebate}
          onClose={() => setSelectedRebate(null)}
        />
      ) : null}
    </>
  );
}

function PointTransactionDrawer({
  source,
  copied,
  onCopy,
  onClose,
}: {
  source: {
    order_code: string;
    points: number;
    depth: number;
    source_partner: string;
    created_at: string;
  };
  copied: boolean;
  onCopy: (text: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      opener?.focus?.();
    };
  }, [onClose]);

  const isPassup = source.depth === 1;

  return (
    <div className="pp-drawer-backdrop" onClick={onClose}>
      <div
        className="pp-drawer"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pp-drawer-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="pp-drawer-head">
          <div>
            <p className="shop-kicker">{source.order_code}</p>
            <h2 id="pp-drawer-title">
              +{source.points} {source.points === 1 ? "Point" : "Points"}
            </h2>
          </div>
          <button type="button" className="pp-sheet-close" aria-label="Close transaction details" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <dl className="pp-dl">
          <div>
            <dt>Points earned</dt>
            <dd>
              <b>+{source.points} {source.points === 1 ? "pt" : "pts"}</b>
            </dd>
          </div>
          <div>
            <dt>Order code</dt>
            <dd>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <code>{source.order_code}</code>
                <button
                  type="button"
                  onClick={() => onCopy(source.order_code)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    background: "none",
                    border: "none",
                    color: "var(--blue)",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                  aria-label="Copy order code"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
              </div>
            </dd>
          </div>
          <div>
            <dt>Date</dt>
            <dd>{formatDate(source.created_at)}</dd>
          </div>
          <div>
            <dt>Attributed store</dt>
            <dd>
              <strong>{isPassup ? (source.source_partner || "Referred Partner") : "Direct Shop"}</strong>
            </dd>
          </div>
          <div>
            <dt>Store type</dt>
            <dd>
              <span className={isPassup ? "pp-tag pp-tag-blue" : "pp-tag pp-tag-bone"}>
                {isPassup ? "Child Lifestyle Store" : "Direct Shop"}
              </span>
            </dd>
          </div>
          <div>
            <dt>Rebate track</dt>
            <dd>
              <span className={isPassup ? "pp-tag pp-tag-blue" : "pp-tag pp-tag-bone"}>
                {isPassup ? "Track B · Referred" : "Track A · Direct"}
              </span>
            </dd>
          </div>
        </dl>

        <p className="shop-note" style={{ margin: "14px 0 0" }}>
          {isPassup
            ? "Pass-up points earned from referred partner orders count toward Track B group targets."
            : "Commission points earned directly from customer orders count toward Track A direct targets."}
        </p>

        <div className="pp-sheet-footer" style={{ marginTop: "auto", padding: "16px 0 0", background: "transparent" }}>
          <button
            type="button"
            className="shop-secondary pp-sheet-btn-secondary"
            style={{ width: "100%" }}
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function RebateMilestoneDrawer({
  rebate,
  onClose,
}: {
  rebate: {
    cycle_number: number;
    milestone_pts: number;
    rebate_amount: number;
    status: string;
    created_at: string;
  };
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      opener?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="pp-drawer-backdrop" onClick={onClose}>
      <div
        className="pp-drawer"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pp-drawer-rebate-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="pp-drawer-head">
          <div>
            <p className="shop-kicker">Cycle {rebate.cycle_number} milestone</p>
            <h2 id="pp-drawer-rebate-title">{peso(rebate.rebate_amount)}</h2>
          </div>
          <button type="button" className="pp-sheet-close" aria-label="Close milestone details" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <dl className="pp-dl">
          <div>
            <dt>Status</dt>
            <dd>
              <span className={`partner-badge ${rebate.status === "paid" ? "paid" : "pending"}`}>
                {rebate.status === "paid" ? "paid" : "processing"}
              </span>
            </dd>
          </div>
          <div>
            <dt>Requirement</dt>
            <dd>
              <b>{rebate.milestone_pts} Points reached</b>
            </dd>
          </div>
          <div>
            <dt>Date unlocked</dt>
            <dd>{formatDate(rebate.created_at)}</dd>
          </div>
          <div>
            <dt>Cycle</dt>
            <dd>Cycle {rebate.cycle_number} ({CYCLE_TARGET} pts target)</dd>
          </div>
        </dl>

        <p className="shop-note" style={{ margin: "14px 0 0" }}>
          Cash rebates are audited and disbursed directly to your registered bank account by administration upon cycle validation.
        </p>

        <div className="pp-sheet-footer" style={{ marginTop: "auto", padding: "16px 0 0", background: "transparent" }}>
          <button
            type="button"
            className="shop-secondary pp-sheet-btn-secondary"
            style={{ width: "100%" }}
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
