import type { SupabaseClient } from '@supabase/supabase-js'
import { calcCPL, calcCTR } from '@/lib/metrics'
import { fetchMetaAccountStatus, BILLING_PROBLEM_STATUSES } from '@/lib/meta/client'

export interface CampaignAlert {
  campaignId: string
  campaignName: string
  type: 'cpl_alto' | 'ctr_baixo' | 'sem_leads'
  value: number | null
  threshold: number
  spend: number
}

export interface AccountAlert {
  type: 'pagamento_falhou' | 'saldo_insuficiente'
  message: string
  detail: string
}

export interface AlertResult {
  campaignAlerts: CampaignAlert[]
  accountAlerts: AccountAlert[]
}

// Saldo baixo = menos de R$50 (em centavos = 5000)
const LOW_BALANCE_THRESHOLD_CENTS = 5000

export async function checkAlerts(supabase: SupabaseClient): Promise<AlertResult> {
  const since = new Date()
  since.setDate(since.getDate() - 7)
  const sinceStr = since.toISOString().split('T')[0]
  const until = new Date().toISOString().split('T')[0]

  // ── Account billing check ─────────────────────────────────────────────────
  const accountAlerts: AccountAlert[] = []
  try {
    const token = process.env.META_ACCESS_TOKEN!
    const accountId = process.env.META_AD_ACCOUNT_ID!
    const status = await fetchMetaAccountStatus(token, accountId)

    const billingProblem = BILLING_PROBLEM_STATUSES[status.account_status]
    if (billingProblem) {
      accountAlerts.push({
        type: 'pagamento_falhou',
        message: 'Problema de pagamento na conta Meta Ads',
        detail: billingProblem,
      })
    }

    // Saldo pré-pago baixo (balance é "0" para contas pós-pagas — ignorar)
    const balanceCents = parseInt(status.balance, 10)
    if (balanceCents > 0 && balanceCents < LOW_BALANCE_THRESHOLD_CENTS) {
      const balanceBrl = (balanceCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: status.currency ?? 'BRL' })
      accountAlerts.push({
        type: 'saldo_insuficiente',
        message: 'Saldo pré-pago baixo na conta Meta Ads',
        detail: `Saldo atual: ${balanceBrl} (abaixo de R$50)`,
      })
    }
  } catch {
    // billing check failing should not block campaign alerts
  }

  // ── Campaign performance check ────────────────────────────────────────────
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

  type Agg = { name: string; spend: number; clicks: number; impressions: number }
  const agg: Record<string, Agg> = {}
  for (const r of insights) {
    if (!agg[r.campaign_id]) agg[r.campaign_id] = { name: r.campaign_name ?? r.campaign_id, spend: 0, clicks: 0, impressions: 0 }
    agg[r.campaign_id].spend += r.spend ?? 0
    agg[r.campaign_id].clicks += r.clicks ?? 0
    agg[r.campaign_id].impressions += r.impressions ?? 0
  }

  const totalSpend = Object.values(agg).reduce((s, c) => s + c.spend, 0)
  const totalLeads = Object.values(leadsByCampaign).reduce((s, n) => s + n, 0)
  const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : null

  const campaignAlerts: CampaignAlert[] = []

  for (const [cid, c] of Object.entries(agg)) {
    if (c.spend < 50) continue

    const leads = leadsByCampaign[cid] ?? 0
    const cpl = calcCPL(c.spend, leads)
    const ctr = calcCTR(c.clicks, c.impressions)

    if (avgCpl !== null && cpl !== null && cpl > avgCpl * 1.5) {
      campaignAlerts.push({ campaignId: cid, campaignName: c.name, type: 'cpl_alto', value: cpl, threshold: avgCpl * 1.5, spend: c.spend })
    }

    if (ctr !== null && ctr < 0.003) {
      campaignAlerts.push({ campaignId: cid, campaignName: c.name, type: 'ctr_baixo', value: ctr, threshold: 0.003, spend: c.spend })
    }

    if (c.spend > 100 && leads === 0) {
      campaignAlerts.push({ campaignId: cid, campaignName: c.name, type: 'sem_leads', value: null, threshold: 100, spend: c.spend })
    }
  }

  return { campaignAlerts, accountAlerts }
}
