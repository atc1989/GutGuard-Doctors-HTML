"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronRight,
  Coins,
  Copy,
  ExternalLink,
  Layers,
  List,
  Package,
  Search,
  Sparkles,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import type { ReferredPartner } from "@/lib/api";
import {
  EmptyState,
  PageHeader,
  Pagination,
  StatTile,
  formatDate,
  peso,
  useCopy,
  usePartner,
} from "./shared";

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "P";
}

export default function PartnersPage() {
  const { dashboard } = usePartner();
  const { point_sources: sources = [] } = dashboard;
  const { copied, copy } = useCopy();

  const [tab, setTab] = useState<"hierarchy" | "directory">("hierarchy");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"points" | "orders" | "volume" | "name">("points");
  const [expandedPartners, setExpandedPartners] = useState<Record<string, boolean>>({});
  const [selectedPartner, setSelectedPartner] = useState<ReferredPartner | null>(null);

  // Pagination for Directory view
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  // Map of partner full_name -> total pass-up points & matching order transactions
  const partnerPointsMap = useMemo(() => {
    const map = new Map<string, { totalPts: number; orders: typeof sources }>();
    sources.forEach((item) => {
      const name = item.source_partner || "Unknown Partner";
      const existing = map.get(name) || { totalPts: 0, orders: [] };
      existing.totalPts += item.points;
      existing.orders.push(item);
      map.set(name, existing);
    });
    return map;
  }, [sources]);

  // Filter & Sort
  const filteredPartners = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = [...dashboard.referred_partners].filter((p) => {
      if (!q) return true;
      return (
        p.full_name.toLowerCase().includes(q) ||
        p.specialty.toLowerCase().includes(q) ||
        p.practice_location.toLowerCase().includes(q) ||
        p.routing_slug.toLowerCase().includes(q)
      );
    });

    list.sort((a, b) => {
      const aPts = partnerPointsMap.get(a.full_name)?.totalPts || 0;
      const bPts = partnerPointsMap.get(b.full_name)?.totalPts || 0;
      if (sortBy === "points") return bPts - aPts;
      if (sortBy === "orders") return b.orders - a.orders;
      if (sortBy === "volume") return b.paid_order_value - a.paid_order_value;
      return a.full_name.localeCompare(b.full_name);
    });

    return list;
  }, [dashboard.referred_partners, search, sortBy, partnerPointsMap]);

  // Paginated list for directory
  const paginatedDirectory = useMemo(() => {
    return filteredPartners.slice(offset, offset + pageSize);
  }, [filteredPartners, offset, pageSize]);

  // Expand / Collapse toggles
  const toggleExpand = (slug: string) => {
    setExpandedPartners((prev) => ({ ...prev, [slug]: !prev[slug] }));
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    filteredPartners.forEach((p) => { next[p.routing_slug] = true; });
    setExpandedPartners(next);
  };

  const collapseAll = () => {
    setExpandedPartners({});
  };

  // Keyboard escape for modal
  useEffect(() => {
    if (!selectedPartner) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedPartner(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selectedPartner]);

  return (
    <>
      <PageHeader
        kicker="Downline & Referrals"
        title="Partner Network & Team Hierarchy"
      />

      {/* Overview Stats Strip */}
      <section className="pp-stats" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }} aria-label="Network summary">
        <StatTile
          label="Direct Partners"
          value={String(dashboard.totals.referred_partners)}
          note="doctors who joined via your link"
        />
        <StatTile
          label="Downline Orders"
          value={String(dashboard.totals.referred_orders)}
          note="orders placed through downline shops"
        />
        <StatTile
          label="Pass-Up Points"
          value={`${dashboard.points.passup_points} pts`}
          note="passed up towards your cycle target"
        />
        <StatTile
          label="Downline Volume"
          value={peso(dashboard.totals.referred_paid_amount)}
          note="total paid orders in your network"
        />
      </section>

      {/* Main Tab Switcher */}
      <div className="pp-seg" role="tablist" aria-label="Partner view" style={{ marginTop: 20, marginBottom: 16 }}>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "hierarchy"}
          className={tab === "hierarchy" ? "active" : ""}
          onClick={() => setTab("hierarchy")}
        >
          Team Hierarchy
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "directory"}
          className={tab === "directory" ? "active" : ""}
          onClick={() => setTab("directory")}
        >
          Partner Directory
        </button>
      </div>

      {/* Search and Sort Toolbar */}
      <div className="pp-partner-toolbar">
        <div className="pp-partner-search">
          <Search size={16} className="pp-search-icon" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
            placeholder="Search by doctor name, specialty, or clinic..."
            aria-label="Search referred partners"
          />
          {search ? (
            <button type="button" onClick={() => setSearch("")} className="pp-search-clear" aria-label="Clear search">
              <X size={14} />
            </button>
          ) : null}
        </div>

        <div className="pp-partner-actions">
          <label className="pp-partner-sort">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <ArrowUpDown size={12} aria-hidden="true" />
              <span>Sort</span>
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              aria-label="Sort partners"
            >
              <option value="points">Most E-Points</option>
              <option value="orders">Most Orders</option>
              <option value="volume">Highest Sales</option>
              <option value="name">Alphabetical</option>
            </select>
          </label>

          {tab === "hierarchy" && filteredPartners.length > 0 ? (
            <div className="pp-tree-quick-toggles">
              <button type="button" className="shop-secondary pp-tree-quick-btn" onClick={expandAll}>
                Expand all
              </button>
              <button type="button" className="shop-secondary pp-tree-quick-btn" onClick={collapseAll}>
                Collapse
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* TAB 1: TEAM HIERARCHY (Expandable Tree List) */}
      {tab === "hierarchy" ? (
        <section aria-label="Team Hierarchy List">
          {filteredPartners.length ? (
            <div className="pp-tree-list">
              {filteredPartners.map((partner) => {
                const isExpanded = Boolean(expandedPartners[partner.routing_slug]);
                const pointsData = partnerPointsMap.get(partner.full_name) || { totalPts: 0, orders: [] };
                const isActive = partner.orders > 0;

                return (
                  <article key={partner.routing_slug} className={`pp-tree-card ${isExpanded ? "is-expanded" : ""}`}>
                    {/* Parent Header Row */}
                    <div
                      className="pp-tree-head"
                      onClick={() => toggleExpand(partner.routing_slug)}
                      role="button"
                      tabIndex={0}
                      aria-expanded={isExpanded}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleExpand(partner.routing_slug);
                        }
                      }}
                    >
                      <div className="pp-tree-left">
                        <button
                          type="button"
                          className={`pp-tree-chevron ${isExpanded ? "open" : ""}`}
                          aria-label={isExpanded ? "Collapse downline details" : "Expand downline details"}
                          tabIndex={-1}
                        >
                          <ChevronRight size={16} aria-hidden="true" />
                        </button>

                        <span className="pp-tree-avatar" aria-hidden="true">
                          {initials(partner.full_name)}
                        </span>

                        <div className="pp-tree-meta">
                          <div className="pp-tree-name">
                            <strong>{partner.full_name}</strong>
                            <span className={isActive ? "pp-tag pp-tag-success" : "pp-tag pp-tag-bone"}>
                              {isActive ? "Active Partner" : "Registered"}
                            </span>
                          </div>
                          <span className="pp-tree-sub">
                            {[partner.specialty, partner.practice_location].filter(Boolean).join(" · ") || "Doctor Partner"}
                            {partner.joined_at ? ` · Joined ${formatDate(partner.joined_at)}` : ""}
                          </span>
                        </div>
                      </div>

                      <div className="pp-tree-right">
                        <div className="pp-tree-stats">
                          <span className="pp-tree-pts">
                            +{pointsData.totalPts} {pointsData.totalPts === 1 ? "pt" : "pts"}
                          </span>
                          <span className="pp-tree-orders">
                            {partner.orders} {partner.orders === 1 ? "order" : "orders"}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="pp-tree-inspect-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPartner(partner);
                          }}
                          aria-label={`View profile for ${partner.full_name}`}
                        >
                          Details
                        </button>
                      </div>
                    </div>

                    {/* Expandable Downline Branch */}
                    {isExpanded ? (
                      <div className="pp-tree-branch">
                        <div className="pp-tree-branch-header">
                          <span className="pp-tree-branch-kicker">Downline Orders & Pass-Up Contribution</span>
                          <span className="pp-tree-branch-val">Total Sales: {peso(partner.paid_order_value)}</span>
                        </div>

                        {pointsData.orders.length > 0 ? (
                          <ul className="pp-tree-orders-list">
                            {pointsData.orders.map((ord, idx) => (
                              <li key={`${ord.order_code}-${idx}`} className="pp-tree-order-item">
                                <div className="pp-tree-order-lead">
                                  <Package size={14} className="pp-tree-order-icon" aria-hidden="true" />
                                  <div>
                                    <strong className="pp-tree-order-code">{ord.order_code}</strong>
                                    <small className="pp-tree-order-date">{formatDate(ord.created_at)}</small>
                                  </div>
                                </div>
                                <b className="pp-tree-order-pts">
                                  +{ord.points} {ord.points === 1 ? "pt" : "pts"} passed up
                                </b>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="pp-tree-empty-branch">
                            <p>No pass-up points recorded for this doctor yet. Points will appear here once patient or shop orders are completed.</p>
                          </div>
                        )}

                        <div className="pp-tree-branch-footer">
                          <Link href="/partner/orders?scope=referred" className="pp-tree-link">
                            <span>View all downline orders</span>
                            <ExternalLink size={13} aria-hidden="true" />
                          </Link>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState title={search ? "No matching partners found." : "No referred partners yet."}>
              {search
                ? "Try searching for a different doctor name or practice location."
                : "Share your Referral QR code to invite doctors to the GutGuard network."}
            </EmptyState>
          )}
        </section>
      ) : (
        /* TAB 2: PARTNER DIRECTORY (Roster Table View) */
        <section className="pp-card pp-card-flush" aria-label="Partner Directory">
          {paginatedDirectory.length ? (
            <>
              <ul className="pp-partner-list">
                {paginatedDirectory.map((partner) => {
                  const pointsData = partnerPointsMap.get(partner.full_name) || { totalPts: 0 };
                  return (
                    <li key={partner.routing_slug} className="pp-partner-dir-item">
                      <div className="pp-partner-dir-main">
                        <span className="pp-tree-avatar" aria-hidden="true">
                          {initials(partner.full_name)}
                        </span>
                        <div className="pp-partner-dir-info">
                          <div className="pp-tree-name">
                            <strong>{partner.full_name}</strong>
                            <span className={partner.orders > 0 ? "pp-tag pp-tag-success" : "pp-tag pp-tag-bone"}>
                              {partner.orders > 0 ? "Active" : "Registered"}
                            </span>
                          </div>
                          <small className="pp-log-date">
                            {[partner.specialty, partner.practice_location].filter(Boolean).join(" · ") || "Doctor Partner"}
                          </small>
                        </div>
                      </div>

                      <div className="pp-partner-dir-metrics">
                        <div>
                          <strong>{partner.orders}</strong>
                          <small>orders</small>
                        </div>
                        <div>
                          <strong>{peso(partner.paid_order_value)}</strong>
                          <small>sales volume</small>
                        </div>
                        <div>
                          <strong className="is-blue">+{pointsData.totalPts}</strong>
                          <small>E-Points</small>
                        </div>
                        <button
                          type="button"
                          className="shop-secondary pp-tree-quick-btn"
                          onClick={() => setSelectedPartner(partner)}
                          aria-label={`View profile for ${partner.full_name}`}
                        >
                          Profile
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <Pagination
                label="Referred partner pages"
                offset={offset}
                pageSize={pageSize}
                total={filteredPartners.length}
                shown={paginatedDirectory.length}
                noun="partners"
                onOffset={setOffset}
                onPageSize={(size) => { setPageSize(size); setOffset(0); }}
              />
            </>
          ) : (
            <EmptyState title={search ? "No matching partners found." : "No referred partners yet."}>
              {search ? "Try adjusting your search criteria." : "Share your Referral QR to invite another GutGuard partner."}
            </EmptyState>
          )}
        </section>
      )}

      {/* Partner Detail Bottom Sheet / Modal (GutGuard Design System Drawer & Modal) */}
      {selectedPartner ? (
        <div className="pp-sheet-wrap" role="dialog" aria-modal="true" aria-labelledby="pp-sheet-partner-title">
          <div className="pp-sheet-backdrop" onClick={() => setSelectedPartner(null)} aria-hidden="true" />
          <div className="pp-sheet">
            <div className="pp-sheet-grab" aria-hidden="true" />
            <div className="pp-sheet-head">
              <h3 id="pp-sheet-partner-title" className="pp-sheet-title">Partner Profile</h3>
              <button
                type="button"
                className="pp-sheet-close"
                onClick={() => setSelectedPartner(null)}
                aria-label="Close profile"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="pp-sheet-body">
              <div className="pp-sheet-hero">
                <span className="pp-tree-avatar" style={{ width: 52, height: 52, fontSize: 18 }} aria-hidden="true">
                  {initials(selectedPartner.full_name)}
                </span>
                <h2 className="pp-sheet-hero-val" style={{ fontSize: 24, marginTop: 8 }}>
                  {selectedPartner.full_name}
                </h2>
                <span className={selectedPartner.orders > 0 ? "pp-tag pp-tag-success" : "pp-tag pp-tag-bone"}>
                  {selectedPartner.orders > 0 ? "Active Downline Partner" : "Registered Partner"}
                </span>
              </div>

              <div className="pp-sheet-dl">
                <div className="pp-sheet-row">
                  <span className="pp-sheet-dt">Specialty</span>
                  <strong className="pp-sheet-dd">{selectedPartner.specialty || "General Physician"}</strong>
                </div>

                <div className="pp-sheet-row">
                  <span className="pp-sheet-dt">Practice Location</span>
                  <strong className="pp-sheet-dd">{selectedPartner.practice_location || "Philippines"}</strong>
                </div>

                <div className="pp-sheet-row">
                  <span className="pp-sheet-dt">Network Tier</span>
                  <strong className="pp-sheet-dd">Tier 1 · Direct Referral</strong>
                </div>

                <div className="pp-sheet-row">
                  <span className="pp-sheet-dt">Joined Date</span>
                  <strong className="pp-sheet-dd">{selectedPartner.joined_at ? formatDate(selectedPartner.joined_at) : "--"}</strong>
                </div>

                <div className="pp-sheet-row">
                  <span className="pp-sheet-dt">Direct Sales Volume</span>
                  <strong className="pp-sheet-dd">{peso(selectedPartner.paid_order_value)} ({selectedPartner.orders} orders)</strong>
                </div>

                <div className="pp-sheet-row">
                  <span className="pp-sheet-dt">Contributed E-Points</span>
                  <strong className="pp-sheet-dd" style={{ color: "var(--blue)" }}>
                    +{partnerPointsMap.get(selectedPartner.full_name)?.totalPts || 0} E-Points
                  </strong>
                </div>

                <div className="pp-sheet-row">
                  <span className="pp-sheet-dt">Partner Slug</span>
                  <div className="pp-sheet-dd-with-action">
                    <span className="pp-sheet-code">{selectedPartner.routing_slug}</span>
                    <button
                      type="button"
                      className="pp-sheet-copy-btn"
                      onClick={() => copy(selectedPartner.routing_slug)}
                      aria-label="Copy partner slug"
                    >
                      {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                      <span>{copied ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="pp-sheet-footer">
              <Link
                href="/partner/orders?scope=referred"
                className="shop-primary pp-sheet-btn-primary"
                onClick={() => setSelectedPartner(null)}
              >
                View Referred Orders
              </Link>
              <button
                type="button"
                className="shop-secondary pp-sheet-btn-secondary"
                onClick={() => setSelectedPartner(null)}
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
