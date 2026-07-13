import { createClient } from '@/lib/supabase/server'
import { Nav } from '@/components/nav'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { PerformanceChart } from '@/components/dashboard/performance-chart'
import { DateFilter } from '@/components/date-filter'
import { calcCPL, calcROAS, formatCurrency, formatROAS } from '@/lib/metrics'
import { format, subDays } from 'date-fns'
import { Suspense } from 'react'
import { getAccount } from '@/lib/account-server'
import { ACCOUNTS } from '@/lib/account'
import { getInsightsDaily, getConversionsDaily, getDashboardDealTotals } from '@/lib/queries'

export const dynamic = 'force-dynamic'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const supabase = await createClient()
  const { from, to } = await searchParams
  const today = format(new Date(), 'yyyy-MM-dd')
  const defaultSince = format(subDays(new Date(), 29), 'yyyy-MM-dd')
  const since = from ?? defaultSince
  const until = to ?? today

  const account = await getAccount()
  const { phoneCompany } = ACCOUNTS[account]

  const [insights, conversionsDaily, dealTotals] = await Promise.all([
    getInsightsDaily(supabase, account, since, until),
    getConversionsDaily(supabase, phoneCompany, since, until),
    getDashboardDealTotals(supabase, phoneCompany, since, until),
  ])

  const totalSpend = insights.reduce((s, r) => s + (r.spend ?? 0), 0)
  const totalLeads = conversionsDaily.reduce((s, r) => s + Number(r.leads), 0)

  const cpl = calcCPL(totalSpend, totalLeads)
  const roasReal = calcROAS(dealTotals.won_deal_value > 0 ? dealTotals.won_deal_value : null, totalSpend)
  const roasProjected = calcROAS(dealTotals.total_deal_value > 0 ? dealTotals.total_deal_value : null, totalSpend)

  const byDate: Record<string, { spend: number; leads: number }> = {}
  for (const row of insights) {
    if (!byDate[row.date]) byDate[row.date] = { spend: 0, leads: 0 }
    byDate[row.date].spend += row.spend ?? 0
  }
  for (const row of conversionsDaily) {
    if (!byDate[row.day]) byDate[row.day] = { spend: 0, leads: 0 }
    byDate[row.day].leads += Number(row.leads)
  }

  const chartData = Object.keys(byDate).sort().map(date => {
    const { spend, leads } = byDate[date]
    return {
      date,
      spend: Math.round(spend),
      leads,
      cpl: leads > 0 ? Math.round(spend / leads) : null,
    }
  })

  const periodLabel = `${since} → ${until}`

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
