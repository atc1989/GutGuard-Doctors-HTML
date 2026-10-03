# Addendum 05 database scripts

For `supabase/migrations/20261002000000_prototype_shop.sql`. Full steps: Addendum 05, Part B.

- `check.sql`: run after each step. Change `doctors` to `sandbox` on line 3 to check the mirror.
- `rollback.sql`: undo, together with promoting the previous Vercel Production deployment.

Order on the website's Supabase project:

1. `set addendum05.schemas = 'sandbox';` + the migration → test on sandbox.gutguard.ph.
2. `set addendum05.schemas = 'doctors'; set addendum05.step = 'prepare';` + the migration → the old live shop still works.
3. Deploy the new website to Production.
4. The migration again with no settings → closes `create_shop_order` to the browser. `check.sql` must be all `true`.
