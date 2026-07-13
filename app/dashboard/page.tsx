import { createClient } from '@/lib/supabase/server'
import { Nav } from '@/components/nav'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { PerformanceChart } from '@/components/dashboard/performance-chart'
import { DateFilter } from '@/components/date-filter'
import { calcCPL, calcROAS, formatCurrency, formatROAS, formatPercent } from '@/lib/metrics'
import { format, subDays, differenceInCalendarDays, parseISO } from 'date-fns'
import { Suspense } from 'react'
import { getAccountSelection } from '@/lib/account-server'
import { ACCOUNT_KEYS, type AccountKey } from '@/lib/account'
import {
  getDashboardPeriodData,
  type DailySpend, type DailyLeads, type DealTotals,
} from '@/lib/queries'

export const dynamic = 'force-dynamic'

function summarize(insights: DailySpend[], conversionsDaily: DailyLeads[], dealTotals: DealTotals) {
  const totalSpend = insights.reduce((s, r) => s + (r.spend ?? 0), 0)
  const totalLeads = conversionsDaily.reduce((s, r) => s + Number(r.leads), 0)
  const cpl = calcCPL(totalSpend, totalLeads)
  const roasReal = calcROAS(dealTotals.won_deal_value > 0 ? dealTotals.won_deal_value : null, totalSpend)
  const roasProjected = calcROAS(dealTotals.total_deal_value > 0 ? dealTotals.total_deal_value : null, totalSpend)
  const conversionRate = totalLeads > 0 ? dealTotals.deal_count / totalLeads : null
  return { totalSpend, totalLeads, cpl, roasReal, roasProjected, conversionRate }
}

function calcDelta(curr: number | null, prev: number | null): number | null {
  if (curr === null || prev === null || prev === 0) return null
  return ((curr - prev) / prev) * 100
}

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

  // Previous period: same length, immediately preceding `since`.
  const periodDays = differenceInCalendarDays(parseISO(until), parseISO(since)) + 1
  const prevUntil = format(subDays(parseISO(since), 1), 'yyyy-MM-dd')
  const prevSince = format(subDays(parseISO(prevUntil), periodDays - 1), 'yyyy-MM-dd')

  const selection = await getAccountSelection()
  const accountKeys: AccountKey[] = selection === 'all' ? ACCOUNT_KEYS : [selection]

  const [current, previous] = await Promise.all([
    getDashboardPeriodData(supabase, accountKeys, since, until),
    getDashboardPeriodData(supabase, accountKeys, prevSince, prevUntil),
  ])
  const { insights, conversionsDaily, dealTotals } = current

  const curr = summarize(current.insights, current.conversionsDaily, current.dealTotals)
  const prev = summarize(previous.insights, previous.conversionsDaily, previous.dealTotals)
  const { totalSpend, totalLeads, cpl, roasReal, roasProjected, conversionRate } = curr

  const spendDelta = calcDelta(curr.totalSpend, prev.totalSpend)
  const leadsDelta = calcDelta(curr.totalLeads, prev.totalLeads)
  const cplDelta = calcDelta(curr.cpl, prev.cpl)
  const roasRealDelta = calcDelta(curr.roasReal, prev.roasReal)
  const roasProjectedDelta = calcDelta(curr.roasProjected, prev.roasProjected)
  const conversionDelta = calcDelta(curr.conversionRate, prev.conversionRate)

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
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold">Dashboard</h2>
            {selection === 'all' && (
              <span className="text-xs font-medium text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
                Todas as contas
              </span>
            )}
          </div>
          <Suspense fallback={null}>
            <DateFilter from={since ?? ''} to={until} />
          </Suspense>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
          <KpiCard title="Total Spend" value={formatCurrency(totalSpend)} subtitle={periodLabel} delta={spendDelta} positiveIsGood={false} />
          <KpiCard title="Leads" value={String(totalLeads)} subtitle={periodLabel} delta={leadsDelta} />
          <KpiCard title="CPL" value={formatCurrency(cpl)} delta={cplDelta} positiveIsGood={false} />
          <KpiCard title="Lead → Deal" value={formatPercent(conversionRate)} subtitle={`${dealTotals.deal_count} de ${totalLeads} leads`} delta={conversionDelta} />
          <KpiCard title="ROAS Real" value={formatROAS(roasReal)} subtitle="deals fechados (won)" delta={roasRealDelta} />
          <KpiCard title="ROAS Projetado" value={formatROAS(roasProjected)} subtitle="todos os deals" delta={roasProjectedDelta} />
        </div>
        <p className="text-xs text-slate-400 -mt-6 mb-6">vs. período anterior ({prevSince} → {prevUntil})</p>
        <div className="bg-white rounded-xl border p-6">
          <h3 className="text-sm font-semibold mb-4 text-slate-600">Leads + Spend · {periodLabel}</h3>
          <PerformanceChart data={chartData} />
        </div>
      </main>
    </div>
  )
}
