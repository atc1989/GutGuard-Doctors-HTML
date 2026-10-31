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
| `ADMIN_PASSWORD` | set, and equal to `doctors.wheel_admin_settings.admin_password`. Unset = nobody can log in to `/admin` (no fallback any more). Since staff accounts, the login asks for a username: the super admin types `admin` with this password. |
| `ADMIN_SESSION_SECRET` | optional, long random string (signs admin cookies instead of the password) |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | set — without them OTP / admin-login rate limits and admin logout revocation are off |
| `MAYA_API_BASE` | `https://pg.paymaya.com` with the **live** keys (sandbox base = test cards mark real orders paid) |
| `NEXT_PUBLIC_SHOP_DB_SCHEMA` | `doctors` |
| `NEXT_PUBLIC_SITE_URL` | `https://partners.gutguard.ph` (QR codes are printed from it) |
| `SUPABASE_SERVICE_ROLE_KEY` | any valid service key for the project (legacy service_role JWT or `sb_secret_` key). The edge functions verify it with Supabase Auth (`_shared/service-auth.ts`), so it no longer has to match the key injected into the functions byte-for-byte; before that fix a mismatch made paid receipts and admin actions fail |

Maya's webhook URL must use the custom domain: `proxy.ts` answers every `*.vercel.app`
request with a 308 redirect.

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

### Later migrations

#### Payment recovery rollout (not deployed)

1. Apply only the `sandbox.shop_orders` statement in `20261027052931_payment_recovery.sql` to QA first. It adds nullable `maya_checkout_url`; no data rewrite. Only atc1989 applies the `doctors.shop_orders` statement for production, before deploying the app.
2. Redeploy `send-shop-order-email` before the app: it verifies paid status, checks delivery-log errors, and supplies Resend's per-order/schema/kind idempotency key. Existing sent logs continue to prevent repeats. Resend's additional concurrency protection lasts 24 hours; if an email was accepted but logging fails for over 24 hours, check provider delivery before retrying manually.
3. Deploy the app from sandbox and test two simultaneous Pay requests, pending-session resume, success with delayed webhook, failed-save recovery by reference, and receipt failure followed by webhook/reconcile retry. No tests should use production keys or write production orders.
4. An uncertain Create Checkout response stays reserved: reconciliation looks it up by its saved request reference. A missing/ambiguous Maya result does **not** permit another charge; support must inspect Maya before resolving the order. Legacy active sessions without a saved URL cannot be resumed automatically; wait for a confirmed terminal failure/expiry. Do not reset attempts or references to bypass this protection.

