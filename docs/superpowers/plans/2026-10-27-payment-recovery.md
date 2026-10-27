# Payment recovery implementation plan

Goal: prevent another charge while a previous Maya attempt is unresolved, persist recovery information before redirecting, and retry failed paid receipts.

Scope: checkout, payment state updates, reconciliation, order page, and receipt edge function. Work on a branch from sandbox; no production database or settings changes.

Design: use an atomic conditional update of existing order fields to reserve each attempt before the external request. Persist its reference before contacting Maya and its checkout ID and URL before redirecting. Verify existing attempts with Maya; reuse pending sessions and refuse unknown or processing outcomes. Recover uncertain creation by reference. Conditional payment writes retry against fresh state, preserve fulfilment and paid timestamps, and ignore stale failed attempts. Paid receipt errors propagate for webhook retries, including duplicate success notifications. Order visits can reconcile and retry missing receipts. Provider idempotency plus the existing sent log protects email retries.

- [x] Add regression tests demonstrating concurrent starts, uncertain creation, failed saves, stale payment writes, and receipt retry failures.
- [x] Add the nullable checkout URL column migration (sandbox first), document deployment order in RELEASE.md.
- [x] Implement checkout reservation/reuse/recovery and verified saves; run regressions.
- [x] Implement conditional payment transitions, receipt retry propagation and edge-function idempotency; run regressions.
- [x] Reconcile on order visits and retain payment checks for paid orders; run full tests, types, lint, build, and review the final diff.

Verification: initial 11 payment regression cases and 4 email cases failed on the old code; all now pass. Additional edge cases cover replacement concurrency, refunds, repeated successes, webhook receipt retry, and settlement during checkout creation (observed failing before the fix). Existing tests and type checking pass; production build passes with network access for the existing Google font. Changed application files pass ESLint; full lint has an unrelated existing Admin Wheel use-before-declaration error. Independent code review found no actionable issues. No migration, edge deployment, or real Maya charge has been performed; database/provider integration remains a sandbox rollout check.

Review focus: Maya unavailable or 404 must not authorize another session; overlapping server instances must share the database fence; successful payment must not regress or reset fulfilment; failed email must not undo payment; no redirect when persistence fails. Unknown creation stays blocked for manual investigation rather than allowing a speculative retry.
