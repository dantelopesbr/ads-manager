-- Per-account KPI targets (CPL max, ROAS min), editable from Settings.
-- Users (not just the service role) need to write here, since this is a
-- preference set from the UI, not something a sync job populates.
create table if not exists public.account_targets (
  account text primary key,
  cpl_target numeric(10,2),
  roas_target numeric(4,2),
  updated_at timestamptz not null default now()
);

alter table public.account_targets enable row level security;

create policy "Authenticated read account_targets"
  on public.account_targets for select
  to authenticated using (true);

create policy "Authenticated write account_targets"
  on public.account_targets for all
  to authenticated using (true) with check (true);

create policy "Service role write account_targets"
  on public.account_targets for all
  to service_role using (true);
