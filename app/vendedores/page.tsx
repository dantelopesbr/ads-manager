import { createClient } from '@/lib/supabase/server'
import { Nav } from '@/components/nav'
import { DateFilter } from '@/components/date-filter'
import { formatCurrency, formatPercent } from '@/lib/metrics'
import { format, subDays, parseISO } from 'date-fns'
import { getPerformanceVendedorDiario, getMetaVendedorMensal, proportionalMeta } from '@/lib/performance-vendedor'
import { computeVendorScore } from '@/lib/vendor-score'
import {
  getDealMotivoFechamento, isLostReason,
  type LostReason,
} from '@/lib/motivo-fechamento'
import { getLeadCanalVendedor } from '@/lib/lead-canal'
import { getSpeedToLeadVendedor, formatMinutes } from '@/lib/speed-to-lead'
import { bucketDealStage, FUNNEL_STAGES } from '@/lib/deal-stages'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { VendorRankingTable, type VendorRankingRow } from '@/components/vendedores/vendor-ranking-table'
import Link from 'next/link'
import { Suspense } from 'react'
import { getAccountSelection } from '@/lib/account-server'
import { getWhatsappMessages, getTeamPhones, getCalls } from '@/lib/queries'
import { classifyMessage, buildTeamPhoneIndex, normalizePhoneSuffix, KNOWN_VENDORS, IA_VENDORS } from '@/lib/whatsapp-team'
import { ActivityChart } from '@/components/vendedores/activity-chart'
import { getParceiroStatusLog, getResumoDiario, PARCEIRO_ESTAGIOS, PARCEIRO_ESTAGIO_LABELS, type ParceiroEstagio } from '@/lib/atividade-comercial'
import { fetchOwners } from '@/lib/hubspot/client'

export const dynamic = 'force-dynamic'

const SEM_VENDEDOR = 'Sem vendedor'

