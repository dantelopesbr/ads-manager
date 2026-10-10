import { SupabaseClient } from '@supabase/supabase-js'
import { fetchMetaInsights, MetaInsightRaw } from './client'
import { format, subDays } from 'date-fns'
import type { AccountKey } from '@/lib/account'

function getSyncWindow(isFirstSync: boolean): { since: string; until: string } {
  const today = new Date()
  const since = format(subDays(today, isFirstSync ? 90 : 30), 'yyyy-MM-dd')
  const until = format(subDays(today, 1), 'yyyy-MM-dd')
  return { since, until }
}

function toInsightRow(raw: MetaInsightRaw, account: AccountKey) {
  return {
    account,
    date: raw.date_start,
    campaign_id: raw.campaign_id,
    campaign_name: raw.campaign_name,
    adset_id: raw.adset_id,
    adset_name: raw.adset_name,
    ad_id: raw.ad_id,
    ad_name: raw.ad_name,
    spend: parseFloat(raw.spend) || 0,
    impressions: parseInt(raw.impressions) || 0,
    clicks: parseInt(raw.clicks) || 0,
    reach: parseInt(raw.reach) || 0,
  }
}

export async function syncMetaInsights(
  supabase: SupabaseClient,
  account: AccountKey,
  accessToken: string,
  adAccountId: string
): Promise<number> {
  const { count } = await supabase
    .from('meta_insights')
    .select('*', { count: 'exact', head: true })
    .eq('account', account)
  const isFirstSync = count === 0

  const { since, until } = getSyncWindow(isFirstSync)
  const raw = await fetchMetaInsights(accessToken, adAccountId, since, until)
  const rows = raw.map(r => toInsightRow(r, account))

  if (rows.length === 0) return 0

  const { error } = await supabase
    .from('meta_insights')
    .upsert(rows, { onConflict: 'date,campaign_id,adset_id,ad_id,account' })

  if (error) throw new Error(`Supabase upsert error: ${error.message}`)

  return rows.length
}
