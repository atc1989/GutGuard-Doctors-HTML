# Release: sandbox → main (store hierarchy, partner portal, e-points)

Production database = Supabase project **GutGuard Life Style** (`rvwseybgimmewuoccecu`).
The repo is still linked to **GutGuard Staging** (`fxdsnacuonfvutdquogb`), which stopped at
2026-08-13 and has none of this release — do not use it to judge production.

Neither project records these migrations in `supabase_migrations`; everything since 2026-08-27
was pasted into the SQL editor. **Never run `supabase db push` against production until step 3
is done** — it would re-run every file, including the store-hierarchy backfill.

## 1. Before anything (Vercel → Production env)

| Variable | Must be |
|---|---|
| `ADMIN_PASSWORD` | set, and equal to `doctors.wheel_admin_settings.admin_password`. Unset = nobody can log in to `/admin` (no fallback any more). |
| `ADMIN_SESSION_SECRET` | optional, long random string (signs admin cookies instead of the password) |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | set — without them OTP / admin-login rate limits and admin logout revocation are off |
| `MAYA_API_BASE` | `https://pg.paymaya.com` with the **live** keys (sandbox base = test cards mark real orders paid) |
| `NEXT_PUBLIC_SHOP_DB_SCHEMA` | `doctors` |
| `NEXT_PUBLIC_SITE_URL` | `https://partners.gutguard.ph` (QR codes are printed from it) |

Take a database backup (Supabase → Database → Backups).

## 2. Database (SQL editor on GutGuard Life Style), in this order, in one session

1. `supabase/migrations/20261007000000_add_doctor_where_did_you_find_us.sql`
2. `supabase/migrations/20261008000000_release_reconciliation.sql`

Both are idempotent and backward compatible with the code that is live now, so they go
**before** the deploy. What they change on production:

- `assert_wheel_admin` is no longer callable with the public anon key (it is today).
- Registration stores "Where did you find us" (dropped since 2026-10-07) and stays
  hierarchy-aware; the original 20261007 body would have failed every sign-up on the live
  `chk_non_main_must_have_parent` check and re-opened the admin doctor list to anon.
- Main Store dashboard/reports stop reading `public.shop_orders` (does not exist → 42P01).
- Points are taken back on refund/failure; a points error can no longer roll back a payment;
  sandbox payments no longer promote production partners.
- "Upgrade to Main" works for partners who have a referrer.

Verify locally first: `bash supabase/release-reconciliation.test.sh` (needs Docker, or
`PSQL="psql ..."` pointing at any Postgres 16). It loads `supabase/baseline/` — the live
`doctors`/`sandbox` structure captured 2026-10-08 — applies both files twice and runs the checks.

## 3. Make the CLI match production

```bash
supabase link --project-ref rvwseybgimmewuoccecu
supabase migration repair --status applied $(ls supabase/migrations | cut -d_ -f1 | tr '\n' ' ')
supabase migration list   # local and remote columns should now match
```

## 4. Deploy

Merge the release PR into `main` (Vercel deploys). Then redeploy the edge functions — the new
code restricts CORS to the site origins and requires the service-role bearer on admin
functions; the new app already sends it, and the old functions keep working until redeployed.
Keep each function's current JWT setting:

```bash
for f in send-newsletter send-partner-referral-notification send-shop-order-email send-sms-blast tiktok-shop-admin admin-impersonate; do supabase functions deploy $f; done
for f in send-proposal manage-sequence track-sequence-click send-sequence-step registration-email-settings auth-send-email; do supabase functions deploy $f --no-verify-jwt; done
```

## 5. Remove sandbox test data from production

`supabase/cleanup/20261008_remove_sandbox_test_data.sql` — run as is (ends in ROLLBACK), read
the output, then change the last line to `COMMIT` and run again. As of 2026-10-08 it deletes
46 `SBX-*` orders and the 401 points they awarded (7 real points remain), one ₱18,000 rebate
row with no real points behind it, and returns 5 partners whose only "first sale" was a test
order to affiliate. Check that list of names before committing.

## 6. Smoke test on production

- Register a doctor via `gutguard.ph/<partner-slug>`: lands under that partner, "Where did you
  find us" shows in /admin.
- Partner login → E-Points, Partners, Share pages load; a Main Store account sees Main Store
  Overview/Reports without errors.
- /admin: doctor list shows store types; "Upgrade to Main" on a referred lifestyle partner.
- One real Maya payment through a partner link: order paid, points appear for partner and upline.

## Open business decisions (not code bugs)

- **Points rule.** Live: 1 pt per ₱1,000 of order total (incl. shipping), full copy to the
  upline. `public/02_LCA_Compensation_Program.pdf` defines rebates on ₱ sales within a 90-day
  pilot (₱300k/₱700k/₱1.5M → ₱18k/₱52k/₱230k); the portal shows 300/750/1,500 pts →
  ₱18k/₱70k/₱150k. Production also has an unused `doctors.calculate_order_points` (caps/10)
  that is not in the repo. Pick one.
- **Rebates are never recorded.** Nothing writes `milestone_unlocks`; the portal now says
  "Milestone reached" instead of "Unlocked". Decide whether reaching a milestone should create
  a rebate row automatically or stay an admin action.
- **Affiliate referral QR lock** is display-only: 242 partners were set to affiliate (QR hidden)
  by the backfill, but links they already shared still register referrals.
- **"new atc"** is a Main Store with 4 partners under it — confirm it is meant to be.
- **Sandbox is not isolated**: it shares production partners and the production admin. Give
  it its own Supabase project before relying on it for QA again.
- Unknown edge function `zz-prod-demo-provision` is deployed on production and not in the repo.
