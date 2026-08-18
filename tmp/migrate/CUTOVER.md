# Doctors → GutGuard LifeStyle cutover checklist

Target project: `rvwseybgimmewuoccecu` (https://rvwseybgimmewuoccecu.supabase.co)

## Done in DB
- [x] Schemas `doctors` + `sandbox` with tables, FKs, indexes, RLS, grants
- [x] 40 RPCs + 5 triggers
- [x] Data copied (counts match source)
- [x] Storage bucket `registration-email-assets` created (0 objects on source)
- [x] Auth: 5 users migrated with same UUIDs/password hashes; `jndlonsod@gmail.com` already existed on LifeStyle (kept existing UUID)

## Cutover status
1. [x] Exposed schemas: `public, gema, doctors, sandbox`
2. [x] Edge secrets: Resend, TikTok, from-addresses, site URLs
3. [ ] Local/Vercel `SUPABASE_SERVICE_ROLE_KEY` for LifeStyle (if Maya/admin server routes needed)
4. [ ] Smoke tests pass → then pause/delete old project `fxdsnacuonfvutdquogb`

## App code already updated
- `lib/supabase.ts` / `lib/supabase-admin.ts` → `doctors` default schema
- `.env.local` URL + anon key pointed at LifeStyle
- Edge functions patched with `{ db: { schema: "doctors" } }`
