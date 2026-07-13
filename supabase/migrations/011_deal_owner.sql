-- Deal owner (salesperson) tracking. owner_id is the raw HubSpot user id from
-- the deal (closedwon deal's owner takes priority, same tie-break as
-- deal_stage — see lib/hubspot/client.ts); owner_name is resolved once per
-- enrich run against /crm/v3/owners so the dashboard doesn't need to join
-- against a separate owners table.
alter table public.hubspot_contacts
  add column if not exists owner_id text,
  add column if not exists owner_name text;

-- ── Vendedores page: one row per lead-phone with its deal + owner info ──────
-- Left join (like fn_dashboard_lead_stages) — leads with no HubSpot match, or
-- matched but with no deal owner set yet, still show up bucketed "Sem vendedor".
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
  select hc.owner_name, hc.deal_stage, hc.deal_value, hc.deal_value_won
  from phones p
  left join public.hubspot_contacts hc on hc.phone = p.phone_client
$$;

grant execute on function public.fn_dashboard_owner_breakdown(text, date, date) to authenticated, service_role;
