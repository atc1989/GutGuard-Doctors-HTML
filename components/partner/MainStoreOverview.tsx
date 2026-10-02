"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Copy } from "lucide-react";
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
  const { copy } = useCopy();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
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

  async function handleCopy(text: string, key: string) {
    const success = await copy(text);
    if (success) {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  }

  const combinedPts = mainData?.combined_points ?? (dashboard.points.own_points + dashboard.points.passup_points);
  const cycleNumber = Math.floor(combinedPts / CYCLE_TARGET) + 1;
  const ptsInCycle = combinedPts % CYCLE_TARGET;
  const cyclePct = Math.min(100, (ptsInCycle / CYCLE_TARGET) * 100);

  const ownPts = mainData?.own_points ?? dashboard.points.own_points;
  const passupPts = mainData?.passup_points ?? dashboard.points.passup_points;
  const lifestyleCount = mainData?.lifestyle_count ?? 0;
  const totalOrders = mainData?.total_orders ?? 0;

  return (
    <div className="pp-screen">
      <PageHeader
        kicker="Main Store umbrella"
        title={dashboard.partner.full_name}
        lede="Oversee all descendant Lifestyle and Affiliate stores under your Main Store umbrella."
      />

      {/* Main Store High-Level Stats */}
      <section className="pp-stats" aria-label="Main Store Summary">
        <StatTile
          label="Lifestyle Stores"
          value={loading ? "--" : String(lifestyleCount)}
          note="active child lifestyle stores"
        />
        <StatTile
          label="Affiliate Stores"
          value={loading ? "--" : String(mainData?.affiliate_count ?? 0)}
          note="onboarding partner stores"
        />
        <StatTile
          label="Total Network Orders"
          value={loading ? "--" : String(totalOrders)}
          note="all descendant stores + own orders"
        />
        <StatTile
          label="Total Network Gross"
          value={loading ? "--" : peso(mainData?.total_revenue ?? 0)}
          note="cumulative paid order value"
        />
      </section>

      <p className="pp-perf">
        Network summary: {lifestyleCount} active Lifestyle stores · {dashboard.clicks.last_30_days} retail clicks in the last 30 days · {combinedPts} lifetime pooled points
      </p>

      <div className="pp-grid">
        {/* Left Column: Recent Orders Overview */}
        <section className="pp-card" aria-labelledby="pp-main-recent">
          <div className="pp-card-head">
            <h2 id="pp-main-recent">Network orders</h2>
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
              <h2 id="pp-main-epoints">Main Store rebates</h2>
              <Link href="/partner/e-points" className="pp-more">
                Details <ArrowRight aria-hidden="true" size={14} />
              </Link>
            </div>
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
            <div className="pp-ms-rebate-grid">
              <div className="pp-ms-rebate-stat">
                <span className="pp-ms-rebate-label">Direct Shop</span>
                <strong className="pp-ms-rebate-val">{ownPts} pts</strong>
              </div>
              <div className="pp-ms-rebate-stat">
                <span className="pp-ms-rebate-label">Pass-Up</span>
                <strong className="pp-ms-rebate-val">{passupPts} pts</strong>
              </div>
              <div className="pp-ms-rebate-stat">
                <span className="pp-ms-rebate-label">Total Pooled</span>
                <strong className="pp-ms-rebate-val is-gold">{combinedPts} pts</strong>
              </div>
            </div>
          </section>

          <section className="pp-card" aria-labelledby="pp-main-quick-links">
            <div className="pp-card-head">
              <h2 id="pp-main-quick-links">Share & grow links</h2>
              <Link href="/partner/share" className="pp-more">
                QR codes <ArrowRight aria-hidden="true" size={14} />
              </Link>
            </div>
            <div className="pp-share-row">
              <div className="pp-share-row-info">
                <span className="shop-kicker" style={{ margin: 0, fontSize: "11px" }}>Retail shop link</span>
                <span className="pp-share-row-url">{shopLink}</span>
              </div>
              <button
                type="button"
                className="shop-primary pp-share-row-btn"
                onClick={() => handleCopy(shopLink, "shop")}
                aria-label="Copy retail shop link"
              >
                {copiedKey === "shop" ? <Check aria-hidden="true" size={14} /> : <Copy aria-hidden="true" size={14} />}
                <span>{copiedKey === "shop" ? "Copied" : "Copy"}</span>
              </button>
            </div>
            <div className="pp-share-row" style={{ marginTop: 10 }}>
              <div className="pp-share-row-info">
                <span className="shop-kicker" style={{ margin: 0, fontSize: "11px" }}>Partner invite link</span>
                <span className="pp-share-row-url">{regLink}</span>
              </div>
              <button
                type="button"
                className="shop-secondary pp-share-row-btn"
                onClick={() => handleCopy(regLink, "referral")}
                aria-label="Copy partner registration link"
              >
                {copiedKey === "referral" ? <Check aria-hidden="true" size={14} /> : <Copy aria-hidden="true" size={14} />}
                <span>{copiedKey === "referral" ? "Copied" : "Copy"}</span>
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
