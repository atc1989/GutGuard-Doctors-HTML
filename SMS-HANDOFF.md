# Handoff: order SMS moves to this repo

**Written 2026-11-10 from `C:\Users\najee\Projects\gutguard` (the new unified app), where this
feature was built, tested on Staging, and then halted.** Najee's call: the Doctors system is the
one that is live and taking real orders, so the texts should go out from here, not from an app
that has not cut over yet.

Nothing in this repo has been changed. This document is the whole handover; the code to port
lives in the other repo at the paths given below.

---

## 1. What the feature is

When a customer's shop order is paid, text them as well as email them. That is it.

The provider decision is settled and the account is live — **do not re-research it**:

| | |
|---|---|
| Provider | **Semaphore** (semaphore.co, operator Sombra, Inc.) |
| Price | **PHP 0.56 per credit.** 1 credit per 160 GSM-7 characters, then `ceiling(len/153)` |
| Sender name | **`Gutguard`** — approved 2026-11-07 after a DITO Letter of Authorization and a notarised Secretary's Certificate |
| API | form-encoded `POST https://api.semaphore.co/api/v4/messages`, JSON array back, take `message_id` |
| Numbers | accepts `09XXXXXXXXX` as the shop already stores it. No conversion needed |
| Delivery receipts | **none.** No webhook. Polling only, 30 days of history |
| Credits | expire after 12 months, non-refundable. Account is disconnected after 30 days at zero balance |

Two hard-won constraints that are baked into the code and must stay:

1. **Never put a peso sign in a message.** One non-GSM-7 character turns the whole SMS into UCS-2
   and drops the limit from 160 to 70 — it silently doubles the bill. Write `PHP`.
2. **Never put `https://` in a message.** Semaphore support, 2026-10-20: Smart in particular
   blocks messages containing a link. Smart returns *no failure* for a blocked message, so it
   would log as `sent` and simply never arrive — for roughly half the country. A bare
   `gutguard.ph/...` still linkifies on the phone, and was confirmed delivered on Globe, Smart
   and DITO on 2026-11-09.

---

## 2. Scope here is ONE message — this is the important part

The other repo built six SMS kinds. **Five of them cannot fire on this system**, because the
production `doctors` schema does not have the columns they read. Verified on
`rvwseybgimmewuoccecu` on 2026-11-10:

| Column | `doctors` (live) | `sandbox` (QA mirror) |
|---|---|---|
| `mobile` | present, **38 of 38 orders have one** | present |
| `for_other`, `recipient_mobile` | **absent** | present |
| `renewal_due` | **absent** | **absent** |

So:

| Kind built in the other repo | Here |
|---|---|
| `paid` — payment confirmed | **in scope. Port this one.** |
| gift text to the recipient | no data in `doctors`; testable on `sandbox` only. Port the branch, it stays dormant |
| `renewal_link`, `renewal_due`, `renewal_late3`, `renewal_late7`, `plan_cancelled` | **out of scope.** Gutguard Daily renewal orders do not exist on this system — no `renewal_due` column, no daily job. Do not port them |

Leaving the five renewal kinds out is not a shortcut; porting them would mean porting the whole
Gutguard Daily renewal machinery, which belongs to the cutover, not to this task.

### The message copy has to change

The other repo's `paid` text ends with `{site}/lifestyle?join=shop`. **There is no `/lifestyle`
route in this app** — `grep` finds zero references, and `app/` has no such directory. That link
would 404 on the live site.

Use the order page, which does exist and is already what the receipt email links to:

```
app/(site)/shop/order/[code]/page.tsx   ->   gutguard.ph/shop/order/GG-20261015-D741AEEA
```

Suggested replacement, 118 characters with a real 20-character order code, GSM-7, no scheme:

```
Gutguard: Payment confirmed for order GG-20261015-D741AEEA. Track it here: gutguard.ph/shop/order/GG-20261015-D741AEEA
```

