"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Copy, Store, Users, ShoppingBag, Coins, TrendingUp } from "lucide-react";
import {
  CYCLE_TARGET,
  EmptyState,
  PageHeader,
  StatTile,
  formatDate,
  getPartnerQrLink,
  peso,
  useCopy,
  usePartner,
} from "./shared";
import { getMainStoreDashboard, type MainStoreDashboard } from "@/lib/api";

export default function MainStoreOverview() {
  const { dashboard } = usePartner();
  const { copied, copy } = useCopy();
  const [mainData, setMainData] = useState<MainStoreDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const shopLink = getPartnerQrLink(dashboard.partner, "shop");
  const regLink = getPartnerQrLink(dashboard.partner, "referral");

  useEffect(() => {
    let cancelled = false;
    getMainStoreDashboard()
      .then((res) => {
        if (!cancelled) {
          setMainData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load main store dashboard:", err);
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const combinedPts = mainData?.combined_points ?? (dashboard.points.own_points + dashboard.points.passup_points);
  const cycleNumber = Math.floor(combinedPts / CYCLE_TARGET) + 1;
  const ptsInCycle = combinedPts % CYCLE_TARGET;
  const cyclePct = Math.min(100, (ptsInCycle / CYCLE_TARGET) * 100);

  return (
    <div className="pp-screen">
      <PageHeader
        kicker="Main Store umbrella"
        title={dashboard.partner.full_name}
        lede="Oversee all descendant Lifestyle and Affiliate stores under your Main Store umbrella."
      />

      {/* Main Store High-Level Stats */}
      <section className="pp-stats" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }} aria-label="Main Store Summary">
        <StatTile
          label="Lifestyle Stores"
          value={loading ? "--" : String(mainData?.lifestyle_count ?? 0)}
          note="active child lifestyle stores"
        />
        <StatTile
          label="Affiliate Stores"
          value={loading ? "--" : String(mainData?.affiliate_count ?? 0)}
          note="onboarding partner stores"
        />
        <StatTile
          label="Total Network Orders"
          value={loading ? "--" : String(mainData?.total_orders ?? 0)}
          note="all descendant stores + own orders"
        />
        <StatTile
          label="Total Network Gross"
          value={loading ? "--" : peso(mainData?.total_revenue ?? 0)}
          note="cumulative paid order value"
        />
      </section>

      <div className="pp-grid">
        {/* Left Column: Recent Orders Overview */}
        <section className="pp-card" aria-labelledby="pp-main-recent">
          <div className="pp-card-head">
            <h2 id="pp-main-recent">Network Orders</h2>
            <Link href="/partner/reports" className="pp-more">
              All reports & stores <ArrowRight aria-hidden="true" size={14} />
            </Link>
          </div>
          {dashboard.orders.length ? (
            <ul className="pp-recent">
              {dashboard.orders.slice(0, 6).map((order) => (
                <li key={order.order_code}>
                  <span>
                    <strong>{order.buyer_name || order.buyer_first_name || "Customer"}</strong>
                    <small>
                      {order.order_code} · {formatDate(order.created_at)}
                      {order.source_partner_name ? ` · Via ${order.source_partner_name}` : " · Direct Shop"}
                    </small>
                  </span>
                  <span className="pp-recent-end">
                    <span className={order.source_type === "direct" ? "pp-tag pp-tag-bone" : "pp-tag pp-tag-blue"}>
                      {order.source_type === "direct" ? "Main Store" : "Child Store"}
                    </span>
                    <b>{peso(order.total_amount)}</b>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No network orders yet.">
              Share your Shop QR or invite new partner stores with your Registration link.
            </EmptyState>
          )}
        </section>

        {/* Right Column: Combined Rebate Track & Quick Links */}
        <div className="pp-stack">
          <section className="pp-card" aria-labelledby="pp-main-epoints">
            <div className="pp-card-head">
              <h2 id="pp-main-epoints">Main Store Combined Rebates</h2>
              <Link href="/partner/e-points" className="pp-more">
                Rebate details <ArrowRight aria-hidden="true" size={14} />
              </Link>
            </div>
            <p style={{ fontSize: "13px", color: "var(--ink-3)", margin: "0 0 12px" }}>
              Direct shop sales and pass-up points from directly referred partner stores are <strong>combined</strong> into one 1,500-point rebate track.
            </p>
            <div className="pp-progress-labels">
              <strong>{ptsInCycle} / {CYCLE_TARGET} pts (Cycle {cycleNumber})</strong>
              <span>{Math.round(cyclePct)}%</span>
            </div>
            <div
              className="pp-progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={CYCLE_TARGET}
              aria-valuenow={Math.min(ptsInCycle, CYCLE_TARGET)}
              aria-label="Combined cycle progress"
            >
              <div style={{ width: `${cyclePct}%`, background: "var(--gold)" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px", fontSize: "12px", color: "var(--ink-2)" }}>
              <span>Own Shop Pts: <strong>{mainData?.own_points ?? dashboard.points.own_points}</strong></span>
              <span>Referred Pass-Up: <strong>{mainData?.passup_points ?? dashboard.points.passup_points}</strong></span>
              <span>Total Lifetime: <strong>{combinedPts} pts</strong></span>
            </div>
          </section>

          <section className="pp-card" aria-labelledby="pp-main-quick-links">
            <div className="pp-card-head">
              <h2 id="pp-main-quick-links">Main Store Share Links</h2>
              <Link href="/partner/share" className="pp-more">
                QR Codes <ArrowRight aria-hidden="true" size={14} />
              </Link>
            </div>
            <div style={{ marginBottom: "16px" }}>
              <p className="shop-kicker">1. Main shop link (direct retail)</p>
              <p className="partner-link" style={{ fontSize: "13px" }}>{shopLink}</p>
              <button type="button" className="shop-secondary pp-block-btn" onClick={() => copy(shopLink)}>
                {copied ? <Check aria-hidden="true" size={14} /> : <Copy aria-hidden="true" size={14} />}
                <span>Copy Main Shop Link</span>
              </button>
            </div>
            <div>
              <p className="shop-kicker">2. Partner registration link (invite stores)</p>
              <p className="partner-link" style={{ fontSize: "13px" }}>{regLink}</p>
              <button type="button" className="shop-secondary pp-block-btn" onClick={() => copy(regLink)}>
                {copied ? <Check aria-hidden="true" size={14} /> : <Copy aria-hidden="true" size={14} />}
                <span>Copy Registration Link</span>
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
