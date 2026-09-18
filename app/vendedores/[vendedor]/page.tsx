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
import { getDealMotivoFechamento } from '@/lib/motivo-fechamento'
import { getLeadCanalVendedor, isInstagramLead } from '@/lib/lead-canal'
import { DealMotivoList } from '@/components/vendedores/deal-motivo-list'
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

  // Atividade real de prospecção/relacionamento — o que o vendedor de fato
  // executou no mês, separado de cliente vs. parceiro (fornecedor já
  // excluído na fonte). Mostrado explicitamente, não só embutido no Score.
  const meusResumos = resumo.filter(r => r.vendedor === vendedor)
  const conversasCliente = meusResumos.reduce((s, r) => s + r.total_conversas_cliente, 0)
  const conversasParceiro = meusResumos.reduce((s, r) => s + r.total_conversas_parceiro, 0)
  const ligacoesCliente = meusResumos.reduce((s, r) => s + r.total_ligacoes_cliente, 0)
  const ligacoesParceiro = meusResumos.reduce((s, r) => s + r.total_ligacoes_parceiro, 0)

  return {
    receita, criados, ganhos, metaValor, activity,
    conversao: criados > 0 ? ganhos / criados : null,
    ticketMedio: ganhos > 0 ? receita / ganhos : null,
    score, hasConversaoScore, atingimento,
    conversasCliente, conversasParceiro, ligacoesCliente, ligacoesParceiro,
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

  const { start: mesStart, end: mesEnd } = monthRange(mes)
  const [curr, prev, motivoFechamento, leadCanal] = await Promise.all([
    summarizeMonth(supabase, vendedor, mes),
    summarizeMonth(supabase, vendedor, prevMes),
    getDealMotivoFechamento(supabase, mesStart, mesEnd),
    getLeadCanalVendedor(supabase, mesStart, mesEnd),
  ])
  const meusDeals = motivoFechamento.filter(d => (d.vendedor?.trim() || null) === vendedor)
  const meusLeadsCanal = leadCanal.filter(d => (d.vendedor?.trim() || null) === vendedor)

  // Canal de origem dos leads desse vendedor no mês — mesmo cruzamento que
  // já existia na visão geral, agora como detalhe de um vendedor por vez.
  type CanalAgg = { leads: number; ganhos: number; receita: number }
  const canalStats: Record<string, CanalAgg> = {}
  for (const r of meusLeadsCanal) {
    const canal = r.origem_do_lead ?? 'Sem origem'
    if (!canalStats[canal]) canalStats[canal] = { leads: 0, ganhos: 0, receita: 0 }
    canalStats[canal].leads += 1
    if (r.dealstage === 'closedwon') {
      canalStats[canal].ganhos += 1
      canalStats[canal].receita += r.amount ?? 0
    }
  }
  const canalRows = Object.entries(canalStats)
    .map(([canal, c]) => ({
      canal, ...c,
      conversao: c.leads > 0 ? c.ganhos / c.leads : null,
      ticketMedio: c.ganhos > 0 ? c.receita / c.ganhos : null,
    }))
    .sort((a, b) => b.leads - a.leads)

  const instagramLeads = meusLeadsCanal.filter(isInstagramLead)
  const instagramGanhos = instagramLeads.filter(r => r.dealstage === 'closedwon').length

  const deltaReceita = calcDelta(curr.receita, prev.receita)
  const deltaCriados = calcDelta(curr.criados, prev.criados)
  const deltaConversao = calcDelta(curr.conversao, prev.conversao)
  const deltaScore = calcDelta(curr.score, prev.score)
  const deltaAtingimento = calcDelta(curr.atingimento, prev.atingimento)
  const deltaConversasCliente = calcDelta(curr.conversasCliente, prev.conversasCliente)
  const deltaConversasParceiro = calcDelta(curr.conversasParceiro, prev.conversasParceiro)
  const deltaLigacoesCliente = calcDelta(curr.ligacoesCliente, prev.ligacoesCliente)
  const deltaLigacoesParceiro = calcDelta(curr.ligacoesParceiro, prev.ligacoesParceiro)

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

        <h3 className="text-sm font-semibold mb-1 text-slate-600">Atividade — o que foi executado</h3>
        <p className="text-xs text-slate-400 mb-4">Conversas iniciadas e ligações no mês, separadas de cliente e parceiro (fornecedor não conta).</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Conversas · Clientes" value={String(curr.conversasCliente)} delta={deltaConversasCliente} />
          <KpiCard title="Conversas · Parceiros" value={String(curr.conversasParceiro)} delta={deltaConversasParceiro} />
          <KpiCard title="Ligações · Clientes" value={String(curr.ligacoesCliente)} delta={deltaLigacoesCliente} />
          <KpiCard title="Ligações · Parceiros" value={String(curr.ligacoesParceiro)} delta={deltaLigacoesParceiro} />
        </div>

        <h3 className="text-sm font-semibold mb-1 text-slate-600 mt-8">Deals por Motivo — {mesLabel}</h3>
        <p className="text-xs text-slate-400 mb-4">Vendas ganhas e perdidas do mês, agrupadas por motivo — clica pra ver os deals de cada categoria.</p>
        <DealMotivoList deals={meusDeals} />

        <h3 className="text-sm font-semibold mb-1 text-slate-600 mt-8">Canal de Origem — {mesLabel}</h3>
        <p className="text-xs text-slate-400 mb-4">
          Leads criados no mês por origem_do_lead.
          {instagramLeads.length > 0 && ` ${instagramLeads.length} vieram do Instagram (${instagramGanhos} ganhos).`}
        </p>
        <div className="bg-white rounded-sm border p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-slate-500 text-left">
                  <th className="pb-3 pr-4 font-medium">Canal</th>
                  <th className="pb-3 pr-4 font-medium text-right">Leads</th>
                  <th className="pb-3 pr-4 font-medium text-right">Ganhos</th>
                  <th className="pb-3 pr-4 font-medium text-right">Conversão</th>
                  <th className="pb-3 pr-4 font-medium text-right">Ticket Médio</th>
                  <th className="pb-3 font-medium text-right">Receita</th>
                </tr>
              </thead>
              <tbody>
                {canalRows.map(c => (
                  <tr key={c.canal} className={`border-b last:border-0 hover:bg-slate-50 ${c.canal === 'Cliente Instagram' ? 'bg-violet-50/50' : ''}`}>
                    <td className="py-2.5 pr-4 font-medium">{c.canal}</td>
                    <td className="py-2.5 pr-4 text-right">{c.leads}</td>
                    <td className="py-2.5 pr-4 text-right">{c.ganhos}</td>
                    <td className="py-2.5 pr-4 text-right">{formatPercent(c.conversao)}</td>
                    <td className="py-2.5 pr-4 text-right">{c.ticketMedio !== null ? formatCurrency(c.ticketMedio) : '—'}</td>
                    <td className="py-2.5 text-right font-medium text-emerald-700">{formatCurrency(c.receita || null)}</td>
                  </tr>
                ))}
                {canalRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400 text-sm">Sem lead no período</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
