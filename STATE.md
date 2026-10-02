# Current Task State

## 🎯 Goal
- [ ] Implement 3-tier store hierarchy (Main -> Lifestyle -> Affiliate) with breakaway upgrade

## 🛠️ Decisions & Architecture
- Registrations start as Affiliate (Referral QR off); 1st paid shop sale auto-promotes to Lifestyle.
- Admin upgrades Lifestyle -> Main Store (breakaway: severs parent pass-up, takes downline).
- Main Store has combined 1,500 rebate track (own sales + direct children pass-up) & aggregate reports.
- Migration `20261002000000_store_hierarchy.sql`, admin APIs & full partner/main frontend implemented.

## 📌 Active / Next Steps
- [x] **Phase 1: Database Foundation** (Migration, RPCs, Triggers, Server APIs)
- [x] **Phase 2: Affiliate, Main Store & Admin Frontend UI**
  - [x] Locked Referral QR for affiliates in `SharePage.tsx`
  - [x] Added Affiliate promotion banner in `OverviewPage.tsx`
  - [x] Added Main Store dashboard views (`MainStoreOverview.tsx`, `MainStoreReports.tsx`, `MainStoreEPoints.tsx`)
  - [x] Updated Admin Doctors tab with Breakaway Upgrade Modal, QR toggles, and filters
- [ ] **Phase 3: Sandbox Verification & QA**
