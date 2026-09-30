-- Admin RPCs are only ever called by the /api/admin routes and edge functions, both of
-- which use the service role. Until now they were also executable with the public anon key,
-- so the shared admin password was the only barrier and it could be guessed directly
-- against PostgREST, bypassing the login rate limit.
--
-- Postgres grants EXECUTE to PUBLIC by default, so anon must be revoked via PUBLIC too.
-- Deploy the code that switched /api/admin to the service role BEFORE applying this.
do $$
declare
  fn record;
begin
  for fn in
    select n.nspname as schema_name, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('doctors', 'public', 'sandbox')
      and (p.proname like 'admin\_%' or p.proname = 'assert_wheel_admin')
  loop
    execute format('revoke all on function %I.%I(%s) from public, anon, authenticated',
                   fn.schema_name, fn.proname, fn.args);
    execute format('grant execute on function %I.%I(%s) to service_role',
                   fn.schema_name, fn.proname, fn.args);
  end loop;
end $$;
