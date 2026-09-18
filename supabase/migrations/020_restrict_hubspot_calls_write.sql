-- Migrations 015/016 loosened these write policies to `to public` as a
-- workaround for createServiceClient() never actually authenticating as
-- Postgres's service_role (it was built on @supabase/ssr's createServerClient,
-- which propagates an end user's session cookie over the service key). That
-- left both tables writable — insert/update/delete — by anyone holding the
-- anon key, which is public by nature (embedded in every client bundle).
--
-- lib/supabase/server.ts's createServiceClient() has been fixed to use a
-- plain, cookie-free client, which authenticates as the real service_role
-- and bypasses RLS outright — so this app's own writes don't depend on
-- these policies matching `public` (or even existing) at all. Safe to
-- restrict back to service_role now.
drop policy if exists "Service role write hubspot_calls" on public.hubspot_calls;
create policy "Service role write hubspot_calls"
  on public.hubspot_calls for all
  to service_role using (true) with check (true);

drop policy if exists "Public write hubspot_calls_sync_state" on public.hubspot_calls_sync_state;
create policy "Service role write hubspot_calls_sync_state"
  on public.hubspot_calls_sync_state for all
  to service_role using (true) with check (true);
