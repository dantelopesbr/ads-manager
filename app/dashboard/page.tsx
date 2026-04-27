import { createClient } from '@/lib/supabase/server'
import { Nav } from '@/components/nav'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { PerformanceChart } from '@/components/dashboard/performance-chart'
import { calcCPL, formatCurrency } from '@/lib/metrics'
import { format, subDays } from 'date-fns'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const since = format(subDays(new Date(), 30), 'yyyy-MM-dd')
  const until = format(new Date(), 'yyyy-MM-dd')

  const [{ data: insights }, { count: totalLeads }, { data: deals }] = await Promise.all([
    supabase.from('meta_insights').select('spend, date').gte('date', since).lte('date', until),
    supabase.from('[FH]Meta Ads').select('*', { count: 'exact', head: true }).gte('created_at', since),
    supabase.from('hubspot_contacts').select('deal_value').not('deal_value', 'is', null),
  ])

  const totalSpend = (insights ?? []).reduce((sum, r) => sum + (r.spend ?? 0), 0)
  const totalDealValue = (deals ?? []).reduce((sum, r) => sum + (r.deal_value ?? 0), 0)
  const cpl = calcCPL(totalSpend, totalLeads ?? 0)
  const roas = totalSpend > 0 ? totalDealValue / totalSpend : null

  const byDate: Record<string, { spend: number }> = {}
  for (const row of insights ?? []) {
    if (!byDate[row.date]) byDate[row.date] = { spend: 0 }
    byDate[row.date].spend += row.spend ?? 0
  }

  const { data: dailyLeads } = await supabase
    .from('[FH]Meta Ads')
    .select('created_at')
    .gte('created_at', since)

  const leadsByDate: Record<string, number> = {}
  for (const row of dailyLeads ?? []) {
    const d = row.created_at.split('T')[0]
    leadsByDate[d] = (leadsByDate[d] ?? 0) + 1
  }

  const chartData = Object.keys(byDate).sort().map(date => ({
    date,
    spend: Math.round(byDate[date].spend),
    leads: leadsByDate[date] ?? 0,
  }))

  return (
    <div className="flex">
      <Nav />
      <main className="flex-1 p-8">
        <h2 className="text-2xl font-bold mb-6">Dashboard</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KpiCard title="Total Spend" value={formatCurrency(totalSpend)} subtitle="últimos 30 dias" />
          <KpiCard title="Leads" value={String(totalLeads ?? 0)} subtitle="últimos 30 dias" />
          <KpiCard title="CPL" value={formatCurrency(cpl)} />
          <KpiCard title="ROAS" value={roas !== null ? `${roas.toFixed(2)}x` : '—'} />
        </div>
        <div className="bg-white rounded-xl border p-6">
          <h3 className="text-sm font-semibold mb-4 text-slate-600">Leads + Spend (30 dias)</h3>
          <PerformanceChart data={chartData} />
        </div>
      </main>
    </div>
  )
}
