import { createClient } from '@/lib/supabase/server'
import { Nav } from '@/components/nav'
import { AdBreakdownTable } from '@/components/campaigns/ad-breakdown-table'
import { calcCPL, calcCTR } from '@/lib/metrics'
import { format, subDays } from 'date-fns'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ campaignId: string }>
}

export default async function CampaignDetailPage({ params }: Props) {
  const { campaignId } = await params
  const supabase = await createClient()
  const since = format(subDays(new Date(), 30), 'yyyy-MM-dd')
  const until = format(new Date(), 'yyyy-MM-dd')

  const [{ data: insights }, { data: conversions }] = await Promise.all([
    supabase
      .from('meta_insights')
      .select('ad_id, ad_name, adset_name, spend, impressions, clicks')
      .eq('campaign_id', campaignId)
      .gte('date', since)
      .lte('date', until),
    supabase
      .from('meta_ads_conversions')
      .select('ads_id, ad_name')
      .eq('campaign_id', campaignId)
      .gte('created_at', since),
  ])

  // Count leads by ad_id (ads_id in conversions = ad_id in insights)
  const leadsByAdId: Record<string, number> = {}
  const leadsByAdName: Record<string, number> = {}
  for (const c of conversions ?? []) {
    if (c.ads_id) leadsByAdId[c.ads_id] = (leadsByAdId[c.ads_id] ?? 0) + 1
    if (c.ad_name) leadsByAdName[c.ad_name] = (leadsByAdName[c.ad_name] ?? 0) + 1
  }

  const grouped: Record<string, {
    ad_id: string; ad_name: string; adset_name: string | null
    spend: number; impressions: number; clicks: number
  }> = {}

  for (const row of insights ?? []) {
    if (!grouped[row.ad_id]) {
      grouped[row.ad_id] = {
        ad_id: row.ad_id,
        ad_name: row.ad_name ?? row.ad_id,
        adset_name: row.adset_name ?? null,
        spend: 0, impressions: 0, clicks: 0,
      }
    }
    grouped[row.ad_id].spend += row.spend ?? 0
    grouped[row.ad_id].impressions += row.impressions ?? 0
    grouped[row.ad_id].clicks += row.clicks ?? 0
  }

  const campaignName = insights?.[0] == null
    ? campaignId
    : (await supabase
        .from('meta_insights')
        .select('campaign_name')
        .eq('campaign_id', campaignId)
        .limit(1)
        .single()
      ).data?.campaign_name ?? campaignId

  const ads = Object.values(grouped).map(g => {
    // Try to match by ad_id first, fallback to ad_name
    const leads = leadsByAdId[g.ad_id] ?? leadsByAdName[g.ad_name] ?? 0
    return {
      ...g,
      leads,
      cpl: calcCPL(g.spend, leads),
      ctr: calcCTR(g.clicks, g.impressions),
    }
  }).sort((a, b) => b.spend - a.spend)

  const totalLeads = ads.reduce((s, a) => s + a.leads, 0)
  const totalSpend = ads.reduce((s, a) => s + a.spend, 0)
  const avgCpl = calcCPL(totalSpend, totalLeads)

  return (
    <div className="flex">
      <Nav />
      <main className="flex-1 p-8">
        <div className="mb-6">
          <Link href="/campaigns" className="text-sm text-slate-500 hover:text-slate-800">
            ← Campanhas
          </Link>
          <h2 className="text-2xl font-bold mt-2">{campaignName}</h2>
          <p className="text-sm text-slate-500 mt-1">
            Últimos 30 dias · {ads.length} anúncios · {totalLeads} leads
          </p>
        </div>
        <div className="bg-white rounded-xl border p-6">
          <AdBreakdownTable ads={ads} avgCpl={avgCpl} />
        </div>
      </main>
    </div>
  )
}
