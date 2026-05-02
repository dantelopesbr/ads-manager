import { createClient } from '@/lib/supabase/server'
import { Nav } from '@/components/nav'
import { LeadsTable } from '@/components/leads/leads-table'
import { DateFilter } from '@/components/date-filter'
import { format } from 'date-fns'

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

  const conversionsQuery = supabase
    .from('meta_ads_conversions')
    .select('id, phone_client, campaign_name, adset_name, ad_name, created_at')
    .lte('created_at', until)
    .order('created_at', { ascending: false })
    .limit(1000)
  if (since) conversionsQuery.gte('created_at', since)

  const { data: conversions } = await conversionsQuery

  const phones = [...new Set((conversions ?? []).map(c => c.phone_client).filter(Boolean))] as string[]

  const { data: contacts } = phones.length > 0
    ? await supabase
        .from('hubspot_contacts')
        .select('phone, lifecycle_stage, deal_value, deal_stage')
        .in('phone', phones)
    : { data: [] }

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
          <DateFilter from={since ?? ''} to={until} />
        </div>
        <p className="text-sm text-slate-500 mb-6">{label} · {leads.length} leads</p>
        <div className="bg-white rounded-xl border p-6">
          <LeadsTable leads={leads} />
        </div>
      </main>
    </div>
  )
}
