"use client";

import { useState } from "react";
import Link from "next/link";
import { EmptyState, PageHeader, Pagination, peso, usePartner } from "./shared";

export default function PartnersPage() {
  const { dashboard } = usePartner();
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const total = dashboard.totals.referred_partners;
  const visible = dashboard.referred_partners.slice(offset, offset + pageSize);

  return (
    <>
      <PageHeader kicker="Partners you referred" title={total ? `${total} partners` : "No referred partners yet"} />

      <section className="pp-card pp-card-flush">
        {visible.length ? (
          <ul className="pp-partner-list">
            {visible.map((partner) => (
              <li key={partner.routing_slug}>
                <Link href="/partner/orders?scope=referred" className="pp-partner-row">
                  <span>
                    <strong>{partner.full_name}</strong>
                    <small>{[partner.specialty, partner.practice_location].filter(Boolean).join(" · ") || "Partner"}</small>
                  </span>
                  <span><strong>{partner.orders}</strong><small>orders</small></span>
                  <span><strong>{peso(partner.paid_order_value)}</strong><small>paid order value</small></span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Your referral registrations will appear here.">Share your Referral QR to invite another GutGuard partner.</EmptyState>
        )}
        <Pagination
          label="Referred partner pages" offset={offset} pageSize={pageSize} total={total} shown={visible.length} noun="partners"
          onOffset={setOffset} onPageSize={(size) => { setPageSize(size); setOffset(0); }}
        />
      </section>
    </>
  );
}
