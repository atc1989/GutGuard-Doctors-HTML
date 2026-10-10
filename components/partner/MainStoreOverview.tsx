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
import { getMainStoreDashboard, getMainStoreReports, type MainStoreDashboard, type MainStoreOrder } from "@/lib/api";

export default function MainStoreOverview() {
  const { dashboard } = usePartner();
  const { copied, copy } = useCopy();
  const [mainData, setMainData] = useState<MainStoreDashboard | null>(null);
  const [recentOrders, setRecentOrders] = useState<MainStoreOrder[]>([]);
  const [loading, setLoading] = useState(true);

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
    // The whole Main Store tree, same source as Reports. partner_dashboard only covers the
    // store's own links and its directly referred partners, so it misses deeper stores.
    getMainStoreReports({ limit: 5 })
      .then((res) => {
        if (!cancelled) setRecentOrders(res.orders);
      })
      .catch((err) => console.error("Failed to load recent network orders:", err));

    return () => {
      cancelled = true;
    };
  }, []);

  const combinedPts = mainData?.combined_points ?? (dashboard.points.own_points + dashboard.points.passup_points);
  const cycleNumber = Math.floor(combinedPts / CYCLE_TARGET) + 1;
  const ptsInCycle = combinedPts % CYCLE_TARGET;
  const cyclePct = Math.min(100, (ptsInCycle / CYCLE_TARGET) * 100);

  const lifestyleCount = mainData?.lifestyle_count ?? 0;
  const affiliateCount = mainData?.affiliate_count ?? 0;
  const totalOrders = mainData?.total_orders ?? 0;
  const totalRevenue = mainData?.total_revenue ?? 0;

  return (
    <>
      <PageHeader
        kicker="Main store umbrella"
        title={dashboard.partner.full_name}
      />

      <section className="pp-stats" aria-label="Summary">
        <StatTile label="Lifestyle stores" value={loading ? "--" : String(lifestyleCount)} note="active child lifestyle stores" />
        <StatTile label="Affiliate stores" value={loading ? "--" : String(affiliateCount)} note="onboarding partner stores" />
        <StatTile label="Network orders" value={loading ? "--" : String(totalOrders)} note="all descendant stores + own orders" />
        <StatTile label="Network gross" value={loading ? "--" : peso(totalRevenue)} note="cumulative paid order value" />
      </section>

      <div className="pp-grid">
        <section className="pp-card" aria-labelledby="pp-recent">
          <div className="pp-card-head">
            <h2 id="pp-recent">Recent network orders</h2>
            <Link href="/partner/reports" className="pp-more">
              View all <ArrowRight aria-hidden="true" size={14} />
            </Link>
          </div>
          {recentOrders.length ? (
            <ul className="pp-recent">
              {recentOrders.map((order) => {
                const direct = order.store_id === dashboard.partner.id;
                return (
                <li key={order.order_code}>
                  <span>
                    <strong>{order.buyer_name || "A customer"}</strong>
                    <small>
                      {order.order_code} · {formatDate(order.created_at)}
                      {direct ? " · Direct shop" : ` · Via ${order.store_name}`}
                    </small>
                  </span>
                  <span className="pp-recent-end">
                    <span className={direct ? "pp-tag pp-tag-bone" : "pp-tag pp-tag-blue"}>
                      {direct ? "Direct" : "Child store"}
                    </span>
                    <b>{peso(order.total_amount)}</b>
                  </span>
                </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState title="No network orders yet.">
              Share your shop link or invite new partner stores with your registration link.
            </EmptyState>
          )}
        </section>

        <div className="pp-stack">
          <section className="pp-card" aria-labelledby="pp-epoints">
            <div className="pp-card-head">
              <h2 id="pp-epoints">Combined rebates · Cycle {cycleNumber}</h2>
              <Link href="/partner/e-points" className="pp-more">
                Details <ArrowRight aria-hidden="true" size={14} />
              </Link>
            </div>
            <div className="pp-progress-labels">
              <strong>{ptsInCycle} pts</strong>
              <span>Target {CYCLE_TARGET}</span>
            </div>
            <div
              className="pp-progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={CYCLE_TARGET}
              aria-valuenow={Math.min(ptsInCycle, CYCLE_TARGET)}
              aria-label="Combined cycle progress"
            >
              <div style={{ width: `${cyclePct}%` }} />
            </div>
            <p className="pp-muted">
              {ptsInCycle < CYCLE_TARGET
                ? `${CYCLE_TARGET - ptsInCycle} points to complete this cycle (${ptsInCycle} of ${CYCLE_TARGET} pts).`
                : "Cycle target reached."}
            </p>
          </section>

          <section className="pp-card" aria-labelledby="pp-share">
            <div className="pp-card-head">
              <h2 id="pp-share">Partner invite link</h2>
              <Link href="/partner/share" className="pp-more">
                QR codes <ArrowRight aria-hidden="true" size={14} />
              </Link>
            </div>
            <p className="partner-link">{regLink}</p>
            <button type="button" className="shop-primary pp-block-btn" onClick={() => copy(regLink)}>
              {copied ? <Check aria-hidden="true" size={16} /> : <Copy aria-hidden="true" size={16} />}
              <span>{copied ? "Copied" : "Copy partner invite link"}</span>
            </button>
          </section>
        </div>
      </div>
    </>
  );
}
