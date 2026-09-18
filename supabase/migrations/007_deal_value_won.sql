-- Fix: a contact with multiple HubSpot deals stored a single deal_stage
-- (whichever deal the sync happened to process last) but a summed deal_value
-- across ALL deals. When the last-processed deal wasn't the closed-won one,
-- ROAS Real silently excluded that contact's already-closed revenue.
--
-- deal_value_won stores the sum of only the closedwon deals, computed
-- independently of iteration order (see lib/hubspot/client.ts). ROAS Real
-- now reads this column directly instead of filtering meta_ads_conversions
-- joins by deal_stage = 'closedwon'.
alter table public.hubspot_contacts
  add column if not exists deal_value_won numeric(10,2);

-- Backfill: without this, every existing contact's deal_value_won is null
-- until the enrich cron re-syncs it (up to 7 days, 50/day) — ROAS Real would
-- drop to ~zero in the meantime. This approximates the old behavior (all of
-- deal_value counted as won whenever the last-synced stage was closedwon) as
-- a floor; the next natural re-sync corrects multi-deal contacts properly.
update public.hubspot_contacts
set deal_value_won = deal_value
where deal_stage = 'closedwon' and deal_value_won is null;

-- ── Dashboard: deal totals now source won value from deal_value_won ────────
drop function if exists public.fn_dashboard_deal_totals(text, date, date);

create or replace function public.fn_dashboard_deal_totals(
  p_phone_company text,
  p_since date,
  p_until date
)
returns table (
  total_deal_value numeric,
  won_deal_value numeric,
  deal_count bigint,
  won_count bigint
)
language sql
stable
as $$
  with phones as (
    select distinct phone_client
    from public.fn_conversions_deduped(p_phone_company, p_since, p_until)
    where phone_client is not null
  )
  select
    coalesce(sum(hc.deal_value), 0) as total_deal_value,
    coalesce(sum(hc.deal_value_won), 0) as won_deal_value,
    count(*) filter (where hc.deal_stage is not null) as deal_count,
    count(*) filter (where hc.deal_value_won is not null) as won_count
  from phones p
  join public.hubspot_contacts hc on hc.phone = p.phone_client
$$;

grant execute on function public.fn_dashboard_deal_totals(text, date, date) to authenticated, service_role;

-- ── Campaigns page: phone touches now carry both totals directly ───────────
drop function if exists public.fn_conversion_phone_touches(text, date, date);

create or replace function public.fn_conversion_phone_touches(
  p_phone_company text,
  p_since date,
  p_until date
)
returns table (
  campaign_id text,
  adset_id text,
  ads_id text,
  phone_client text,
  deal_value numeric,
  deal_value_won numeric
)
language sql
stable
as $$
  select distinct
    d.campaign_id,
    d.adset_id,
    d.ads_id,
    d.phone_client,
    hc.deal_value,
    hc.deal_value_won
  from public.fn_conversions_deduped(p_phone_company, p_since, p_until) d
  join public.hubspot_contacts hc on hc.phone = d.phone_client
  where d.campaign_id is not null and d.phone_client is not null
$$;

grant execute on function public.fn_conversion_phone_touches(text, date, date) to authenticated, service_role;