That repeats the code twice and is close to the 160 limit. A shorter alternative at 95:

```
Gutguard: Payment confirmed. Track order GG-20261015-D741AEEA: gutguard.ph/shop/order/GG-20261015-D741AEEA
```

**Ask Najee to approve the final wording before shipping** — he approved the other repo's copy,
not this one, and the brand spelling rule is "Gutguard", capital G only.

---

## 3. What is already in this repo

- `supabase/functions/_shared/` holds **`cors.ts` and `service-auth.ts` only — there is no
  `sms.ts`.** The adapter has to be added.
- `supabase/functions/send-sms-blast/index.ts` (405 lines) has its own **inlined** `SmsProvider`
  type (line 31) and `getSmsProvider()` (line 207) with **an iTexMo adapter and nothing else**.
  That iTexMo account is dead — PHP 600 of credits were bought and never usable, and iTexMo's
  entry tier is now PHP 2,500. So the one SMS adapter in this repo today cannot send anything.
- `supabase/sms-blast.sql` creates `public.sms_campaigns` and `public.sms_sends`, keyed on
  `doctor_id`. That is the **marketing blast to doctors** — unrelated to order texts, different
  table, no send-once index. Do not reuse it.
- `doctors.shop_order_email_sends` exists. **`shop_order_sms_sends` does not.**

### Decide this first: one adapter or two

`send-sms-blast` and the order texts both need a provider. The lazy, correct move is to extract
the inlined provider out of `send-sms-blast/index.ts` into the new `_shared/sms.ts` and have both
import it. Otherwise there are two `getSmsProvider()` implementations in one repo, and the blast
keeps pointing at the dead iTexMo account.

That touches a working function, so it is arguably a second PR. Either way **say which you chose
in the PR description** — silently leaving two copies is how this rots.

---

## 4. Files to port

Source repo: `C:\Users\najee\Projects\gutguard`

| Copy from | To | Notes |
|---|---|---|
| `supabase/functions/_shared/sms.ts` | `supabase/functions/_shared/sms.ts` | Strip the five renewal kinds and `plan_cancelled` from `SmsKind`, `SMS_KINDS` and `orderSmsMessages`. Drop `renewal_due` from `SmsOrder`. Keep `smsLink()`, `formatAmount()`, `firstName()`, the `semaphore` adapter and the `log` adapter |
| `supabase/functions/_shared/sms.test.ts` | same path | 10 assertions: every message under 160 characters, ASCII only, no peso sign, no `http(s)://` while the link survives. Uses a real-shape code `GG-20261019-A3F91C2D` and the longest origin. **Keep it and keep it honest** — it is the only thing standing between a copy edit and a doubled bill |
| the `sendOrderSms` block in `supabase/functions/send-shop-order-email/index.ts` | the same function here | See the differences below |
| `supabase/migrations/20261017020000_shop_order_sms_sends.sql` | **split into two files** — see section 5 | |
| `package.json` test glob (`supabase/functions/**/*.test.ts`) | `package.json` | One word, so the test above actually runs |

### Differences between the two copies of `send-shop-order-email` that will bite

The other repo's copy has drifted a long way from this one. This repo's is 282 lines with
`EmailKind = "saved" | "paid"`; the other is around 380 with eleven kinds, a `siteUrl` request
parameter and gift fields.

1. **Auth.** This repo calls `isServiceRoleRequest(req)` from `_shared/service-auth.ts` and
   returns 403 for any `kind !== "saved"` from a non-service caller. Keep that. It means the
   `paid` text is always service-role-only and you are not adding a new attack surface.
2. **No `siteUrl` parameter here.** The other repo passes one. Here the site is derived from the
   schema — `PROD_SITE_URL` (`SHOP_SITE_URL`, default `https://gutguard.ph`) or
   `SANDBOX_SITE_URL`. Use that derivation; do not add the parameter.
