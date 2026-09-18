-- Each calls-sync run was restarting the HubSpot search from page 1 (most
-- recent calls) every time, since no run ever finished the 30-day window
-- within its time budget and nothing remembered where it left off — so
-- older calls were never reached no matter how many times sync ran.
-- Single-row cursor table: persists HubSpot's pagination `after` token
-- between runs. Cleared once a full pass reaches the end of the lookback
-- window, so the next run starts fresh at the top again (catches new calls).
create table if not exists public.hubspot_calls_sync_state (
  id int primary key default 1,
  after_cursor text,
  updated_at timestamptz not null default now(),
  constraint hubspot_calls_sync_state_single_row check (id = 1)
);

insert into public.hubspot_calls_sync_state (id, after_cursor)
values (1, null)
on conflict (id) do nothing;

alter table public.hubspot_calls_sync_state enable row level security;

create policy "Authenticated read hubspot_calls_sync_state"
  on public.hubspot_calls_sync_state for select
  to authenticated using (true);

-- `to public` (not `to service_role`) — matches 015's working fix for
-- hubspot_calls; a service_role-scoped policy was mysteriously rejecting
-- writes from this app's service client in this project.
create policy "Public write hubspot_calls_sync_state"
  on public.hubspot_calls_sync_state for all
  to public using (true) with check (true);