| Migration | Production status |
|---|---|
| `20261102000000_partner_code_label.sql` | **Looks applied on production** (2026-11-01: `get_partner_invitation` already returns `code_label`). Not confirmed: whether the 4-arg `admin_create_pending_partner` is live; check with `pg_get_functiondef` and run only the missing part. Do not re-run the whole file: it drops only the 3-arg version, so `create function` fails if the 4-arg one exists. `doctors` only (partners have no sandbox copy). Adds `code_label` (public label, max 40 chars) to `doctor_registrations`; `admin_create_pending_partner` takes it as an optional 4th param `p_label` (the 3-arg version is dropped; callers without a label still match), and `get_partner_invitation` returns it (DROP + recreate, anon grant re-added). Diff both functions against `pg_get_functiondef` first. `admin_list_doctor_registrations` / `admin_update_doctor_registration` are not changed (to avoid clashing with `20261029100000`): the app reads and writes `code_label` (and edits `code_note` / `code_source` from Doctor partners) straight on the table with the service-role client. Safe in either order with the app: before it runs, the join page shows just the number, labels read as empty, and creating or editing with a label saves everything except the label and tells the admin. |
| `20261101000000_admin_staff_doctors.sql` (production) / `20261101000000_admin_staff_sandbox.sql` (QA) | **Not applied yet.** Two separate files, one per schema: run the sandbox file first. Creates `admin_staff` (username, scrypt password hash, ticked sections, on/off), RLS on, service_role only. Additive and re-runnable, no DROP. Apply **before** deploying staff accounts: without it the super admin login still works but Admin → Staff Accounts errors and no staff can log in. The deploy signs every admin out once (new cookie format). |
| `20261031000000_order_fulfillment_fields_doctors.sql` (production) / `20261031000000_order_fulfillment_fields_sandbox.sql` (QA) | **Not applied on production yet.** Two separate files, one per schema: run the sandbox file first. Adds to `shop_orders`: `order_time`, `pof_time`, `tracking_number`, `pickup_time`, `tracking_status` (checked list), `bot_message`, `salesperson`, and `sales_channel` (`online` default / `store`, check). Marks existing consignment/cash orders `store`. Additive and re-runnable, no DROP. Apply **before** deploying: without it, Admin → Add order and editing the fulfilment fields in an order fail with a missing-column error (plain status saves keep working). |
| `20261030000000_partner_wallet.sql` | **Already applied** on 2026-10-27, both `doctors` and `sandbox` — do not re-run. New `partner_withdrawals` table (RLS on, no direct access) and RPCs: `partner_wallet`, `request_partner_withdrawal` (authenticated) and `admin_list_partner_withdrawals`, `admin_process_partner_withdrawal` (service_role). Balances come from `milestone_unlocks`, which nothing writes yet, so every production balance is ₱0 until rebate crediting is built. |
| `20261029200000_drop_tiktok_columns.sql` | **Not applied yet. Destructive, run last.** Deletes `tiktok_username`, `redirect_url`, `task_tiktok_followed`, `task_reel_created` from `doctors.doctor_registrations` and the `doctors.tiktok_credentials` table (anon had full grants on it). Drops the TikTok params from `register_doctor` / `admin_update_doctor_registration` and the unused `sandbox.register_doctor`. Run only after `20261029100000` is applied, main is released with the TikTok removal, and the edge functions below are redeployed with `tiktok-shop-admin` deleted. Otherwise registrations and admin edits fail. Rolls back on its own and names the function if anything still reads those columns. |
| `20261029100000_stop_using_tiktok.sql` | **Not applied yet.** Run before deploying the TikTok removal (sandbox first; it changes the shared `doctors.*` functions, so production too). Recreates `register_doctor`, `admin_list_doctor_registrations` and `admin_update_doctor_registration` so they no longer read or write TikTok columns. The TikTok params are kept but ignored, so the current production app keeps working. Drops `get_doctor_redirect` (/dr links) and `update_doctor_task`. `register_doctor` has drifted (baseline: 8 params, repo: 9), so compare `select pg_get_functiondef('doctors.register_doctor'::regproc);` with the file first. Rolls back on its own if any `doctors`/`sandbox` function still uses TikTok data. Not run locally (no Postgres here). |
| `20261028000000_partner_code_note_source.sql` | **Already applied** on 2026-10-27 by atc1989 — do not re-run. `doctors` only (partners have no `sandbox` copy). Adds `code_note` and `code_source` to `doctor_registrations`; `admin_create_pending_partner` takes them as optional params (the one-arg version is dropped, old callers still match), and `admin_list_doctor_registrations` / `get_partner_invitation` return them (DROP + recreate for the new return columns). Safe in either order with the app: until it runs, Partner Codes works but only without a description or source. |
| `20261027000000_offline_payment_methods.sql` | **Optional, no longer needed by the app.** Consignment/Cash moved from shop checkout to Admin → Orders → Add order, which creates the order and marks it paid in one step, so it works with or without this file. If applied, `create_shop_order` rejects payment methods other than `maya` / `consignment` / `cash`. Replaces `create_shop_order` in `doctors` and `sandbox` in one file (same signature, no DROP): run the `doctors` and `sandbox` halves separately. |
| `20261026000000_admin_transfer_store.sql` | **Already applied** on 2026-10-24 by atc1989 — do not re-run. Adds the admin RPCs for transferring an Affiliate store to a new upline (`doctors.admin_transfer_store`, which moves past pass-up points in both schemas) and for listing and assigning unclaimed pass-up points (`admin_list_unclaimed_passup` / `admin_assign_unclaimed_passup` in `doctors` and `sandbox`). Additive, service_role only. |
| `20261025000000_partner_invitation_can_refer.sql` | **Already applied** on 2026-10-24 by atc1989 — do not re-run. Adds `can_refer` to `doctors.get_partner_invitation` (the shop uses it to show "Become a partner" instead of Log in). Additive; both deployments read it. |
| `20261024010000_sandbox_partner_dashboard_code.sql` | `sandbox` schema only (the QA mirror): adds `partner_code` to `sandbox.partner_dashboard` so the sandbox share page shows `/s/` and `/j/` links. Nothing in `doctors`; harmless to run any time. |
| `20261024000000_partner_codes.sql` | **Already applied** on 2026-10-24 by atc1989 — do not re-run. Adds `partner_code` (sequential, 10001+) and the `/s/<code>`, `/j/<code>` and `/admin/codes` functions. Additive; the live code ignores it. |

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
for f in send-newsletter send-partner-referral-notification send-shop-order-email send-sms-blast admin-impersonate; do supabase functions deploy $f; done
for f in send-proposal manage-sequence track-sequence-click send-sequence-step registration-email-settings auth-send-email; do supabase functions deploy $f --no-verify-jwt; done
# TikTok Shop sync is gone: remove the function and its secrets.
supabase functions delete tiktok-shop-admin
supabase secrets unset TIKTOK_SHOP_BASE_URL TIKTOK_SHOP_AUTH_BASE_URL TIKTOK_SHOP_API_VERSION TIKTOK_SHOP_APP_KEY TIKTOK_SHOP_APP_SECRET TIKTOK_SHOP_SHOP_CIPHER
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
