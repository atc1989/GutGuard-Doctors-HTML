-- partner_dashboard() was reachable with the anon key: Postgres grants EXECUTE to PUBLIC on
-- every new function, and Supabase's default privileges in `public` add anon. The function
-- already refuses a caller with no JWT email, so this closes the door rather than fixing a
-- leak - but an unauthenticated key should not reach the body at all.
revoke all on function public.partner_dashboard() from public, anon;
grant execute on function public.partner_dashboard() to authenticated;

revoke all on function sandbox.partner_dashboard() from public, anon;
grant execute on function sandbox.partner_dashboard() to authenticated;
