import { createClient } from '@/lib/supabase/server'
import { Nav } from '@/components/nav'
import { CampaignsTable } from '@/components/campaigns/campaigns-table'
import { DateFilter } from '@/components/date-filter'
import { calcCPL, calcCTR, calcROAS } from '@/lib/metrics'
import { format } from 'date-fns'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

interface PhoneSet { all: Set<string>; won: Set<string> }

function sumDeals(
  ps: PhoneSet | undefined,
  dealByPhone: Record<string, { value: number; isWon: boolean }>
) {
  if (!ps) return { projected: null, real: null }
  let projected = 0, real = 0
  for (const phone of ps.all) {
    const d = dealByPhone[phone]
    if (d) { projected += d.value; if (d.isWon) real += d.value }
  }
  return { projected: projected > 0 ? projected : null, real: real > 0 ? real : null }
}

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const supabase = await createClient()
  const { from, to } = await searchParams
  const today = format(new Date(), 'yyyy-MM-dd')
  const since = from ?? null
  const until = to ?? today

  const PAGE = 1000

  type InsightRow = { campaign_id: string; campaign_name: string | null; adset_id: string; adset_name: string | null; ad_id: string; ad_name: string | null; spend: number | null; impressions: number | null; clicks: number | null }
  const insights: InsightRow[] = []
  for (let p = 0; ; p++) {
    let q = supabase
      .from('meta_insights')
      .select('campaign_id, campaign_name, adset_id, adset_name, ad_id, ad_name, spend, impressions, clicks')
      .lte('date', until)
      .range(p * PAGE, (p + 1) * PAGE - 1)
    if (since) q = q.gte('date', since)
    const { data } = await q
    if (!data?.length) break
    insights.push(...data)
    if (data.length < PAGE) break
  }

  type ConvRow = { campaign_id: string | null; adset_id: string | null; ads_id: string | null; phone_client: string | null }
  const rawConversions: ConvRow[] = []
  for (let p = 0; ; p++) {
    let q = supabase
      .from('meta_ads_conversions')
      .select('campaign_id, adset_id, ads_id, phone_client')
      .lte('created_at', until)
      .range(p * PAGE, (p + 1) * PAGE - 1)
    if (since) q = q.gte('created_at', since)
    const { data } = await q
    if (!data?.length) break
    rawConversions.push(...data)
    if (data.length < PAGE) break
  }

  // Batch .in() to avoid URL length limit (~100 phones per request)
  const phones = [...new Set((rawConversions ?? []).map(c => c.phone_client).filter(Boolean))] as string[]
  const BATCH = 100
  const contactRows: { phone: string; deal_value: number | null; deal_stage: string | null }[] = []
  for (let i = 0; i < phones.length; i += BATCH) {
    const { data } = await supabase
      .from('hubspot_contacts')
      .select('phone, deal_value, deal_stage')
      .in('phone', phones.slice(i, i + BATCH))
    if (data) contactRows.push(...data)
  }
  const contacts = contactRows

  const dealByPhone: Record<string, { value: number; isWon: boolean }> = {}
  for (const c of contacts ?? []) {
    dealByPhone[c.phone] = { value: c.deal_value ?? 0, isWon: c.deal_stage === 'closedwon' }
  }

  const campaignLeads: Record<string, number> = {}
  const adsetLeads: Record<string, number> = {}
  const adLeads: Record<string, number> = {}
  const campaignPhones: Record<string, PhoneSet> = {}
  const adsetPhones: Record<string, PhoneSet> = {}
  const adPhones: Record<string, PhoneSet> = {}

  for (const c of rawConversions ?? []) {
    if (!c.campaign_id) continue
    const cid = c.campaign_id
    const asetKey = `${cid}__${c.adset_id}`
    const adKey = `${cid}__${c.adset_id}__${c.ads_id}`
    campaignLeads[cid] = (campaignLeads[cid] ?? 0) + 1
    adsetLeads[asetKey] = (adsetLeads[asetKey] ?? 0) + 1
    adLeads[adKey] = (adLeads[adKey] ?? 0) + 1
    const phone = c.phone_client
    if (phone) {
      if (!campaignPhones[cid]) campaignPhones[cid] = { all: new Set(), won: new Set() }
      campaignPhones[cid].all.add(phone)
      if (dealByPhone[phone]?.isWon) campaignPhones[cid].won.add(phone)
      if (!adsetPhones[asetKey]) adsetPhones[asetKey] = { all: new Set(), won: new Set() }
      adsetPhones[asetKey].all.add(phone)
      if (dealByPhone[phone]?.isWon) adsetPhones[asetKey].won.add(phone)
      if (!adPhones[adKey]) adPhones[adKey] = { all: new Set(), won: new Set() }
      adPhones[adKey].all.add(phone)
      if (dealByPhone[phone]?.isWon) adPhones[adKey].won.add(phone)
    }
  }

  type AdAgg = { name: string; adset_name: string | null; spend: number; impressions: number; clicks: number }
  type AdsetAgg = { name: string; spend: number; impressions: number; clicks: number; ads: Record<string, AdAgg> }
  type CampAgg = { name: string; spend: number; impressions: number; clicks: number; adsets: Record<string, AdsetAgg> }
  const grouped: Record<string, CampAgg> = {}

  for (const row of insights ?? []) {
    const cid = row.campaign_id
    const asetKey = `${cid}__${row.adset_id}`
    const adKey = `${cid}__${row.adset_id}__${row.ad_id}`
    if (!grouped[cid]) grouped[cid] = { name: row.campaign_name ?? cid, spend: 0, impressions: 0, clicks: 0, adsets: {} }
    grouped[cid].spend += row.spend ?? 0
    grouped[cid].impressions += row.impressions ?? 0
    grouped[cid].clicks += row.clicks ?? 0
    if (!grouped[cid].adsets[asetKey]) grouped[cid].adsets[asetKey] = { name: row.adset_name ?? row.adset_id, spend: 0, impressions: 0, clicks: 0, ads: {} }
    grouped[cid].adsets[asetKey].spend += row.spend ?? 0
    grouped[cid].adsets[asetKey].impressions += row.impressions ?? 0
    grouped[cid].adsets[asetKey].clicks += row.clicks ?? 0
    if (!grouped[cid].adsets[asetKey].ads[adKey]) grouped[cid].adsets[asetKey].ads[adKey] = { name: row.ad_name ?? row.ad_id, adset_name: row.adset_name ?? null, spend: 0, impressions: 0, clicks: 0 }
    grouped[cid].adsets[asetKey].ads[adKey].spend += row.spend ?? 0
    grouped[cid].adsets[asetKey].ads[adKey].impressions += row.impressions ?? 0
    grouped[cid].adsets[asetKey].ads[adKey].clicks += row.clicks ?? 0
  }

  const campaigns = Object.entries(grouped).map(([cid, g]) => {
    const leads = campaignLeads[cid] ?? 0
    const { projected: cpv, real: crv } = sumDeals(campaignPhones[cid], dealByPhone)
    return {
      id: cid,
      name: g.name,
      spend: g.spend,
      leads,
      cpl: calcCPL(g.spend, leads),
      ctr: calcCTR(g.clicks, g.impressions),
      impressions: g.impressions,
      roas_real: calcROAS(crv, g.spend),
      roas_projected: calcROAS(cpv, g.spend),
      adsets: Object.entries(g.adsets).map(([asetKey, a]) => {
        const aLeads = adsetLeads[asetKey] ?? 0
        const { projected: apv, real: arv } = sumDeals(adsetPhones[asetKey], dealByPhone)
        return {
          key: asetKey,
          name: a.name,
          spend: a.spend,
          leads: aLeads,
          cpl: calcCPL(a.spend, aLeads),
          ctr: calcCTR(a.clicks, a.impressions),
          impressions: a.impressions,
          roas_real: calcROAS(arv, a.spend),
          roas_projected: calcROAS(apv, a.spend),
          ads: Object.entries(a.ads).map(([adKey, ad]) => {
            const dLeads = adLeads[adKey] ?? 0
            const { projected: dpv, real: drv } = sumDeals(adPhones[adKey], dealByPhone)
            return {
              key: adKey,
              name: ad.name,
              spend: ad.spend,
              leads: dLeads,
              cpl: calcCPL(ad.spend, dLeads),
              ctr: calcCTR(ad.clicks, ad.impressions),
              impressions: ad.impressions,
              roas_real: calcROAS(drv, ad.spend),
              roas_projected: calcROAS(dpv, ad.spend),
            }
          }).sort((a, b) => b.spend - a.spend),
        }
      }).sort((a, b) => b.spend - a.spend),
    }
  }).sort((a, b) => b.spend - a.spend)

  const totalLeads = campaigns.reduce((s, c) => s + c.leads, 0)
  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0)
  const avgCpl = calcCPL(totalSpend, totalLeads)

  return (
    <div className="flex">
      <Nav />
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Campanhas</h2>
          <Suspense fallback={null}><DateFilter from={since ?? ''} to={until} /></Suspense>
        </div>
        <div className="bg-white rounded-xl border p-6">
          <CampaignsTable campaigns={campaigns} avgCpl={avgCpl} />
        </div>
      </main>
    </div>
  )
}
