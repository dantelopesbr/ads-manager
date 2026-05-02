import { createClient } from '@/lib/supabase/server'
import { Nav } from '@/components/nav'
import { LeadsTable } from '@/components/leads/leads-table'
import { DateFilter } from '@/components/date-filter'
import { format } from 'date-fns'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const supabase = await createClient()
  const { from, to } = await searchParams
  const today = format(new Date(), 'yyyy-MM-dd')
  const since = from ?? null
  const until = to ?? today

  const allConversions: { id: number; phone_client: string | null; campaign_name: string | null; adset_name: string | null; ad_name: string | null; created_at: string }[] = []
  const PAGE_SIZE = 1000
  let page = 0
  while (true) {
    let q = supabase
      .from('meta_ads_conversions')
      .select('id, phone_client, campaign_name, adset_name, ad_name, created_at')
      .lte('created_at', until)
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
    if (since) q = q.gte('created_at', since)
    const { data: batch } = await q
    if (!batch?.length) break
    allConversions.push(...batch)
    if (batch.length < PAGE_SIZE) break
    page++
  }
  const conversions = allConversions

  const { data: contacts } = await supabase
    .from('hubspot_contacts')
    .select('phone, lifecycle_stage, deal_value, deal_stage')

  const contactByPhone = Object.fromEntries(
    (contacts ?? []).map(c => [c.phone, c])
  )

  const leads = (conversions ?? []).map(c => ({
    ...c,
    lifecycle_stage: contactByPhone[c.phone_client ?? '']?.lifecycle_stage ?? null,
    deal_value: contactByPhone[c.phone_client ?? '']?.deal_value ?? null,
    deal_stage: contactByPhone[c.phone_client ?? '']?.deal_stage ?? null,
  }))

  const label = since
    ? `${since} → ${until}`
    : `até ${until}`

  return (
    <div className="flex">
      <Nav />
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold">Leads</h2>
          <Suspense fallback={null}><DateFilter from={since ?? ''} to={until} /></Suspense>
        </div>
        <p className="text-sm text-slate-500 mb-6">{label} · {leads.length} leads</p>
        <div className="bg-white rounded-xl border p-6">
          <LeadsTable leads={leads} />
        </div>
      </main>
    </div>
  )
}
