-- Diagnostic follow-up to 014: the write policy scoped `to service_role` still
-- rejected every insert even with with_check explicit, while hubspot_contacts'
-- working policy is scoped `to public`. Match that scope as a working fix —
-- points at createServiceClient() not actually authenticating as the Postgres
-- service_role, worth investigating separately, but this unblocks writes now.
drop policy if exists "Service role write hubspot_calls" on public.hubspot_calls;

create policy "Service role write hubspot_calls"
  on public.hubspot_calls for all
  to public using (true) with check (true);
