"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ExternalLink,
  Gift,
  ListOrdered,
  Mail,
  MessageSquare,
  Package,
  Send,
  ShoppingBag,
  Star,
  Store,
  Tag,
  TrendingUp,
  Users,
  Video,
} from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";

type OverviewMetrics = {
  doctorsCount: number | null;
  ordersCount: number | null;
  productsCount: number | null;
  promosCount: number | null;
  pendingTestimonialsCount: number | null;
  referredShopsCount: number | null;
  loading: boolean;
};

export default function AdminOverviewPage() {
  const [metrics, setMetrics] = useState<OverviewMetrics>({
    doctorsCount: null,
    ordersCount: null,
    productsCount: null,
    promosCount: null,
    pendingTestimonialsCount: null,
    referredShopsCount: null,
    loading: true,
  });

  useEffect(() => {
    let active = true;

    async function loadStats() {
      try {
        const [doctorsRes, ordersRes, productsRes, promosRes, testimonialsRes, shopsRes] = await Promise.allSettled([
          fetch("/api/admin/doctors").then((r) => (r.ok ? r.json() : null)),
          fetch("/api/admin/shop-orders").then((r) => (r.ok ? r.json() : null)),
          fetch("/api/admin/products").then((r) => (r.ok ? r.json() : null)),
          fetch("/api/admin/promos").then((r) => (r.ok ? r.json() : null)),
          fetch("/api/admin/testimonials").then((r) => (r.ok ? r.json() : null)),
          fetch("/api/admin/referred-shops").then((r) => (r.ok ? r.json() : null)),
        ]);

        if (!active) return;

        const doctors = doctorsRes.status === "fulfilled" && doctorsRes.value ? doctorsRes.value.doctors ?? doctorsRes.value : [];
        const orders = ordersRes.status === "fulfilled" && ordersRes.value ? ordersRes.value.orders ?? ordersRes.value : [];
        const products = productsRes.status === "fulfilled" && productsRes.value ? productsRes.value.products ?? productsRes.value : [];
        const promos = promosRes.status === "fulfilled" && promosRes.value ? promosRes.value.promos ?? promosRes.value : [];
        const testimonials = testimonialsRes.status === "fulfilled" && testimonialsRes.value ? testimonialsRes.value.stories ?? testimonialsRes.value : [];
        const shops = shopsRes.status === "fulfilled" && shopsRes.value ? shopsRes.value.shops ?? shopsRes.value : [];

        const pendingTestimonials = Array.isArray(testimonials)
          ? testimonials.filter((t: { status?: string }) => t.status === "pending").length
          : null;

        setMetrics({
          doctorsCount: Array.isArray(doctors) ? doctors.length : null,
          ordersCount: Array.isArray(orders) ? orders.length : null,
          productsCount: Array.isArray(products) ? products.length : null,
          promosCount: Array.isArray(promos) ? promos.length : null,
          pendingTestimonialsCount: pendingTestimonials,
          referredShopsCount: Array.isArray(shops) ? shops.length : null,
          loading: false,
        });
      } catch {
        if (active) setMetrics((m) => ({ ...m, loading: false }));
      }
    }

    loadStats();
    return () => {
      active = false;
    };
  }, []);

  const todayStr = new Intl.DateTimeFormat("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());

  const quickActions = [
    {
      title: "Doctor Registrations",
      desc: "Search, verify physician partners, manage QR attribution, and promote store tiers.",
      href: "/admin/doctors",
      icon: Users,
      badge: metrics.doctorsCount !== null ? `${metrics.doctorsCount} registered` : undefined,
      color: "var(--blue)",
    },
    {
      title: "Shop Orders",
      desc: "Track customer orders, Maya payment status, package line items, and delivery status.",
      href: "/admin/orders",
      icon: Package,
      badge: metrics.ordersCount !== null ? `${metrics.ordersCount} total` : undefined,
      color: "#059669",
    },
    {
      title: "Product Catalog",
      desc: "Update product pricing, inventory status (active/hidden/archived), and trial options.",
      href: "/admin/products",
      icon: ShoppingBag,
      badge: metrics.productsCount !== null ? `${metrics.productsCount} items` : undefined,
      color: "#D97706",
    },
    {
      title: "Promotions & Flash Sales",
      desc: "Configure promotional pricing, percentage discounts, start/end dates, and caps.",
      href: "/admin/promos",
      icon: Tag,
      badge: metrics.promosCount !== null ? `${metrics.promosCount} campaigns` : undefined,
      color: "#DC2626",
    },
    {
      title: "Referred Clinic Stores",
      desc: "Inspect clinic sales volume, paid orders, partner attributions, and export CSVs.",
      href: "/admin/referred-shops",
      icon: Store,
      badge: metrics.referredShopsCount !== null ? `${metrics.referredShopsCount} clinics` : undefined,
      color: "#2563EB",
    },
    {
      title: "Testimonial Reviews",
      desc: "Moderate incoming patient and doctor stories, watch submitted videos, and publish.",
      href: "/admin/testimonials",
      badge: metrics.pendingTestimonialsCount ? `${metrics.pendingTestimonialsCount} pending review` : undefined,
      highlight: Boolean(metrics.pendingTestimonialsCount && metrics.pendingTestimonialsCount > 0),
      icon: Star,
      color: "#E11D48",
    },
    {
      title: "Wheel of Health",
      desc: "Manage gamified prize allocations, win probabilities, and inventory stock pools.",
      href: "/admin/wheel",
      icon: Gift,
      color: "#7C3AED",
    },
    {
      title: "Newsletter Broadcast",
      desc: "Send branded HTML newsletters to doctor partners with delivery tracking.",
      href: "/admin/newsletter",
      icon: Send,
      color: "#0284C7",
    },
    {
      title: "SMS Blast Campaigns",
      desc: "Broadcast instant SMS notifications to registered doctors' mobile numbers.",
      href: "/admin/sms",
      icon: MessageSquare,
      color: "#4F46E5",
    },
    {
      title: "Email Onboarding Sequence",
      desc: "Inspect multi-step onboarding email automation progress and step templates.",
      href: "/admin/sequence",
      icon: ListOrdered,
      color: "#0D9488",
    },
    {
      title: "TikTok Shop Operations",
      desc: "Sync external orders from TikTok Shop and run raw API diagnostic console commands.",
      href: "/admin/tiktok",
      icon: Video,
      color: "#111827",
    },
    {
      title: "Referral Notification Email",
      desc: "Configure the automated email template sent to doctors when a referred partner registers.",
      href: "/admin/referral-email",
      icon: Mail,
      color: "#B08D5B",
    },
  ];

  return (
    <div className="admin-overview-container">
      <AdminPageHeader
        kicker={todayStr}
        title="Operations Dashboard"
        description="Welcome to the GutGuard Operations CRM. Centralized management for partners, shop orders, catalog, and marketing automation."
      >
        <a
          href="/shop"
          target="_blank"
          rel="noopener noreferrer"
          className="admin-overview-action-btn"
        >
          <ExternalLink size={16} />
          <span>Open Storefront</span>
        </a>
      </AdminPageHeader>

      {/* Primary KPI Metrics Grid */}
      <section className="admin-overview-metrics">
        <div className="admin-kpi-card">
          <div className="admin-kpi-header">
            <span className="admin-kpi-label">Doctor Partners</span>
            <div className="admin-kpi-icon-wrap" style={{ background: "rgba(6, 8, 169, 0.08)", color: "var(--blue)" }}>
              <Users size={20} />
            </div>
          </div>
          <div className="admin-kpi-value">
            {metrics.loading ? <span className="admin-kpi-skeleton" /> : (metrics.doctorsCount ?? "—")}
          </div>
          <div className="admin-kpi-footer">
            <Link href="/admin/doctors" className="admin-kpi-link">
              <span>View partner directory</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-header">
            <span className="admin-kpi-label">Shop Orders</span>
            <div className="admin-kpi-icon-wrap" style={{ background: "rgba(5, 150, 105, 0.08)", color: "#059669" }}>
              <Package size={20} />
            </div>
          </div>
          <div className="admin-kpi-value">
            {metrics.loading ? <span className="admin-kpi-skeleton" /> : (metrics.ordersCount ?? "—")}
          </div>
          <div className="admin-kpi-footer">
            <Link href="/admin/orders" className="admin-kpi-link">
              <span>Track Maya &amp; store orders</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-header">
            <span className="admin-kpi-label">Catalog &amp; Promos</span>
            <div className="admin-kpi-icon-wrap" style={{ background: "rgba(217, 119, 6, 0.08)", color: "#D97706" }}>
              <ShoppingBag size={20} />
            </div>
          </div>
          <div className="admin-kpi-value">
            {metrics.loading ? (
              <span className="admin-kpi-skeleton" />
            ) : (
              `${metrics.productsCount ?? "—"} / ${metrics.promosCount ?? "—"}`
            )}
          </div>
          <div className="admin-kpi-footer">
            <Link href="/admin/products" className="admin-kpi-link">
              <span>Products &amp; promotions</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-header">
            <span className="admin-kpi-label">Stories &amp; Reviews</span>
            <div className="admin-kpi-icon-wrap" style={{ background: "rgba(225, 29, 72, 0.08)", color: "#E11D48" }}>
              <Star size={20} />
            </div>
          </div>
          <div className="admin-kpi-value">
            {metrics.loading ? (
              <span className="admin-kpi-skeleton" />
            ) : (
              metrics.pendingTestimonialsCount !== null ? `${metrics.pendingTestimonialsCount} pending` : "—"
            )}
          </div>
          <div className="admin-kpi-footer">
            <Link href="/admin/testimonials" className="admin-kpi-link">
              <span>Review stories queue</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </section>

      {/* Operations Quick Action Cards Grid */}
      <section className="admin-overview-section">
        <div className="admin-overview-section-header">
          <div>
            <h2>CRM Operations &amp; Modules</h2>
            <p>Direct access to operational tools across commerce, partners, and marketing</p>
          </div>
        </div>

        <div className="admin-actions-grid">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className={`admin-action-card ${action.highlight ? "highlighted" : ""}`}
              >
                <div className="admin-action-top">
                  <div className="admin-action-icon" style={{ color: action.color, borderColor: "var(--rule)" }}>
                    <Icon size={22} />
                  </div>
                  {action.badge && (
                    <span className={`admin-action-badge ${action.highlight ? "urgent" : ""}`}>
                      {action.badge}
                    </span>
                  )}
                </div>

                <div className="admin-action-body">
                  <h3 className="admin-action-title">{action.title}</h3>
                  <p className="admin-action-desc">{action.desc}</p>
                </div>

                <div className="admin-action-footer">
                  <span>Open {action.title}</span>
                  <ArrowRight size={15} />
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