3. **This repo has an extra guard you should keep:**
   `if (kind === "paid" && order.payment_status !== "paid") return 409`. An unpaid order can
   never text.
4. **This repo has a second `paid` trigger the other one does not:**
   `app/api/admin/shop-orders/offline/route.ts:128`, when an admin marks an offline payment
   received. Plus `lib/maya-orders.ts:55` for the Maya webhook. **Two callers means the send-once
   rule matters more here than it did there** — a webhook arriving while staff mark the same
   order paid is a real race, not a theoretical one.
5. **The select list.** This repo's query does not fetch `for_other` / `recipient_mobile` /
   `renewal_due`, and on `doctors` it cannot. If you port the gift branch, add those two columns
   to the select only when `dbSchema === "sandbox"` — do not add columns to the `doctors` select
   that do not exist there, PostgREST errors the whole request.
6. **Order the SMS before the email's duplicate check,** as the other repo does, so a retry whose
   email already went out can still send the text. And push the `sent` result *before* the log
   insert, so a failed insert cannot report a text that did go out as failed.

---

## 5. The migration

The source file loops over `array['doctors', 'sandbox']` and creates the table in both at once.
**That conflicts with this repo's rule that every schema change runs on `sandbox` first.**

Split it, following the precedent already in `supabase/migrations/`
(`20261031000000_order_fulfillment_fields_doctors.sql` / `_sandbox.sql`):

```
supabase/migrations/<ts>_shop_order_sms_sends_sandbox.sql
supabase/migrations/<ts>_shop_order_sms_sends_doctors.sql
```

Each hardcodes its one schema. What the table must keep, all of it load-bearing:

- `order_id`, `mobile`, `kind`, `status`, `provider`, `provider_message_id`, `error_message`,
  `sent_at`; `status in ('sent','failed','skipped')`.
- **`unique index ... on (order_id, kind, mobile) where status = 'sent'`** — the send-once
  backstop for two callers racing. The mobile is part of the key because a gift order texts two
  numbers for one kind.
- `enable row level security` with **no policies** (service role only), **and an explicit
  `revoke all ... from anon, authenticated`.** This is not belt-and-braces: `ALTER DEFAULT
  PRIVILEGES` on these schemas hands every new table to `anon` and `authenticated`, and the
  table holds customer mobile numbers. This was caught and fixed once already in the other repo.
- Its own table, not a row in `shop_order_email_sends` — that table's `email` column is
  `NOT NULL`.

Then **add both files to the production checklist in `RELEASE.md`**; production does not record
which migrations have run.

---

## 6. Secrets (atc1989 only)

Edge Function secrets on `rvwseybgimmewuoccecu`, set in the Supabase dashboard:

| Name | Value |
|---|---|
| `SMS_PROVIDER` | `log` to begin with, then `semaphore` |
| `SEMAPHORE_API_KEY` | from the Semaphore dashboard |
| `SEMAPHORE_SENDER_NAME` | `Gutguard` |
| `SEMAPHORE_ENDPOINT` | optional, defaults to the v4 URL |

Notes:

- **`SMS_PROVIDER` unset means no SMS at all** and the email path behaves exactly as today.
  That is the safe default and it is how this ships until the rest is verified.
- `SMS_PROVIDER=log` writes the message to the function log and reports success **without
  sending anything.** Every log-mode send shouts `SMS_PROVIDER=log: NOT SENT`, because silently
  delivering nothing is precisely what it looks like when someone leaves it switched on.
- Supabase secrets are **write-only** — the dashboard and CLI show a name and a SHA-256 digest,
  never the value. Nobody can read these back, so store the API key somewhere Najee controls.
- The repo is public. These names are fine in code; the values never are.

---

## 7. Test plan

**Use the `sandbox` schema on the production project.** This repo's Staging project
(`fxdsnacuonfvutdquogb`) stopped at 2026-08-13 and has none of this release — `RELEASE.md` says
so explicitly. `sandbox` is the real QA mirror, it has the gift columns, and it has no live
customers.

