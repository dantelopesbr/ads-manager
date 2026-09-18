-- Add lead→deal conversion counts to the dashboard deal totals function, so
-- the dashboard can show "% of leads that became a deal" alongside ROAS.
-- Return signature changes, so the function must be dropped first.
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
    coalesce(sum(hc.deal_value) filter (where hc.deal_stage = 'closedwon'), 0) as won_deal_value,
    count(*) filter (where hc.deal_stage is not null) as deal_count,
    count(*) filter (where hc.deal_stage = 'closedwon') as won_count
  from phones p
  join public.hubspot_contacts hc on hc.phone = p.phone_client
$$;

grant execute on function public.fn_dashboard_deal_totals(text, date, date) to authenticated, service_role;
