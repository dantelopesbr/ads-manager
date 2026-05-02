import { createClient } from '@/lib/supabase/server'
import { Nav } from '@/components/nav'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { PerformanceChart } from '@/components/dashboard/performance-chart'
import { DateFilter } from '@/components/date-filter'
import { calcCPL, calcROAS, formatCurrency, formatROAS } from '@/lib/metrics'
import { format } from 'date-fns'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

const PAGE = 1000

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const supabase = await createClient()
  const { from, to } = await searchParams
  const today = format(new Date(), 'yyyy-MM-dd')
  const since = from ?? null
  const until = to ?? today

  // Paginate insights
  type InsightRow = { spend: number; date: string }
  const insights: InsightRow[] = []
  for (let p = 0; ; p++) {
    let q = supabase
      .from('meta_insights')
      .select('spend, date')
      .lte('date', until)
      .range(p * PAGE, (p + 1) * PAGE - 1)
    if (since) q = q.gte('date', since)
    const { data } = await q
    if (!data?.length) break
    insights.push(...data)
    if (data.length < PAGE) break
  }

  // Paginate conversions
  type ConvRow = { phone_client: string | null; created_at: string }
  const conversions: ConvRow[] = []
  for (let p = 0; ; p++) {
    let q = supabase
      .from('meta_ads_conversions')
      .select('phone_client, created_at')
      .lte('created_at', until)
      .range(p * PAGE, (p + 1) * PAGE - 1)
    if (since) q = q.gte('created_at', since)
    const { data } = await q
    if (!data?.length) break
    conversions.push(...data)
    if (data.length < PAGE) break
  }

  // ROAS: batch .in() 100 phones at a time to avoid URL length limit
  const phones = [...new Set(conversions.map(c => c.phone_client).filter(Boolean))] as string[]
  const contactRows: { phone: string; deal_value: number | null; deal_stage: string | null }[] = []
  for (let i = 0; i < phones.length; i += 100) {
    const { data } = await supabase
      .from('hubspot_contacts')
      .select('phone, deal_value, deal_stage')
      .in('phone', phones.slice(i, i + 100))
    if (data) contactRows.push(...data)
  }

  const totalSpend = insights.reduce((s, r) => s + (r.spend ?? 0), 0)
  const totalLeads = conversions.length

  let totalDealValue = 0, wonDealValue = 0
  for (const c of contactRows) {
    if (c.deal_value) {
      totalDealValue += c.deal_value
      if (c.deal_stage === 'closedwon') wonDealValue += c.deal_value
    }
  }

  const cpl = calcCPL(totalSpend, totalLeads)
  const roasReal = calcROAS(wonDealValue > 0 ? wonDealValue : null, totalSpend)
  const roasProjected = calcROAS(totalDealValue > 0 ? totalDealValue : null, totalSpend)

  // Chart: spend + leads by date
  const byDate: Record<string, { spend: number; leads: number }> = {}
  for (const row of insights) {
    if (!byDate[row.date]) byDate[row.date] = { spend: 0, leads: 0 }
    byDate[row.date].spend += row.spend ?? 0
  }
  for (const row of conversions) {
    const d = row.created_at.split('T')[0]
    if (!byDate[d]) byDate[d] = { spend: 0, leads: 0 }
    byDate[d].leads += 1
  }

  const chartData = Object.keys(byDate).sort().map(date => ({
    date,
    spend: Math.round(byDate[date].spend),
    leads: byDate[date].leads,
  }))

  const periodLabel = since ? `${since} → ${until}` : `até ${until}`

  return (
    <div className="flex">
      <Nav />
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Dashboard</h2>
          <Suspense fallback={null}>
            <DateFilter from={since ?? ''} to={until} />
          </Suspense>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <KpiCard title="Total Spend" value={formatCurrency(totalSpend)} subtitle={periodLabel} />
          <KpiCard title="Leads" value={String(totalLeads)} subtitle={periodLabel} />
          <KpiCard title="CPL" value={formatCurrency(cpl)} />
          <KpiCard title="ROAS Real" value={formatROAS(roasReal)} subtitle="deals fechados (won)" />
          <KpiCard title="ROAS Projetado" value={formatROAS(roasProjected)} subtitle="todos os deals" />
        </div>
        <div className="bg-white rounded-xl border p-6">
          <h3 className="text-sm font-semibold mb-4 text-slate-600">Leads + Spend · {periodLabel}</h3>
          <PerformanceChart data={chartData} />
        </div>
      </main>
    </div>
  )
}