With `SMS_PROVIDER=log`:

1. Pay a sandbox order through Maya test mode. Expect the response to carry an `sms` field with
   `status: "sent"`, one row in `sandbox.shop_order_sms_sends` with `provider = 'log'`, and the
   `NOT SENT` line in the function log.
2. Invoke the same order and kind again. Expect `duplicate` and **no second row**.
3. A sandbox order with `for_other = true` and a recipient mobile. Expect two rows, two numbers,
   same kind.
4. An order with no mobile. Expect the email to send and the SMS to be skipped, not an error.
5. Unset `SEMAPHORE_API_KEY` with `SMS_PROVIDER=semaphore`. Expect a `failed` row and **the email
   still delivered** — a broken SMS secret must never cost a receipt.

Then switch to `SMS_PROVIDER=semaphore` on `sandbox` and send one real text to Najee's own
number before it is anywhere near `doctors`.

**Before any real run, delete the `provider = 'log'` rows** — the unique index will otherwise
count those orders as already texted.

### What was already proved on the other system

Worth knowing so you do not re-prove it:

- **The whole path works.** On 2026-11-08 at 01:17 UTC the renewal job sent two texts through
  this exact adapter on Staging — two orders, two different numbers, `provider = 'log'`,
  `status = 'sent'`, no errors.
- **The send-once index holds.** A duplicate insert against those live rows was rejected with a
  unique violation and the table stayed at two rows.
- **Links arrive.** The link message was received on Globe, Smart and DITO on 2026-11-09.
- **Not proved anywhere:** the `paid` kind end to end, and the gift branch. Those are exactly
  steps 1-3 above, and they are the reason this is not finished.

---

## 8. Process, from this repo's `AGENTS.md`

- Branch from **`sandbox`**, PR into **`sandbox`**. Never commit, push or merge to `main`.
- **Never run SQL against the `doctors` schema** — no `execute_sql`, no `apply_migration`, no SQL
  editor, no `db push`. Only atc1989 applies anything to production.
- Migrations run on `sandbox` first, and every new one goes in the `RELEASE.md` checklist.
- One plain-language line under `## Unreleased` in `CHANGELOG.md` when it is done — what a
  customer would notice. Something like: *"Order confirmations now also arrive by SMS."*
- The repo is public. No keys, ever.

---

## 9. Open questions for Najee

1. **Approve the new `paid` copy** (section 2) — the other repo's wording links to a page this
   app does not have.
2. **Is PHP 0.56 VAT-inclusive?** Never confirmed with Semaphore. At 38 orders it is noise; it
   matters when the volume does.
3. **A shipped/delivered text?** Not built. This repo has fulfilment fields
   (`20261031000000_order_fulfillment_fields_*`) and the other repo's flow prototype promises a
   shipping notice, but no system sends one. Separate task if wanted.
4. **Checkout OTP?** Semaphore has an OTP route at 2 credits. Out of scope here, still unplanned.
5. **One adapter or two** (section 3) — whether this PR also rescues `send-sms-blast` from the
   dead iTexMo adapter.

---

## 10. State of the other repo

Nothing needs undoing there. The adapter is merged and deployed to Staging with
`SMS_PROVIDER=log`, which sends nothing. It is dormant, not live.

One thing to be aware of: **if anyone ever sets `SMS_PROVIDER=semaphore` on the Staging project,
that app starts sending real texts and spending real credits** against the same Semaphore
account. Leave it on `log`.

Also noted while investigating, unrelated to SMS: `.env.local` in the other repo holds a **legacy
service-role JWT, and that project now rejects legacy JWTs** (`401 UNAUTHORIZED_LEGACY_JWT`).
Local development against Staging with the service role is broken there until that key is
replaced with the current `sb_secret_...` key.
