import { createClient } from '@/lib/supabase/server'
import { Nav } from '@/components/nav'
import { CampaignsTable } from '@/components/campaigns/campaigns-table'
import { calcCPL, calcCTR } from '@/lib/metrics'
import { format, subDays } from 'date-fns'

export const dynamic = 'force-dynamic'

export default async function CampaignsPage() {
  const supabase = await createClient()
  const since = format(subDays(new Date(), 30), 'yyyy-MM-dd')
  const until = format(new Date(), 'yyyy-MM-dd')

  const [{ data: insights }, { data: conversions }] = await Promise.all([
    supabase
      .from('meta_insights')
      .select('campaign_id, campaign_name, spend, impressions, clicks')
      .gte('date', since)
      .lte('date', until),
    supabase
      .from('[FH]Meta Ads')
      .select('campaign_id')
      .gte('created_at', since),
  ])

  const leadsByCampaign: Record<string, number> = {}
  for (const c of conversions ?? []) {
    if (c.campaign_id) leadsByCampaign[c.campaign_id] = (leadsByCampaign[c.campaign_id] ?? 0) + 1
  }

  const grouped: Record<string, { name: string; spend: number; impressions: number; clicks: number }> = {}
  for (const row of insights ?? []) {
    if (!grouped[row.campaign_id]) {
      grouped[row.campaign_id] = { name: row.campaign_name ?? row.campaign_id, spend: 0, impressions: 0, clicks: 0 }
    }
    grouped[row.campaign_id].spend += row.spend ?? 0
    grouped[row.campaign_id].impressions += row.impressions ?? 0
    grouped[row.campaign_id].clicks += row.clicks ?? 0
  }

  const campaigns = Object.entries(grouped).map(([id, g]) => ({
    id,
    name: g.name,
    spend: g.spend,
    leads: leadsByCampaign[id] ?? 0,
    cpl: calcCPL(g.spend, leadsByCampaign[id] ?? 0),
    ctr: calcCTR(g.clicks, g.impressions),
    impressions: g.impressions,
    clicks: g.clicks,
  })).sort((a, b) => b.spend - a.spend)

  const totalLeads = campaigns.reduce((s, c) => s + c.leads, 0)
  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0)
  const avgCpl = calcCPL(totalSpend, totalLeads)

  return (
    <div className="flex">
      <Nav />
      <main className="flex-1 p-8">
        <h2 className="text-2xl font-bold mb-6">Campanhas</h2>
        <div className="bg-white rounded-xl border p-6">
          <CampaignsTable campaigns={campaigns} avgCpl={avgCpl} />
        </div>
      </main>
    </div>
  )
}
