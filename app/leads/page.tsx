import { createClient } from '@/lib/supabase/server'
import { Nav } from '@/components/nav'
import { LeadsTable } from '@/components/leads/leads-table'
import { format, subDays } from 'date-fns'

export const dynamic = 'force-dynamic'

export default async function LeadsPage() {
  const supabase = await createClient()
  const since = format(subDays(new Date(), 30), 'yyyy-MM-dd')

  const { data: conversions } = await supabase
    .from('meta_ads_conversions')
    .select('id, phone_client, campaign_name, adset_name, ad_name, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(500)

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

  return (
    <div className="flex">
      <Nav />
      <main className="flex-1 p-8">
        <h2 className="text-2xl font-bold mb-2">Leads</h2>
        <p className="text-sm text-slate-500 mb-6">Últimos 30 dias · {leads.length} leads</p>
        <div className="bg-white rounded-xl border p-6">
          <LeadsTable leads={leads} />
        </div>
      </main>
    </div>
  )
}
