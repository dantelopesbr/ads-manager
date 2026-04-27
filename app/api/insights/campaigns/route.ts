import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calcCPL, calcCTR } from '@/lib/metrics'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const since = searchParams.get('since') ?? new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  const until = searchParams.get('until') ?? new Date().toISOString().split('T')[0]
  const level = (searchParams.get('level') ?? 'campaign') as 'campaign' | 'adset' | 'ad'

  const { data: insights, error: insightsError } = await supabase
    .from('meta_insights')
    .select('campaign_id, campaign_name, adset_id, adset_name, ad_id, ad_name, spend, impressions, clicks')
    .gte('date', since)
    .lte('date', until)

  if (insightsError) return NextResponse.json({ error: insightsError.message }, { status: 500 })

  const { data: conversions } = await supabase
    .from('meta_ads_conversions')
    .select('campaign_id, adset_id, ad_name')
    .gte('created_at', since)
    .lte('created_at', until)

  const leadCounts: Record<string, number> = {}
  for (const c of conversions ?? []) {
    const key = level === 'campaign' ? c.campaign_id
      : level === 'adset' ? `${c.campaign_id}__${c.adset_id}`
      : `${c.campaign_id}__${c.adset_id}__${c.ad_name}`
    if (key) leadCounts[key] = (leadCounts[key] ?? 0) + 1
  }

  const grouped: Record<string, {
    id: string; name: string; spend: number
    impressions: number; clicks: number; leads: number
  }> = {}

  for (const row of insights ?? []) {
    const key = level === 'campaign' ? row.campaign_id
      : level === 'adset' ? `${row.campaign_id}__${row.adset_id}`
      : `${row.campaign_id}__${row.adset_id}__${row.ad_id}`
    const name = level === 'campaign' ? row.campaign_name
      : level === 'adset' ? row.adset_name
      : row.ad_name

    if (!grouped[key]) {
      grouped[key] = { id: key, name: name ?? key, spend: 0, impressions: 0, clicks: 0, leads: 0 }
    }
    grouped[key].spend += row.spend ?? 0
    grouped[key].impressions += row.impressions ?? 0
    grouped[key].clicks += row.clicks ?? 0
    grouped[key].leads = leadCounts[key] ?? 0
  }

  const result = Object.values(grouped).map(g => ({
    ...g,
    cpl: calcCPL(g.spend, g.leads),
    ctr: calcCTR(g.clicks, g.impressions),
  }))

  return NextResponse.json({ data: result, since, until, level })
}