export default async function VendedoresPage({
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

  const selection = await getAccountSelection()

  const [messages, teamPhones, calls, parceiroStatusLog, hubspotOwners, performanceDiario, metaMensal, resumoDiario, motivoFechamento, leadCanal, speedToLead] = await Promise.all([
    getWhatsappMessages(supabase, since, until),
    getTeamPhones(supabase),
    getCalls(supabase, since, until),
    getParceiroStatusLog(supabase, since, until),
    fetchOwners(process.env.HUBSPOT_API_KEY!).catch(() => []),
    getPerformanceVendedorDiario(supabase, since, until),
    getMetaVendedorMensal(supabase, since, until),
    getResumoDiario(supabase, since, until),
    getDealMotivoFechamento(supabase, since, until),
    getLeadCanalVendedor(supabase, since, until),
    getSpeedToLeadVendedor(supabase, since, until),
  ])

  // Funil de Parceiros por Vendedor precisa refletir o período selecionado
  // (não "hoje") — reduz o log diário ao snapshot mais recente de cada
  // parceiro DENTRO do período, em vez do estado atual fixo.
  const partnerCurrent = [...parceiroStatusLog]
    .sort((a, b) => b.data_snapshot.localeCompare(a.data_snapshot))
    .reduce((acc, row) => {
      if (!acc.seen.has(row.contact_id)) { acc.seen.add(row.contact_id); acc.rows.push(row) }
      return acc
    }, { seen: new Set<string>(), rows: [] as typeof parceiroStatusLog }).rows
  const ownerNameById = Object.fromEntries(hubspotOwners.map(o => [o.id, o.name]))

  const teamIndex = buildTeamPhoneIndex(teamPhones)
  const contactsByVendor: Record<string, Set<string>> = {}
  const messageCountByVendor: Record<string, number> = {}
  const dailyContactsByVendor: Record<string, Record<string, Set<string>>> = {}
  for (const m of messages) {
    const teamLabel = teamIndex.get(normalizePhoneSuffix(m.phone_fratelli) ?? '') ?? null
    const classified = classifyMessage(m.source, teamLabel)
    const bucket = classified.vendor ?? null
    if (!bucket) continue
    if (!contactsByVendor[bucket]) contactsByVendor[bucket] = new Set()
    if (m.phone) contactsByVendor[bucket].add(m.phone)
    messageCountByVendor[bucket] = (messageCountByVendor[bucket] ?? 0) + 1

    // Chart tracks conversations started (distinct contacts/day), not raw message volume.
    const day = m.created_at.split('T')[0]
    if (!dailyContactsByVendor[day]) dailyContactsByVendor[day] = {}
    if (!dailyContactsByVendor[day][bucket]) dailyContactsByVendor[day][bucket] = new Set()
    if (m.phone) dailyContactsByVendor[day][bucket].add(m.phone)
  }
  const messageRows = [...KNOWN_VENDORS, ...IA_VENDORS]
    .map(name => ({ name, contacts: contactsByVendor[name]?.size ?? 0, messages: messageCountByVendor[name] ?? 0 }))
    .sort((a, b) => b.contacts - a.contacts)
  const messagesChartVendors = [...KNOWN_VENDORS, ...IA_VENDORS].filter(v => messageCountByVendor[v] > 0)
  // Fill 0 for every vendor on every day (not just days they have data) — a
  // missing key reads as undefined to Recharts, which breaks the line into
  // isolated dots instead of drawing it through the gap.
  const messagesChartData = Object.keys(dailyContactsByVendor).sort().map(day => {
    const row: { date: string; [vendor: string]: string | number } = { date: day }
    for (const vendor of messagesChartVendors) row[vendor] = dailyContactsByVendor[day][vendor]?.size ?? 0
    return row
  })

  const callContactsByOwner: Record<string, Set<string>> = {}
  const callCountByOwner: Record<string, number> = {}
  const dailyByCallOwner: Record<string, Record<string, number>> = {}
  for (const c of calls) {
    const owner = c.owner_name ?? SEM_VENDEDOR
    if (!callContactsByOwner[owner]) callContactsByOwner[owner] = new Set()
    if (c.phone) callContactsByOwner[owner].add(c.phone)
    callCountByOwner[owner] = (callCountByOwner[owner] ?? 0) + 1

    const day = c.call_at.split('T')[0]
    if (!dailyByCallOwner[day]) dailyByCallOwner[day] = {}
    dailyByCallOwner[day][owner] = (dailyByCallOwner[day][owner] ?? 0) + 1
  }
  const callRows = Object.keys(callContactsByOwner)
    .map(name => ({ name, contacts: callContactsByOwner[name].size, calls: callCountByOwner[name] ?? 0 }))
    .sort((a, b) => b.contacts - a.contacts)
  const callsChartVendors = Object.keys(callContactsByOwner)
  const callsChartData = Object.keys(dailyByCallOwner).sort().map(day => {
    const row: { date: string; [vendor: string]: string | number } = { date: day }
    for (const vendor of callsChartVendors) row[vendor] = dailyByCallOwner[day][vendor] ?? 0
    return row
  })

  // Vendedores conhecidos no período (fonte: canal, que cobre todo mundo com
  // deal criado) — usado pra não deixar quem ficou zerado em algo sumir
  // silenciosamente das tabelas.
  const knownVendorNames = [...new Set(leadCanal.map(r => r.vendedor?.trim()).filter((v): v is string => !!v))]
  const periodLabel = `${since} → ${until}`

  // Funil de vendas por vendedor — estágio de cada deal CRIADO no período
  // selecionado (não "estado atual" fixo), pra reagir ao filtro de data
  // como o resto da página.
  type FunilCounts = Partial<Record<(typeof FUNNEL_STAGES)[number]['bucket'], number>>
  const funilByVendor: Record<string, FunilCounts> = {}
  for (const r of leadCanal) {
    const owner = r.vendedor?.trim() || SEM_VENDEDOR
    const bucket = bucketDealStage(r.dealstage)
    if (bucket === 'Outro') continue
    if (!funilByVendor[owner]) funilByVendor[owner] = {}
    funilByVendor[owner][bucket] = (funilByVendor[owner][bucket] ?? 0) + 1
  }
  const funilVendorTotal = (v: string) => Object.values(funilByVendor[v] ?? {}).reduce((s, n) => s + (n ?? 0), 0)
  const funilVendedorSorted = Object.keys(funilByVendor).sort((a, b) => funilVendorTotal(b) - funilVendorTotal(a))

  // Não retornamos — a única categoria de motivo de perda que fica visível
  // no topo (destaque de ação imediata); o breakdown completo de motivo de
  // perda/ganho/canal virou drill-down por vendedor em /vendedores/[vendedor].
  const naoRetornamosByVendor: Record<string, { naoRetornamos: number; totalLost: number }> = {}
  let totalLost = 0
  let totalNaoRetornamos = 0
  for (const d of motivoFechamento) {
    if (d.dealstage !== 'closedlost') continue
    const owner = d.vendedor?.trim() || SEM_VENDEDOR
    const reason: LostReason | 'outro' = isLostReason(d.closed_lost_reason) ? d.closed_lost_reason : 'outro'
    if (!naoRetornamosByVendor[owner]) naoRetornamosByVendor[owner] = { naoRetornamos: 0, totalLost: 0 }
    naoRetornamosByVendor[owner].totalLost += 1
    totalLost += 1
    if (reason === 'nao_retornamos') {
      naoRetornamosByVendor[owner].naoRetornamos += 1
      totalNaoRetornamos += 1
    }
  }
  const naoRetornamosRateGeral = totalLost > 0 ? totalNaoRetornamos / totalLost : null
  const naoRetornamosVendors = Object.keys(naoRetornamosByVendor)
    .filter(v => naoRetornamosByVendor[v].naoRetornamos > 0)
    .sort((a, b) => naoRetornamosByVendor[b].naoRetornamos - naoRetornamosByVendor[a].naoRetornamos)

  // Tempo de resposta ao lead — mediana ponderada pelo volume de leads do
  // dia (não média simples entre dias, que trataria dia de 1 lead igual a
  // dia de 20). Mediana em vez de média porque a fonte já tem outliers reais
  // grandes (lead esquecido por dias) que distorcem a média sozinhos.
  type SpeedAgg = { leads: number; weightedMedianSum: number; maxDay: { data: string; minutos: number } | null }
  const speedByVendor: Record<string, SpeedAgg> = {}
  for (const r of speedToLead) {
    if (!speedByVendor[r.vendedor]) speedByVendor[r.vendedor] = { leads: 0, weightedMedianSum: 0, maxDay: null }
    const agg = speedByVendor[r.vendedor]
    agg.leads += r.qtd_leads_respondidos
    agg.weightedMedianSum += r.tempo_resposta_mediana_minutos * r.qtd_leads_respondidos
    if (!agg.maxDay || r.tempo_resposta_mediana_minutos > agg.maxDay.minutos) {
      agg.maxDay = { data: r.data, minutos: r.tempo_resposta_mediana_minutos }
    }
  }
  const speedRows = Object.entries(speedByVendor)
    .map(([vendedor, a]) => {
      const medianaPonderada = a.leads > 0 ? a.weightedMedianSum / a.leads : null
      const isOutlier = a.maxDay !== null && medianaPonderada !== null && a.maxDay.minutos > medianaPonderada * 3
      return { vendedor, leads: a.leads, medianaPonderada, maxDay: a.maxDay, isOutlier }
    })
    .sort((a, b) => (a.medianaPonderada ?? Infinity) - (b.medianaPonderada ?? Infinity))

  // Funil de parceiros por vendedor — current stage per partner, grouped by
  // owner (resolved via HubSpot owner_id -> name).
  const partnerFunnelByOwner: Record<string, Partial<Record<ParceiroEstagio, number>>> = {}
  for (const p of partnerCurrent) {
    const owner = (p.owner_id ? ownerNameById[p.owner_id] : null) ?? SEM_VENDEDOR
    if (!partnerFunnelByOwner[owner]) partnerFunnelByOwner[owner] = {}
    partnerFunnelByOwner[owner][p.estagio] = (partnerFunnelByOwner[owner][p.estagio] ?? 0) + 1
  }
  const partnerOwnerTotal = (owner: string) =>
    Object.values(partnerFunnelByOwner[owner] ?? {}).reduce((s, n) => s + (n ?? 0), 0)
  const partnerFunnelOwners = Object.keys(partnerFunnelByOwner).sort(
    (a, b) => partnerOwnerTotal(b) - partnerOwnerTotal(a)
  )

  // Financeiro + meta por vendedor — performance_vendedor_diario (HubSpot
  // closedwon, já confirmado que reflete o Bling) somado no período, cruzado
  // com meta_vendedor_mensal proporcional aos dias do range em cada mês.
  type FinanceAgg = { receita: number; criados: number; ganhos: number }
  const financeByVendor: Record<string, FinanceAgg> = {}
  for (const r of performanceDiario) {
    if (!financeByVendor[r.vendedor]) financeByVendor[r.vendedor] = { receita: 0, criados: 0, ganhos: 0 }
    financeByVendor[r.vendedor].receita += r.receita_fechada
    financeByVendor[r.vendedor].criados += r.deals_criados
    financeByVendor[r.vendedor].ganhos += r.deals_ganhos
  }
  const metaByVendor: Record<string, Record<string, number>> = {}
  for (const m of metaMensal) {
    if (!metaByVendor[m.vendedor]) metaByVendor[m.vendedor] = {}
    metaByVendor[m.vendedor][m.mes] = m.meta_valor
  }

  // Score do vendedor: Meta (peso 50, capado em 100) + Conversão (peso 30, só
  // com >=5 deals criados no período) + Atividade (peso 20, ranking relativo
  // de conversas+ligações dentro do time, mesmo período) — ver lib/vendor-score.
  const activityByVendor: Record<string, number> = {}
  for (const r of resumoDiario) {
    activityByVendor[r.vendedor] = (activityByVendor[r.vendedor] ?? 0) + r.total_conversas_whatsapp + r.total_ligacoes
  }
  const maxActivity = Math.max(0, ...Object.values(activityByVendor))

  const sinceDate = parseISO(since)
  const untilDate = parseISO(until)
  const allVendorNames = new Set([...Object.keys(financeByVendor), ...Object.keys(activityByVendor)])
  const financeRows = [...allVendorNames]
    .map(vendedor => {
      const f = financeByVendor[vendedor] ?? { receita: 0, criados: 0, ganhos: 0 }
      const metaProporcional = proportionalMeta(sinceDate, untilDate, metaByVendor[vendedor] ?? {})
      const activity = activityByVendor[vendedor] ?? 0
      const { score, hasConversaoScore, atingimento } = computeVendorScore({
        receita: f.receita, metaValor: metaProporcional, criados: f.criados, ganhos: f.ganhos, activity, maxActivity,
      })
      return {
        vendedor,
        ...f,
        ticketMedio: f.ganhos > 0 ? f.receita / f.ganhos : null,
        conversao: f.criados > 0 ? f.ganhos / f.criados : null,
        metaProporcional,
        atingimento,
        hasConversaoScore,
        score,
      }
    })
    .sort((a, b) => b.receita - a.receita)

  // KPIs gerais do período — contexto antes de qualquer detalhe por
  // vendedor. Leads/conversão vêm de leadCanal (todos os deals criados no
  // período, fonte mais completa); receita/ticket vêm de performanceDiario
  // (mesma fonte já usada na tabela financeira, pra não ter dois números de
  // receita ligeiramente diferentes na mesma página).
  const totalLeadsGeral = leadCanal.length
  const totalGanhosGeral = leadCanal.filter(r => r.dealstage === 'closedwon').length
  const conversaoGeral = totalLeadsGeral > 0 ? totalGanhosGeral / totalLeadsGeral : null
  const receitaGeral = financeRows.reduce((s, f) => s + f.receita, 0)
  const ganhosPerformanceGeral = financeRows.reduce((s, f) => s + f.ganhos, 0)
  const ticketMedioGeral = ganhosPerformanceGeral > 0 ? receitaGeral / ganhosPerformanceGeral : null
  const speedLeadsGeralTotal = speedToLead.reduce((s, r) => s + r.qtd_leads_respondidos, 0)
  const speedGeralWeightedSum = speedToLead.reduce((s, r) => s + r.tempo_resposta_mediana_minutos * r.qtd_leads_respondidos, 0)
  const tempoRespostaGeral = speedLeadsGeralTotal > 0 ? speedGeralWeightedSum / speedLeadsGeralTotal : null

  // Comparativo entre vendedores — visão central, uma linha por vendedor,
  // juntando financeiro/score (já existentes) + tempo de resposta + taxa de
  // não retornamos, pra não espalhar a mesma pessoa em 3 tabelas diferentes.
  const rankingRows: VendorRankingRow[] = financeRows
    .filter(f => f.vendedor !== SEM_VENDEDOR)
    .map(f => {
      const speed = speedByVendor[f.vendedor]
      const nr = naoRetornamosByVendor[f.vendedor]
      return {
        vendedor: f.vendedor,
        criados: f.criados,
        ganhos: f.ganhos,
        conversao: f.conversao,
        ticketMedio: f.ticketMedio,
        receita: f.receita,
        atingimento: f.atingimento,
        score: f.score,
        hasConversaoScore: f.hasConversaoScore,
        tempoResposta: speed && speed.leads > 0 ? speed.weightedMedianSum / speed.leads : null,
        naoRetornamosRate: nr && nr.totalLost > 0 ? nr.naoRetornamos / nr.totalLost : null,
      }
    })

  return (
    <div className="flex">
      <Nav />
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold">Vendedores</h2>
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
        <p className="text-sm text-slate-500 mb-6">{periodLabel} · {knownVendorNames.length} vendedor{knownVendorNames.length !== 1 ? 'es' : ''}</p>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <KpiCard title="Total de Leads" value={String(totalLeadsGeral)} subtitle="deals criados no período" />
          <KpiCard title="Conversão Geral" value={formatPercent(conversaoGeral)} subtitle={`${totalGanhosGeral} ganhos`} />
          <KpiCard title="Receita Fechada" value={formatCurrency(receitaGeral || null)} />
          <KpiCard title="Ticket Médio" value={ticketMedioGeral !== null ? formatCurrency(ticketMedioGeral) : '—'} />
          <KpiCard title="Tempo de Resposta" value={tempoRespostaGeral !== null ? formatMinutes(tempoRespostaGeral) : '—'} subtitle="mediana ponderada" />
        </div>

        {(naoRetornamosVendors.length > 0 || speedRows.some(s => s.isOutlier)) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
            {naoRetornamosVendors.length > 0 && (
              <div className="bg-amber-50 border border-amber-300 rounded-sm p-4">
                <p className="text-sm font-semibold text-amber-800 mb-1">⚠ Não retornamos — 100% controlável, sem custo de mídia</p>
                <p className="text-xs text-amber-700 mb-3">
                  {totalNaoRetornamos} de {totalLost} perdas ({naoRetornamosRateGeral !== null ? formatPercent(naoRetornamosRateGeral) : '—'}) no
                  período foram por falta de retorno nosso, não por concorrência/preço/mercado.
                </p>
                <div className="flex flex-wrap gap-2">
                  {naoRetornamosVendors.map(v => {
                    const nr = naoRetornamosByVendor[v]
                    const rate = nr.totalLost > 0 ? nr.naoRetornamos / nr.totalLost : null
                    return (
                      <Link key={v} href={`/vendedores/${encodeURIComponent(v)}`} className="text-xs bg-white border border-amber-200 rounded-sm px-2 py-1 text-amber-800 hover:underline">
                        {v}: {nr.naoRetornamos}/{nr.totalLost} ({rate !== null ? formatPercent(rate) : '—'})
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}
            {speedRows.some(s => s.isOutlier) && (
              <div className="bg-red-50 border border-red-300 rounded-sm p-4">
                <p className="text-sm font-semibold text-red-800 mb-1">⚠ Outliers de tempo de resposta</p>
                <p className="text-xs text-red-700 mb-3">Dias isolados que passaram muito da mediana do próprio vendedor — vale conferir caso a caso.</p>
                <div className="flex flex-wrap gap-2">
                  {speedRows.filter(s => s.isOutlier && s.maxDay).map(s => (
                    <Link key={s.vendedor} href={`/vendedores/${encodeURIComponent(s.vendedor)}`} className="text-xs bg-white border border-red-200 rounded-sm px-2 py-1 text-red-800 hover:underline">
                      {s.vendedor}: {formatMinutes(s.maxDay!.minutos)} em {new Date(s.maxDay!.data).toLocaleDateString('pt-BR')}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <h3 className="text-sm font-semibold mt-2 mb-2 text-slate-600">Comparativo entre Vendedores · {periodLabel}</h3>
        <p className="text-xs text-slate-400 mb-4">
          Score = Meta (peso 50, capado em 100) + Conversão (peso 30, só com 5+ deals criados no período) +
          Atividade (peso 20, ranking de conversas+ligações dentro do time) — peso redistribuído quando um
          componente fica de fora. Clica no nome ou em &quot;Ver relatório&quot; pra abrir o detalhe do vendedor
          (motivo de perda/ganho, canal de origem, deals do mês).
        </p>
        <div className="bg-white rounded-sm border p-6">
          <VendorRankingTable rows={rankingRows} />
          <p className="text-[11px] text-slate-400 mt-3">* menos de 5 deals criados no período — conversão fora do score, peso redistribuído entre Meta e Atividade.</p>
        </div>

        <h3 className="text-sm font-semibold mt-8 mb-2 text-slate-600">Funil de Vendas por Vendedor · {periodLabel}</h3>
        <p className="text-xs text-slate-400 mb-4">
          Estágio de cada deal criado no período selecionado — reage ao filtro de data como o resto da página.
        </p>
        <div className="bg-white rounded-sm border p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-slate-500 text-left">
                  <th className="pb-3 pr-4 font-medium">Vendedor</th>
                  {FUNNEL_STAGES.map(s => (
                    <th key={s.bucket} className="pb-3 pr-4 font-medium text-right">{s.bucket}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {funilVendedorSorted.map(vendedor => (
                  <tr key={vendedor} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="py-2.5 pr-4 font-medium">{vendedor}</td>
                    {FUNNEL_STAGES.map(s => (
                      <td key={s.bucket} className={`py-2.5 pr-4 text-right ${s.bucket === 'Orçamento' ? 'font-semibold text-amber-700' : s.bucket === 'Venda Realizada' ? 'font-medium text-emerald-700' : 'text-slate-600'}`}>
                        {funilByVendor[vendedor]?.[s.bucket] ?? 0}
                      </td>
                    ))}
                  </tr>
                ))}
                {funilVendedorSorted.length === 0 && (
                  <tr>
                    <td colSpan={FUNNEL_STAGES.length + 1} className="py-6 text-center text-slate-400 text-sm">Nenhum deal criado no período</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <h3 className="text-sm font-semibold mt-8 mb-2 text-slate-600">Funil de Parceiros por Vendedor · {periodLabel}</h3>
        <p className="text-xs text-slate-400 mb-4">Estágio de cada parceiro ao final do período selecionado, agrupado pelo dono no HubSpot.</p>
        <div className="bg-white rounded-sm border p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-slate-500 text-left">
                  <th className="pb-3 pr-4 font-medium">Vendedor</th>
                  {PARCEIRO_ESTAGIOS.map(estagio => (
                    <th key={estagio} className="pb-3 pr-4 font-medium text-right whitespace-nowrap">{PARCEIRO_ESTAGIO_LABELS[estagio]}</th>
                  ))}
                  <th className="pb-3 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {partnerFunnelOwners.map(owner => (
                  <tr key={owner} className="border-b last:border-0 hover:bg-slate-50">
                    <td className={`py-2.5 pr-4 ${owner === SEM_VENDEDOR ? 'text-slate-400 font-normal' : 'font-medium'}`}>{owner}</td>
                    {PARCEIRO_ESTAGIOS.map(estagio => (
                      <td key={estagio} className="py-2.5 pr-4 text-right text-slate-600">
                        {partnerFunnelByOwner[owner][estagio] ?? 0}
                      </td>
                    ))}
                    <td className="py-2.5 text-right font-medium">{partnerOwnerTotal(owner)}</td>
                  </tr>
                ))}
                {partnerFunnelOwners.length === 0 && (
                  <tr>
                    <td colSpan={PARCEIRO_ESTAGIOS.length + 2} className="py-6 text-center text-slate-400 text-sm">Nenhum parceiro rastreado</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <h3 className="text-sm font-semibold mt-8 mb-2 text-slate-600">WhatsApp · {periodLabel}</h3>
        <p className="text-xs text-slate-400 mb-4">Disponível apenas para Fratelli House — FratelliRev ainda não tem esse dado. Vendedor identificado pelo número que atendeu a conversa (não pelo texto da mensagem).</p>
        <div className="bg-white rounded-sm border p-6 max-w-md">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-slate-500 text-left">
                <th className="pb-3 pr-4 font-medium">Vendedor</th>
                <th className="pb-3 pr-4 font-medium text-right">Contatos</th>
                <th className="pb-3 font-medium text-right">Mensagens</th>
              </tr>
            </thead>
            <tbody>
              {messageRows.map(m => (
                <tr key={m.name} className="border-b last:border-0 hover:bg-slate-50">
                  <td className={`py-2.5 pr-4 ${(IA_VENDORS as readonly string[]).includes(m.name) ? 'text-slate-400' : 'font-medium'}`}>{m.name}</td>
                  <td className="py-2.5 pr-4 text-right">{m.contacts}</td>
                  <td className="py-2.5 text-right text-slate-500">{m.messages}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {messagesChartData.length > 0 && (
          <div className="bg-white rounded-sm border p-6 mt-6">
            <h4 className="text-sm font-semibold mb-4 text-slate-600">Conversas iniciadas por dia (contatos distintos)</h4>
            <ActivityChart data={messagesChartData} vendors={messagesChartVendors} target={35} />
          </div>
        )}

        <h3 className="text-sm font-semibold mt-8 mb-2 text-slate-600">Ligações · {periodLabel}</h3>
        <div className="bg-white rounded-sm border p-6 max-w-md">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-slate-500 text-left">
                <th className="pb-3 pr-4 font-medium">Vendedor</th>
                <th className="pb-3 pr-4 font-medium text-right">Contatos</th>
                <th className="pb-3 font-medium text-right">Ligações</th>
              </tr>
            </thead>
            <tbody>
              {callRows.map(c => (
                <tr key={c.name} className="border-b last:border-0 hover:bg-slate-50">
                  <td className={`py-2.5 pr-4 ${c.name === SEM_VENDEDOR ? 'text-slate-400 font-normal' : 'font-medium'}`}>{c.name}</td>
                  <td className="py-2.5 pr-4 text-right">{c.contacts}</td>
                  <td className="py-2.5 text-right text-slate-500">{c.calls}</td>
                </tr>
              ))}
              {callRows.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-slate-400 text-sm">Nenhuma ligação no período</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {callsChartData.length > 0 && (
          <div className="bg-white rounded-sm border p-6 mt-6">
            <h4 className="text-sm font-semibold mb-4 text-slate-600">Ligações por dia</h4>
            <ActivityChart data={callsChartData} vendors={callsChartVendors} target={20} />
          </div>
        )}
      </main>
    </div>
  )
}
