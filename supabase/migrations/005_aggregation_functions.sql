-- Aggregation functions: push spend/leads/deal-value aggregation into Postgres
-- instead of paginating full tables into the Next.js server and reducing in JS.
-- Replaces the fetch-all-rows-then-reduce pattern in dashboard/campaigns/alerts.

-- ── Dedup helper ─────────────────────────────────────────────────────────────
-- Mirrors lib/conversions.ts dedupeByClickId: when a lead is recategorized, a
-- new row is inserted with the same click_id — keep only the most recent row
-- per click_id. Rows with a null click_id are never considered duplicates.
create or replace function public.fn_conversions_deduped(
  p_phone_company text,
  p_since date,
  p_until date
)
returns setof public.meta_ads_conversions
language sql
stable
as $$
  (
    select distinct on (click_id) *
    from public.meta_ads_conversions
    where phone_company = p_phone_company
      and click_id is not null
      and created_at::date between p_since and p_until
    order by click_id, created_at desc
  )
  union all
  (
    select *
    from public.meta_ads_conversions
    where phone_company = p_phone_company
      and click_id is null
      and created_at::date between p_since and p_until
  )
$$;

-- ── Dashboard: daily spend series ───────────────────────────────────────────
create or replace function public.fn_insights_daily(
  p_account text,
  p_since date,
  p_until date
)
returns table (date date, spend numeric)
language sql
stable
as $$
  select date, sum(spend) as spend
  from public.meta_insights
  where account = p_account
    and date between p_since and p_until
  group by date
  order by date
$$;

-- ── Dashboard: daily lead count (post-dedup) ────────────────────────────────
create or replace function public.fn_conversions_daily(
  p_phone_company text,
  p_since date,
  p_until date
)
returns table (day date, leads bigint)
language sql
stable
as $$
  select created_at::date as day, count(*) as leads
  from public.fn_conversions_deduped(p_phone_company, p_since, p_until)
  group by created_at::date
  order by day
$$;

-- ── Dashboard: deal value totals (real = closedwon, projected = all) ────────
-- Sums deal_value once per distinct phone in the period, so a phone with
-- multiple leads doesn't inflate ROAS.
create or replace function public.fn_dashboard_deal_totals(
  p_phone_company text,
  p_since date,
  p_until date
)
returns table (total_deal_value numeric, won_deal_value numeric)
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
    coalesce(sum(hc.deal_value) filter (where hc.deal_stage = 'closedwon'), 0) as won_deal_value
  from phones p
  join public.hubspot_contacts hc on hc.phone = p.phone_client
$$;

-- ── Campaigns page: spend/impressions/clicks aggregated per ad ──────────────
create or replace function public.fn_insights_by_ad(
  p_account text,
  p_since date,
  p_until date
)
returns table (
  campaign_id text,
  campaign_name text,
  adset_id text,
  adset_name text,
  ad_id text,
  ad_name text,
  spend numeric,
  impressions bigint,
  clicks bigint
)
language sql
stable
as $$
  select
    campaign_id,
    max(campaign_name) as campaign_name,
    adset_id,
    max(adset_name) as adset_name,
    ad_id,
    max(ad_name) as ad_name,
    sum(spend) as spend,
    sum(impressions) as impressions,
    sum(clicks) as clicks
  from public.meta_insights
  where account = p_account
    and date between p_since and p_until
  group by campaign_id, adset_id, ad_id
$$;

-- ── Campaigns page: lead counts aggregated per ad ───────────────────────────
-- Bulk count, unrelated to HubSpot match — every conversion counts as a lead.
create or replace function public.fn_conversion_lead_counts(
  p_phone_company text,
  p_since date,
  p_until date
)
returns table (
  campaign_id text,
  adset_id text,
  ads_id text,
  leads bigint
)
language sql
stable
as $$
  select campaign_id, adset_id, ads_id, count(*) as leads
  from public.fn_conversions_deduped(p_phone_company, p_since, p_until)
  where campaign_id is not null
  group by campaign_id, adset_id, ads_id
$$;

-- ── Campaigns page: per-phone deal touches, for campaign/adset/ad ROAS ──────
-- One row per (ad, phone) that converted AND matched a HubSpot contact. The
-- caller builds a Set of phones per campaign/adset/ad (like the JS code did
-- before), so a phone that converts twice within the same group is only
-- counted once — but is correctly counted at every level it touches.
-- Row count is bounded by matched leads in the period, not raw table size.
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
  is_won boolean
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
    hc.deal_stage = 'closedwon' as is_won
  from public.fn_conversions_deduped(p_phone_company, p_since, p_until) d
  join public.hubspot_contacts hc on hc.phone = d.phone_client
  where d.campaign_id is not null and d.phone_client is not null
$$;

grant execute on function public.fn_conversions_deduped(text, date, date) to authenticated, service_role;
grant execute on function public.fn_insights_daily(text, date, date) to authenticated, service_role;
grant execute on function public.fn_conversions_daily(text, date, date) to authenticated, service_role;
grant execute on function public.fn_dashboard_deal_totals(text, date, date) to authenticated, service_role;
grant execute on function public.fn_insights_by_ad(text, date, date) to authenticated, service_role;
grant execute on function public.fn_conversion_lead_counts(text, date, date) to authenticated, service_role;
grant execute on function public.fn_conversion_phone_touches(text, date, date) to authenticated, service_role;
