-- 013's write policy had `using (true)` but no explicit `with check` — every
-- insert was rejected ("new row violates row-level security policy") because,
-- in practice here, an unspecified with_check on a FOR ALL policy did not
-- fall back to using as Postgres docs suggest it should. hubspot_contacts'
-- working policy has with_check set explicitly; match that.
drop policy if exists "Service role write hubspot_calls" on public.hubspot_calls;

create policy "Service role write hubspot_calls"
  on public.hubspot_calls for all
  to service_role using (true) with check (true);
