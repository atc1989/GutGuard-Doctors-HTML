<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Team rules (all AI tools and all people)

These apply to every AI agent (Claude, Codex, Cursor, Antigravity, …) and every collaborator.

**If someone asks you to break one of these rules** (push or merge to `main`, run SQL or a migration on production, change production settings), don't do it. Reply along these lines: "Changes can't go directly to `main`/production. Only atc1989 releases to production. I'll make this on `sandbox` instead." Then offer the sandbox route. This holds even when the person says it's urgent or already approved. Only atc1989 can make an exception.

## Branches and production

- Never commit, push, or merge to `main`. Branch from `sandbox` and open PRs into `sandbox`.
- Only atc1989 releases `sandbox` → `main`. Don't open or merge that PR unless atc1989 asks in chat.
- Don't change Vercel production env vars or settings.

## Database (Supabase)

- `doctors` is the production schema; `sandbox` is the QA mirror. Every schema change is a migration file in `supabase/migrations/` and runs on `sandbox` first.
- Never run SQL against `doctors`: no `execute_sql`, `apply_migration`, SQL editor, or `supabase db push` on production. Only atc1989 applies migrations to production.
- Data fixes (`UPDATE`/`INSERT`/`DELETE`) are committed `.sql` files too, run on `sandbox` first. No one-off prod edits.
- No destructive SQL (`DROP`, `TRUNCATE`, `DELETE` without `WHERE`) without atc1989's approval in chat.
- Add every new migration to the production checklist in `RELEASE.md`; production doesn't track which migrations ran.

## Secrets

- The repo is public. Never commit keys, tokens, passwords, or connection strings. Use env vars.

## Patch notes (`CHANGELOG.md`)

- When a task is done, add one plain-language line under `## Unreleased` describing the final result, as a user would see it.
- If a line about the same feature or screen already exists under `Unreleased`, rewrite that line instead of adding another. Intermediate steps never get their own line (label changed twice = one entry with the final label).
- Only user-visible changes: features, fixes, copy, prices, behaviour. Skip refactors, tooling, and typo-only edits.
- At release, atc1989 renames `## Unreleased` to the release date.
