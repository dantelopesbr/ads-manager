import type { SupabaseClient } from '@supabase/supabase-js'
import { calcCPL, calcCTR } from '@/lib/metrics'

export interface CampaignAlert {
  campaignId: string
  campaignName: string
  type: 'cpl_alto' | 'ctr_baixo' | 'sem_leads'
  value: number | null
  threshold: number
  spend: number
}

export async function checkAlerts(supabase: SupabaseClient): Promise<CampaignAlert[]> {
  const since = new Date()
  since.setDate(since.getDate() - 7)
  const sinceStr = since.toISOString().split('T')[0]
  const until = new Date().toISOString().split('T')[0]

  // Aggregate spend/clicks/impressions per campaign for the last 7 days
  const PAGE = 1000
  type InsightRow = { campaign_id: string; campaign_name: string | null; spend: number | null; clicks: number | null; impressions: number | null }
  const insights: InsightRow[] = []
  for (let p = 0; ; p++) {
    const { data } = await supabase
      .from('meta_insights')
      .select('campaign_id, campaign_name, spend, clicks, impressions')
      .gte('date', sinceStr)
      .lte('date', until)
      .range(p * PAGE, (p + 1) * PAGE - 1)
    if (!data?.length) break
    insights.push(...data)
    if (data.length < PAGE) break
  }

  type ConvRow = { campaign_id: string | null }
  const conversions: ConvRow[] = []
  for (let p = 0; ; p++) {
    const { data } = await supabase
      .from('meta_ads_conversions')
      .select('campaign_id')
      .gte('created_at', sinceStr)
      .lte('created_at', until)
      .range(p * PAGE, (p + 1) * PAGE - 1)
    if (!data?.length) break
    conversions.push(...data)
    if (data.length < PAGE) break
  }

  const leadsByCampaign: Record<string, number> = {}
  for (const c of conversions) {
    if (c.campaign_id) leadsByCampaign[c.campaign_id] = (leadsByCampaign[c.campaign_id] ?? 0) + 1
  }

  // Aggregate by campaign
  type Agg = { name: string; spend: number; clicks: number; impressions: number }
  const agg: Record<string, Agg> = {}
  for (const r of insights) {
    if (!agg[r.campaign_id]) agg[r.campaign_id] = { name: r.campaign_name ?? r.campaign_id, spend: 0, clicks: 0, impressions: 0 }
    agg[r.campaign_id].spend += r.spend ?? 0
    agg[r.campaign_id].clicks += r.clicks ?? 0
    agg[r.campaign_id].impressions += r.impressions ?? 0
  }

  // Overall avg CPL
  const totalSpend = Object.values(agg).reduce((s, c) => s + c.spend, 0)
  const totalLeads = Object.values(leadsByCampaign).reduce((s, n) => s + n, 0)
  const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : null

  const alerts: CampaignAlert[] = []

  for (const [cid, c] of Object.entries(agg)) {
    if (c.spend < 50) continue  // ignore campaigns with very low spend

    const leads = leadsByCampaign[cid] ?? 0
    const cpl = calcCPL(c.spend, leads)
    const ctr = calcCTR(c.clicks, c.impressions)

    // CPL > avg * 1.5
    if (avgCpl !== null && cpl !== null && cpl > avgCpl * 1.5) {
      alerts.push({ campaignId: cid, campaignName: c.name, type: 'cpl_alto', value: cpl, threshold: avgCpl * 1.5, spend: c.spend })
    }

    // CTR < 0.3%
    if (ctr !== null && ctr < 0.003) {
      alerts.push({ campaignId: cid, campaignName: c.name, type: 'ctr_baixo', value: ctr, threshold: 0.003, spend: c.spend })
    }

    // Active with spend > R$100 and 0 leads
    if (c.spend > 100 && leads === 0) {
      alerts.push({ campaignId: cid, campaignName: c.name, type: 'sem_leads', value: null, threshold: 100, spend: c.spend })
    }
  }

  return alerts
}
