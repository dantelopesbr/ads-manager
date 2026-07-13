import { SupabaseClient } from '@supabase/supabase-js'
import { ACCOUNTS, type AccountKey } from '@/lib/account'

export interface DailySpend { date: string; spend: number }
export interface DailyLeads { day: string; leads: number }
export interface DealTotals { total_deal_value: number; won_deal_value: number; deal_count: number; won_count: number }
export interface AdInsightRow {
  campaign_id: string
  campaign_name: string | null
  adset_id: string
  adset_name: string | null
  ad_id: string
  ad_name: string | null
  spend: number
  impressions: number
  clicks: number
}
export interface AdLeadCount {
  campaign_id: string
  adset_id: string | null
  ads_id: string | null
  leads: number
}
export interface PhoneTouch {
  campaign_id: string
  adset_id: string | null
  ads_id: string | null
  phone_client: string
  deal_value: number | null
  deal_value_won: number | null
}

export async function getInsightsDaily(
  supabase: SupabaseClient, account: string, since: string, until: string
): Promise<DailySpend[]> {
  const { data, error } = await supabase.rpc('fn_insights_daily', {
    p_account: account, p_since: since, p_until: until,
  })
  if (error) throw error
  return data ?? []
}

export async function getConversionsDaily(
  supabase: SupabaseClient, phoneCompany: string, since: string, until: string
): Promise<DailyLeads[]> {
  const { data, error } = await supabase.rpc('fn_conversions_daily', {
    p_phone_company: phoneCompany, p_since: since, p_until: until,
  })
  if (error) throw error
  return data ?? []
}

export async function getDashboardDealTotals(
  supabase: SupabaseClient, phoneCompany: string, since: string, until: string
): Promise<DealTotals> {
  const { data, error } = await supabase.rpc('fn_dashboard_deal_totals', {
    p_phone_company: phoneCompany, p_since: since, p_until: until,
  })
  if (error) throw error
  const row = data?.[0]
  return {
    total_deal_value: row?.total_deal_value ?? 0,
    won_deal_value: row?.won_deal_value ?? 0,
    deal_count: Number(row?.deal_count ?? 0),
    won_count: Number(row?.won_count ?? 0),
  }
}

export async function getInsightsByAd(
  supabase: SupabaseClient, account: string, since: string, until: string
): Promise<AdInsightRow[]> {
  const { data, error } = await supabase.rpc('fn_insights_by_ad', {
    p_account: account, p_since: since, p_until: until,
  })
  if (error) throw error
  return data ?? []
}

export async function getConversionLeadCounts(
  supabase: SupabaseClient, phoneCompany: string, since: string, until: string
): Promise<AdLeadCount[]> {
  const { data, error } = await supabase.rpc('fn_conversion_lead_counts', {
    p_phone_company: phoneCompany, p_since: since, p_until: until,
  })
  if (error) throw error
  return data ?? []
}

export async function getConversionPhoneTouches(
  supabase: SupabaseClient, phoneCompany: string, since: string, until: string
): Promise<PhoneTouch[]> {
  const { data, error } = await supabase.rpc('fn_conversion_phone_touches', {
    p_phone_company: phoneCompany, p_since: since, p_until: until,
  })
  if (error) throw error
  return data ?? []
}

export interface DashboardPeriodData {
  insights: DailySpend[]
  conversionsDaily: DailyLeads[]
  dealTotals: DealTotals
}

function mergeDealTotals(a: DealTotals, b: DealTotals): DealTotals {
  return {
    total_deal_value: a.total_deal_value + b.total_deal_value,
    won_deal_value: a.won_deal_value + b.won_deal_value,
    deal_count: a.deal_count + b.deal_count,
    won_count: a.won_count + b.won_count,
  }
}

/**
 * Dashboard data for one or more accounts, merged. Daily rows are simply
 * concatenated — the caller already sums same-day rows when building a
 * per-date map, so two accounts' rows for the same date add up correctly.
 */
export async function getDashboardPeriodData(
  supabase: SupabaseClient, accountKeys: AccountKey[], since: string, until: string
): Promise<DashboardPeriodData> {
  const perAccount = await Promise.all(accountKeys.map(async key => {
    const { phoneCompany } = ACCOUNTS[key]
    const [insights, conversionsDaily, dealTotals] = await Promise.all([
      getInsightsDaily(supabase, key, since, until),
      getConversionsDaily(supabase, phoneCompany, since, until),
      getDashboardDealTotals(supabase, phoneCompany, since, until),
    ])
    return { insights, conversionsDaily, dealTotals }
  }))

  return {
    insights: perAccount.flatMap(p => p.insights),
    conversionsDaily: perAccount.flatMap(p => p.conversionsDaily),
    dealTotals: perAccount.reduce(
      (acc, p) => mergeDealTotals(acc, p.dealTotals),
      { total_deal_value: 0, won_deal_value: 0, deal_count: 0, won_count: 0 }
    ),
  }
}

export interface AccountTargetValues { cpl_target: number | null; roas_target: number | null }

export async function getAccountTarget(
  supabase: SupabaseClient, account: AccountKey
): Promise<AccountTargetValues> {
  const { data } = await supabase
    .from('account_targets')
    .select('cpl_target, roas_target')
    .eq('account', account)
    .maybeSingle()
  return { cpl_target: data?.cpl_target ?? null, roas_target: data?.roas_target ?? null }
}
