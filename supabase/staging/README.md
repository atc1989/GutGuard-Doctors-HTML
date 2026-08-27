# GutGuard Staging (second Supabase project)

This is **not production**. Production stays on GutGuard Life Style (`rvwseybgimmewuoccecu`).

Staging is the old **GutGuard Doctors** project (`fxdsnacuonfvutdquogb`). Optional: rename it in the Supabase dashboard to **GutGuard Staging**. The name does not change URLs or keys.

## What was rebuilt

| Schema | Status |
|---|---|
| `doctors` | Existing shop/partner tables moved here from `public`. Core RPCs (`register_doctor`, `create_shop_order`, `partner_dashboard`, admin list/update) recreated to match Lifestyle. |
| `gema` | Empty copy of Lifestyle table layout, RLS, helper functions, and seed ranks. No production GEMA members/prospects (those stay on Lifestyle). Auth users are this project's own Auth, not Lifestyle's. |
| `sandbox` | Unchanged. sandbox.gutguard.ph can keep using this project. |

API exposed schemas: `public`, `graphql_public`, `doctors`, `gema`, `sandbox`.

## How to connect apps

Same pattern as production: project URL + keys + schema name. Use **Vercel Preview** (or a `staging.*` host), never shop.gutguard.ph / partners.gutguard.ph.

Staging keys: [Project Settings → API](https://supabase.com/dashboard/project/fxdsnacuonfvutdquogb/settings/api)

| Variable | Staging value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://fxdsnacuonfvutdquogb.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Staging `anon` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Staging `service_role` key |
| `NEXT_PUBLIC_SHOP_DB_SCHEMA` | `doctors` |
| GEMA schema (in the GEMA app) | `gema` |

If Preview is also used for sandbox.gutguard.ph, restrict these staging vars to a Git branch (for example `staging`) so the `sandbox` branch keeps `NEXT_PUBLIC_SHOP_DB_SCHEMA=sandbox`.

## What this project is for

- Doctors app experiments
- GEMA experiments
- New systems, while testing (give them their own schema here, then the same schema name on Lifestyle when live)

## What is still Lifestyle-only

- Live shop / partners / GEMA traffic
- GEMA production data and some GEMA write RPCs (`onboard_member`, event registration, etc.) — copy those from Lifestyle when you start testing GEMA writes on staging
- Do not pause or delete this project
