# Current Task State

## 🎯 Goal
- [x] Registration "Where did you find us" + admin origin (direct vs referred) — from main
- [x] 3-tier store hierarchy (Main -> Lifestyle -> Affiliate) with breakaway upgrade — from sandbox
- [ ] Release sandbox to main: see `RELEASE.md` for DB steps that must run before deploy

## ⛔ Constraints & Rules
- Follow `.antigravity/rules.md` | Under 20 lines
- Prod DB = Supabase "GutGuard Life Style"; `doctors` = prod schema, `sandbox` = QA mirror (shares partners)

## 🛠️ Decisions & Architecture
- Registrations start as Affiliate (Referral QR off); 1st paid sale auto-promotes to Lifestyle.
- Admin upgrades Lifestyle -> Main Store (breakaway). Main Store has combined 1,500-pt rebate track.

## 📌 Pending Actions / Next Steps
- [ ] Apply `20261007`/`20261008` migrations, then deploy; run test-data cleanup after review
