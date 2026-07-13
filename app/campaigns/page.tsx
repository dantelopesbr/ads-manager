import { createClient } from '@/lib/supabase/server'
import { Nav } from '@/components/nav'
import { CampaignsTable } from '@/components/campaigns/campaigns-table'
import { DateFilter } from '@/components/date-filter'
import { calcCPL, calcCTR, calcROAS } from '@/lib/metrics'
import { fetchMetaCampaigns, fetchMetaAdsets, fetchMetaAds } from '@/lib/meta/client'
import { format } from 'date-fns'
import { Suspense } from 'react'
import { getAccount } from '@/lib/account-server'
import { ACCOUNTS } from '@/lib/account'
import { getInsightsByAd, getConversionLeadCounts, getConversionPhoneTouches } from '@/lib/queries'

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
  const EPOCH = '2000-01-01' // sentinel: no lower bound set by user → all-time

  const account = await getAccount()
  const { phoneCompany } = ACCOUNTS[account]

  const [insights, leadCounts, phoneTouches] = await Promise.all([
    getInsightsByAd(supabase, account, since ?? EPOCH, until),
    getConversionLeadCounts(supabase, phoneCompany, since ?? EPOCH, until),
    getConversionPhoneTouches(supabase, phoneCompany, since ?? EPOCH, until),
  ])

  const dealByPhone: Record<string, { value: number; isWon: boolean }> = {}
  for (const t of phoneTouches) {
    dealByPhone[t.phone_client] = { value: t.deal_value ?? 0, isWon: t.is_won }
  }

  // Fetch live status from Meta API (best-effort — don't fail page if API down)
  const token = (account === 'fratellirev'
    ? (process.env.META_ACCESS_TOKEN_REV ?? process.env.META_ACCESS_TOKEN)
    : process.env.META_ACCESS_TOKEN)!
  const accountId = account === 'fratellirev'
    ? process.env.META_AD_ACCOUNT_ID_REV!
    : process.env.META_AD_ACCOUNT_ID!
  const [metaCampaigns, metaAdsets, metaAds] = await Promise.all([
    fetchMetaCampaigns(token, accountId).catch(() => []),
    fetchMetaAdsets(token, accountId).catch(() => []),
    fetchMetaAds(token, accountId).catch(() => []),
  ])

  const campaignStatus: Record<string, string> = {}
  for (const c of metaCampaigns) campaignStatus[c.id] = c.effective_status

  const adsetStatus: Record<string, string> = {}
  for (const a of metaAdsets) adsetStatus[a.id] = a.effective_status

  const adStatus: Record<string, string> = {}
  for (const a of metaAds) adStatus[a.id] = a.effective_status

  const campaignLeads: Record<string, number> = {}
  const adsetLeads: Record<string, number> = {}
  const adLeads: Record<string, number> = {}
  const campaignPhones: Record<string, PhoneSet> = {}
  const adsetPhones: Record<string, PhoneSet> = {}
  const adPhones: Record<string, PhoneSet> = {}

  for (const c of leadCounts) {
    const cid = c.campaign_id
    const asetKey = `${cid}__${c.adset_id}`
    const adKey = `${cid}__${c.adset_id}__${c.ads_id}`
    const n = Number(c.leads)
    campaignLeads[cid] = (campaignLeads[cid] ?? 0) + n
    adsetLeads[asetKey] = (adsetLeads[asetKey] ?? 0) + n
    adLeads[adKey] = (adLeads[adKey] ?? 0) + n
  }

  for (const t of phoneTouches) {
    const cid = t.campaign_id
    const asetKey = `${cid}__${t.adset_id}`
    const adKey = `${cid}__${t.adset_id}__${t.ads_id}`
    const phone = t.phone_client
    if (!campaignPhones[cid]) campaignPhones[cid] = { all: new Set(), won: new Set() }
    campaignPhones[cid].all.add(phone)
    if (t.is_won) campaignPhones[cid].won.add(phone)
    if (!adsetPhones[asetKey]) adsetPhones[asetKey] = { all: new Set(), won: new Set() }
    adsetPhones[asetKey].all.add(phone)
    if (t.is_won) adsetPhones[asetKey].won.add(phone)
    if (!adPhones[adKey]) adPhones[adKey] = { all: new Set(), won: new Set() }
    adPhones[adKey].all.add(phone)
    if (t.is_won) adPhones[adKey].won.add(phone)
  }

  type AdAgg = { id: string; name: string; adset_name: string | null; spend: number; impressions: number; clicks: number }
  type AdsetAgg = { id: string; name: string; spend: number; impressions: number; clicks: number; ads: Record<string, AdAgg> }
  type CampAgg = { name: string; spend: number; impressions: number; clicks: number; adsets: Record<string, AdsetAgg> }
  const grouped: Record<string, CampAgg> = {}

  for (const row of insights) {
    const cid = row.campaign_id
    const asetKey = `${cid}__${row.adset_id}`
    const adKey = `${cid}__${row.adset_id}__${row.ad_id}`
    if (!grouped[cid]) grouped[cid] = { name: row.campaign_name ?? cid, spend: 0, impressions: 0, clicks: 0, adsets: {} }
    grouped[cid].spend += row.spend ?? 0
    grouped[cid].impressions += row.impressions ?? 0
    grouped[cid].clicks += row.clicks ?? 0
    if (!grouped[cid].adsets[asetKey]) grouped[cid].adsets[asetKey] = { id: row.adset_id, name: row.adset_name ?? row.adset_id, spend: 0, impressions: 0, clicks: 0, ads: {} }
    grouped[cid].adsets[asetKey].spend += row.spend ?? 0
    grouped[cid].adsets[asetKey].impressions += row.impressions ?? 0
    grouped[cid].adsets[asetKey].clicks += row.clicks ?? 0
    if (!grouped[cid].adsets[asetKey].ads[adKey]) grouped[cid].adsets[asetKey].ads[adKey] = { id: row.ad_id, name: row.ad_name ?? row.ad_id, adset_name: row.adset_name ?? null, spend: 0, impressions: 0, clicks: 0 }
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
      status: campaignStatus[cid] ?? null,
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
          status: adsetStatus[a.id] ?? null,
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
              status: adStatus[ad.id] ?? null,
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
