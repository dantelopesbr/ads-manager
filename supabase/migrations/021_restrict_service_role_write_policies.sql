-- Discovered via direct Postgres inspection (pg_policies) while investigating
-- the hubspot_calls RLS finding: hubspot_contacts, meta_insights and sync_logs
-- all have their write policy live as `to public`, despite migration
-- 001_create_tables.sql defining them `to service_role` — someone changed
-- these directly via the SQL editor at some point (same era as 014-016's
-- hubspot_calls saga) without ever committing a migration for it, so the
-- checked-in schema has been silently out of sync with production. All three
-- were writable by anyone holding the anon key (public by nature).
--
-- Safe to restrict now: lib/supabase/server.ts's createServiceClient() has
-- been fixed to genuinely authenticate as service_role (which bypasses RLS
-- outright), so this app's own writes never depended on `public` matching.
drop policy if exists "Service role write hubspot_contacts" on public.hubspot_contacts;
create policy "Service role write hubspot_contacts"
  on public.hubspot_contacts for all
  to service_role using (true) with check (true);

drop policy if exists "Service role write meta_insights" on public.meta_insights;
create policy "Service role write meta_insights"
  on public.meta_insights for all
  to service_role using (true) with check (true);

drop policy if exists "Service role write sync_logs" on public.sync_logs;
create policy "Service role write sync_logs"
  on public.sync_logs for all
  to service_role using (true) with check (true);
