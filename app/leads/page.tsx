import { createClient } from '@/lib/supabase/server'
import { Nav } from '@/components/nav'
import { LeadsTable } from '@/components/leads/leads-table'
import { DateFilter } from '@/components/date-filter'
import { format } from 'date-fns'
import { Suspense } from 'react'
import { getAccount, getAccountSelection } from '@/lib/account-server'
import { ACCOUNTS } from '@/lib/account'
import { dedupeByClickId } from '@/lib/conversions'

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

  const selection = await getAccountSelection()
  const account = await getAccount()
  const { phoneCompany } = ACCOUNTS[account]

  const allConversions: { id: number; phone_client: string | null; campaign_name: string | null; adset_name: string | null; ad_name: string | null; created_at: string; click_id: string | null }[] = []
  const PAGE_SIZE = 1000
  let page = 0
  while (true) {
    let q = supabase
      .from('meta_ads_conversions')
      .select('id, phone_client, campaign_name, adset_name, ad_name, created_at, click_id')
      .eq('phone_company', phoneCompany)
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
  const conversions = dedupeByClickId(allConversions)

  const phones = [...new Set(conversions.map(c => c.phone_client).filter(Boolean))] as string[]
  const BATCH = 100
  const contactRows: { phone: string; lifecycle_stage: string | null; deal_value: number | null; deal_stage: string | null }[] = []
  for (let i = 0; i < phones.length; i += BATCH) {
    const { data } = await supabase
      .from('hubspot_contacts')
      .select('phone, lifecycle_stage, deal_value, deal_stage')
      .in('phone', phones.slice(i, i + BATCH))
    if (data) contactRows.push(...data)
  }

  const contactByPhone = Object.fromEntries(
    contactRows.map(c => [c.phone, c])
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
        {selection === 'all' && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-3">
            Modo “Todas as contas” só se aplica ao Dashboard — mostrando {ACCOUNTS[account].label} aqui.
          </p>
        )}
        <p className="text-sm text-slate-500 mb-6">{label} · {leads.length} leads</p>
        <div className="bg-white rounded-xl border p-6">
          <LeadsTable leads={leads} />
        </div>
      </main>
    </div>
  )
}
