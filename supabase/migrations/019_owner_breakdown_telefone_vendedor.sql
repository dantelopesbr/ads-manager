-- fn_dashboard_owner_breakdown previously resolved owner_name only from this
-- app's own hubspot_contacts snapshot (incremental enrich, 7-day resync,
-- 150 contacts/day cap) — left the large majority of ad-attributed leads
-- unresolved as "Sem vendedor" (confirmed: 74 of 87 leads in a recent
-- 30-day window). [FH]telefone_vendedor is a phone -> current owner lookup
-- fed by the same BigQuery-backed pipeline already used for
-- performance_vendedor_diario / funil_vendedor_diario — prefer it, falling
-- back to hubspot_contacts when a phone isn't in either. deal_stage /
-- deal_value / deal_value_won still come from hubspot_contacts —
-- telefone_vendedor doesn't carry deal financials, only owner attribution.
create or replace function public.fn_dashboard_owner_breakdown(
  p_phone_company text,
  p_since date,
  p_until date
)
returns table (
  owner_name text,
  deal_stage text,
  deal_value numeric,
  deal_value_won numeric
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
    coalesce(tv.owner_name, hc.owner_name) as owner_name,
    hc.deal_stage, hc.deal_value, hc.deal_value_won
  from phones p
  left join public.hubspot_contacts hc on hc.phone = p.phone_client
  left join public."[FH]telefone_vendedor" tv on tv.telefone = p.phone_client
$$;

grant execute on function public.fn_dashboard_owner_breakdown(text, date, date) to authenticated, service_role;
