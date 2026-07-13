-- Powers the dashboard funnel (Lead → Orçamento → Venda Realizada/Perdida).
-- Left join (unlike fn_dashboard_deal_totals' inner join) — leads with no
-- HubSpot match yet must still show up, bucketed as "Lead" by the caller.
create or replace function public.fn_dashboard_lead_stages(
  p_phone_company text,
  p_since date,
  p_until date
)
returns table (phone_client text, deal_stage text)
language sql
stable
as $$
  with phones as (
    select distinct phone_client
    from public.fn_conversions_deduped(p_phone_company, p_since, p_until)
    where phone_client is not null
  )
  select p.phone_client, hc.deal_stage
  from phones p
  left join public.hubspot_contacts hc on hc.phone = p.phone_client
$$;

grant execute on function public.fn_dashboard_lead_stages(text, date, date) to authenticated, service_role;
