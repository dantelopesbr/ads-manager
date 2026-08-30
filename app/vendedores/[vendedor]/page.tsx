import { createClient } from '@/lib/supabase/server'
import { SupabaseClient } from '@supabase/supabase-js'
import { Nav } from '@/components/nav'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { formatCurrency, formatPercent, calcDelta } from '@/lib/metrics'
import { format, parseISO, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { getPerformanceVendedorDiario, getMetaVendedorMensal } from '@/lib/performance-vendedor'
import { getResumoDiario } from '@/lib/atividade-comercial'
import { computeVendorScore } from '@/lib/vendor-score'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

function monthRange(mes: string) {
  const start = parseISO(`${mes}-01`)
  return { start: format(start, 'yyyy-MM-dd'), end: format(endOfMonth(start), 'yyyy-MM-dd') }
}

async function summarizeMonth(supabase: SupabaseClient, vendedor: string, mes: string) {
  const { start, end } = monthRange(mes)
  const [performance, meta, resumo] = await Promise.all([
    getPerformanceVendedorDiario(supabase, start, end),
    getMetaVendedorMensal(supabase, start, end),
    getResumoDiario(supabase, start, end),
  ])

  const mine = performance.filter(r => r.vendedor === vendedor)
  const receita = mine.reduce((s, r) => s + r.receita_fechada, 0)
  const criados = mine.reduce((s, r) => s + r.deals_criados, 0)
  const ganhos = mine.reduce((s, r) => s + r.deals_ganhos, 0)

  const metaValor = meta.find(m => m.vendedor === vendedor && m.mes === start)?.meta_valor ?? null

  const activityByVendor: Record<string, number> = {}
  for (const r of resumo) {
    activityByVendor[r.vendedor] = (activityByVendor[r.vendedor] ?? 0) + r.total_conversas_whatsapp + r.total_ligacoes
  }
  const activity = activityByVendor[vendedor] ?? 0
  const maxActivity = Math.max(0, ...Object.values(activityByVendor))

  const { score, hasConversaoScore, atingimento } = computeVendorScore({ receita, metaValor, criados, ganhos, activity, maxActivity })

  return {
    receita, criados, ganhos, metaValor, activity,
    conversao: criados > 0 ? ganhos / criados : null,
    ticketMedio: ganhos > 0 ? receita / ganhos : null,
    score, hasConversaoScore, atingimento,
  }
}

export default async function VendorReportPage({
  params, searchParams,
}: {
  params: Promise<{ vendedor: string }>
  searchParams: Promise<{ mes?: string }>
}) {
  const supabase = await createClient()
  const { vendedor: vendedorParam } = await params
  const vendedor = decodeURIComponent(vendedorParam)
  const { mes: mesParam } = await searchParams

  const defaultMes = format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM')
  const mes = mesParam ?? defaultMes
  const prevMes = format(subMonths(parseISO(`${mes}-01`), 1), 'yyyy-MM')
  const nextMes = format(addMonths(parseISO(`${mes}-01`), 1), 'yyyy-MM')
  const mesLabel = format(parseISO(`${mes}-01`), 'MMMM yyyy', { locale: ptBR })

  const [curr, prev] = await Promise.all([
    summarizeMonth(supabase, vendedor, mes),
    summarizeMonth(supabase, vendedor, prevMes),
  ])

  const deltaReceita = calcDelta(curr.receita, prev.receita)
  const deltaCriados = calcDelta(curr.criados, prev.criados)
  const deltaConversao = calcDelta(curr.conversao, prev.conversao)
  const deltaScore = calcDelta(curr.score, prev.score)
  const deltaAtingimento = calcDelta(curr.atingimento, prev.atingimento)

  return (
    <div className="flex">
      <Nav />
      <main className="flex-1 p-8">
        <Link href="/vendedores" className="text-xs text-slate-400 hover:underline">← Vendedores</Link>
        <div className="flex items-center justify-between mt-1 mb-2">
          <h2 className="text-2xl font-bold">{vendedor}</h2>
          <div className="flex items-center gap-3 text-sm">
            <Link
              href={`/vendedores/${encodeURIComponent(vendedor)}?mes=${prevMes}`}
              className="px-3 py-1.5 border rounded-sm hover:bg-slate-50 text-slate-600"
            >
              ← Mês anterior
            </Link>
            <span className="font-medium capitalize w-32 text-center">{mesLabel}</span>
            <Link
              href={`/vendedores/${encodeURIComponent(vendedor)}?mes=${nextMes}`}
              className="px-3 py-1.5 border rounded-sm hover:bg-slate-50 text-slate-600"
            >
              Mês seguinte →
            </Link>
          </div>
        </div>
        <p className="text-sm text-slate-500 mb-6">Relatório de desempenho · mês fechado</p>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <KpiCard title="Meta" value={curr.metaValor !== null ? formatCurrency(curr.metaValor) : 'não definida'} />
          <KpiCard
            title="Realizado" value={formatCurrency(curr.receita || null)} delta={deltaReceita}
            subtitle={`${curr.ganhos} venda${curr.ganhos !== 1 ? 's' : ''} fechada${curr.ganhos !== 1 ? 's' : ''}`}
          />
          <KpiCard title="Atingimento" value={curr.atingimento !== null ? formatPercent(curr.atingimento) : '—'} delta={deltaAtingimento} />
          <KpiCard title="Orçamentos" value={String(curr.criados)} delta={deltaCriados} subtitle="deals criados no mês" />
          <KpiCard
            title="Conversão" value={formatPercent(curr.conversao)} delta={deltaConversao}
            subtitle={!curr.hasConversaoScore ? 'volume baixo (<5 deals)' : undefined}
          />
          <KpiCard
            title="Score" value={curr.score !== null ? curr.score.toFixed(0) : '—'} delta={deltaScore}
            subtitle={!curr.hasConversaoScore ? 'sem componente de conversão' : undefined}
          />
        </div>
      </main>
    </div>
  )
}
