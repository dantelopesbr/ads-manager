import { createClient } from '@/lib/supabase/server'
import { Nav } from '@/components/nav'
import { DateFilter } from '@/components/date-filter'
import { formatCurrency, formatPercent } from '@/lib/metrics'
import { format, subDays, parseISO } from 'date-fns'
import { getPerformanceVendedorDiario, getMetaVendedorMensal, proportionalMeta, getFunilVendedorAtual } from '@/lib/performance-vendedor'
import { Suspense } from 'react'
import { getAccountSelection } from '@/lib/account-server'
import { ACCOUNT_KEYS, type AccountKey } from '@/lib/account'
import { getOwnerBreakdown, getWhatsappMessages, getTeamPhones, getCalls } from '@/lib/queries'
import { classifyMessage, buildTeamPhoneIndex, normalizePhoneSuffix, KNOWN_VENDORS, IA_VENDORS } from '@/lib/whatsapp-team'
import { ActivityChart } from '@/components/vendedores/activity-chart'
import { getPartnerCurrentStatus, getResumoDiario, PARCEIRO_ESTAGIOS, PARCEIRO_ESTAGIO_LABELS, type ParceiroEstagio } from '@/lib/atividade-comercial'
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
  const accountKeys: AccountKey[] = selection === 'all' ? ACCOUNT_KEYS : [selection]

  const [rows, messages, teamPhones, calls, partnerCurrent, hubspotOwners, performanceDiario, metaMensal, funilVendedor, resumoDiario] = await Promise.all([
    getOwnerBreakdown(supabase, accountKeys, since, until),
    getWhatsappMessages(supabase, since, until),
    getTeamPhones(supabase),
    getCalls(supabase, since, until),
    getPartnerCurrentStatus(supabase),
    fetchOwners(process.env.HUBSPOT_API_KEY!).catch(() => []),
    getPerformanceVendedorDiario(supabase, since, until),
    getMetaVendedorMensal(supabase, since, until),
    getFunilVendedorAtual(supabase),
    getResumoDiario(supabase, since, until),
  ])
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

  type OwnerAgg = { leads: number; deals: number; won: number; valueProjected: number; valueWon: number }
  const byOwner: Record<string, OwnerAgg> = {}
  for (const r of rows) {
    const owner = r.owner_name ?? SEM_VENDEDOR
    if (!byOwner[owner]) byOwner[owner] = { leads: 0, deals: 0, won: 0, valueProjected: 0, valueWon: 0 }
    byOwner[owner].leads += 1
    if (r.deal_stage) byOwner[owner].deals += 1
    if (r.deal_value_won) byOwner[owner].won += 1
    byOwner[owner].valueProjected += r.deal_value ?? 0
    byOwner[owner].valueWon += r.deal_value_won ?? 0
  }

  const owners = Object.entries(byOwner)
    .map(([name, a]) => ({
      name,
      ...a,
      closingRate: a.deals > 0 ? a.won / a.deals : null,
    }))
    .sort((a, b) => b.valueWon - a.valueWon)

  const totalLeads = owners.reduce((s, o) => s + o.leads, 0)
  const periodLabel = `${since} → ${until}`

  // Funil de vendas por vendedor — current count per stage, straight from
  // HubSpot deals_raw via the BigQuery pipeline (see getFunilVendedorAtual).
  const funilVendedorTotal = (r: (typeof funilVendedor)[number]) =>
    r.lead + r.orcamento + r.venda_realizada + r.venda_perdida + r.inativo
  const funilVendedorSorted = [...funilVendedor].sort((a, b) => funilVendedorTotal(b) - funilVendedorTotal(a))

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
  // de conversas+ligações dentro do time, mesmo período). Componente
  // indisponível sai da conta e os pesos restantes são renormalizados —
  // weightedScore faz isso automaticamente dividindo pela soma dos pesos
  // presentes, em vez de fixar percentuais por caso.
  const activityByVendor: Record<string, number> = {}
  for (const r of resumoDiario) {
    activityByVendor[r.vendedor] = (activityByVendor[r.vendedor] ?? 0) + r.total_conversas_whatsapp + r.total_ligacoes
  }
  const maxActivity = Math.max(0, ...Object.values(activityByVendor))

  function weightedScore(components: { score: number | null; weight: number }[]): number | null {
    const available = components.filter((c): c is { score: number; weight: number } => c.score !== null)
    if (available.length === 0) return null
    const totalWeight = available.reduce((s, c) => s + c.weight, 0)
    return available.reduce((s, c) => s + c.score * c.weight, 0) / totalWeight
  }

  const sinceDate = parseISO(since)
  const untilDate = parseISO(until)
  const allVendorNames = new Set([...Object.keys(financeByVendor), ...Object.keys(activityByVendor)])
  const financeRows = [...allVendorNames]
    .map(vendedor => {
      const f = financeByVendor[vendedor] ?? { receita: 0, criados: 0, ganhos: 0 }
      const metaProporcional = proportionalMeta(sinceDate, untilDate, metaByVendor[vendedor] ?? {})
      const atingimento = metaProporcional !== null && metaProporcional > 0 ? f.receita / metaProporcional : null
      const activity = activityByVendor[vendedor] ?? 0
      const metaScore = atingimento !== null ? Math.min(100, atingimento * 100) : null
      const hasConversaoScore = f.criados >= 5
      const conversaoScore = hasConversaoScore ? (f.ganhos / f.criados) * 100 : null
      const activityScore = maxActivity > 0 ? (activity / maxActivity) * 100 : 0
      const score = weightedScore([
        { score: metaScore, weight: 50 },
        { score: conversaoScore, weight: 30 },
        { score: activityScore, weight: 20 },
      ])
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
        <p className="text-sm text-slate-500 mb-6">{periodLabel} · {totalLeads} leads · {owners.length} vendedor{owners.length !== 1 ? 'es' : ''}</p>

        <div className="bg-white rounded-xl border p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-slate-500 text-left">
                  <th className="pb-3 pr-4 font-medium">Vendedor</th>
                  <th className="pb-3 pr-4 font-medium text-right">Leads</th>
                  <th className="pb-3 pr-4 font-medium text-right">Deals</th>
                  <th className="pb-3 pr-4 font-medium text-right">Taxa Fechamento</th>
                  <th className="pb-3 pr-4 font-medium text-right">Valor Projetado</th>
                  <th className="pb-3 font-medium text-right">Valor Fechado</th>
                </tr>
              </thead>
              <tbody>
                {owners.map(o => (
                  <tr key={o.name} className="border-b hover:bg-slate-50">
                    <td className={`py-3 pr-4 font-medium ${o.name === SEM_VENDEDOR ? 'text-slate-400 font-normal' : ''}`}>
                      {o.name}
                    </td>
                    <td className="py-3 pr-4 text-right">{o.leads}</td>
                    <td className="py-3 pr-4 text-right">{o.deals}</td>
                    <td className="py-3 pr-4 text-right">{formatPercent(o.closingRate)}</td>
                    <td className="py-3 pr-4 text-right">{formatCurrency(o.valueProjected || null)}</td>
                    <td className="py-3 text-right font-medium text-emerald-700">{formatCurrency(o.valueWon || null)}</td>
                  </tr>
                ))}
                {owners.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 text-sm">Nenhum lead no período</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <h3 className="text-sm font-semibold mt-8 mb-2 text-slate-600">Financeiro por Vendedor · {periodLabel}</h3>
        <p className="text-xs text-slate-400 mb-4">
          Receita fechada via HubSpot (closedwon) · meta proporcional aos dias do período dentro de cada mês.
          Score = Meta (peso 50, capado em 100) + Conversão (peso 30, só com 5+ deals criados no período) +
          Atividade (peso 20, ranking de conversas+ligações dentro do time) — peso redistribuído quando um
          componente fica de fora.
        </p>
        <div className="bg-white rounded-xl border p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-slate-500 text-left">
                  <th className="pb-3 pr-4 font-medium">Vendedor</th>
                  <th className="pb-3 pr-4 font-medium text-right">Deals Criados</th>
                  <th className="pb-3 pr-4 font-medium text-right">Deals Ganhos</th>
                  <th className="pb-3 pr-4 font-medium text-right">Conversão</th>
                  <th className="pb-3 pr-4 font-medium text-right">Ticket Médio</th>
                  <th className="pb-3 pr-4 font-medium text-right">Receita Fechada</th>
                  <th className="pb-3 pr-4 font-medium text-right">Meta (proporcional)</th>
                  <th className="pb-3 pr-4 font-medium text-right">Atingimento</th>
                  <th className="pb-3 font-medium text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {financeRows.map(f => (
                  <tr key={f.vendedor} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="py-2.5 pr-4 font-medium">{f.vendedor}</td>
                    <td className="py-2.5 pr-4 text-right">{f.criados}</td>
                    <td className="py-2.5 pr-4 text-right">{f.ganhos}</td>
                    <td className="py-2.5 pr-4 text-right">{formatPercent(f.conversao)}</td>
                    <td className="py-2.5 pr-4 text-right">{f.ticketMedio !== null ? formatCurrency(f.ticketMedio) : '—'}</td>
                    <td className="py-2.5 pr-4 text-right font-medium text-emerald-700">{formatCurrency(f.receita || null)}</td>
                    <td className="py-2.5 pr-4 text-right text-slate-500">
                      {f.metaProporcional !== null ? formatCurrency(f.metaProporcional) : 'meta não definida'}
                    </td>
                    <td className="py-2.5 pr-4 text-right font-medium">
                      {f.atingimento !== null ? formatPercent(f.atingimento) : '—'}
                    </td>
                    <td className="py-2.5 text-right font-semibold">
                      {f.score !== null ? f.score.toFixed(0) : '—'}
                      {!f.hasConversaoScore && f.score !== null && <span className="text-slate-400 font-normal">*</span>}
                    </td>
                  </tr>
                ))}
                {financeRows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-6 text-center text-slate-400 text-sm">Sem dado financeiro no período</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-slate-400 mt-3">* menos de 5 deals criados no período — conversão fora do score, peso redistribuído entre Meta e Atividade.</p>
        </div>

        <h3 className="text-sm font-semibold mt-8 mb-2 text-slate-600">Funil de Vendas por Vendedor</h3>
        <p className="text-xs text-slate-400 mb-4">
          Estado atual (não filtrado por período) — quantos negócios estão em cada estágio hoje, contados
          direto do HubSpot (via BigQuery), não do filtro de data acima.
        </p>
        <div className="bg-white rounded-xl border p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-slate-500 text-left">
                  <th className="pb-3 pr-4 font-medium">Vendedor</th>
                  <th className="pb-3 pr-4 font-medium text-right">Lead</th>
                  <th className="pb-3 pr-4 font-medium text-right">Inativo</th>
                  <th className="pb-3 pr-4 font-medium text-right">Orçamento</th>
                  <th className="pb-3 pr-4 font-medium text-right">Venda Realizada</th>
                  <th className="pb-3 font-medium text-right">Venda Perdida</th>
                </tr>
              </thead>
              <tbody>
                {funilVendedorSorted.map(f => (
                  <tr key={f.vendedor} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="py-2.5 pr-4 font-medium">{f.vendedor}</td>
                    <td className="py-2.5 pr-4 text-right text-slate-600">{f.lead}</td>
                    <td className="py-2.5 pr-4 text-right text-slate-600">{f.inativo}</td>
                    <td className="py-2.5 pr-4 text-right font-semibold text-amber-700">{f.orcamento}</td>
                    <td className="py-2.5 pr-4 text-right font-medium text-emerald-700">{f.venda_realizada}</td>
                    <td className="py-2.5 text-right text-slate-600">{f.venda_perdida}</td>
                  </tr>
                ))}
                {funilVendedorSorted.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400 text-sm">Sem dado de funil ainda</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <h3 className="text-sm font-semibold mt-8 mb-2 text-slate-600">Funil de Parceiros por Vendedor</h3>
        <p className="text-xs text-slate-400 mb-4">Estado atual dos parceiros (últimos 35 dias), agrupado pelo dono no HubSpot.</p>
        <div className="bg-white rounded-xl border p-6">
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
        <div className="bg-white rounded-xl border p-6 max-w-md">
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
          <div className="bg-white rounded-xl border p-6 mt-6">
            <h4 className="text-sm font-semibold mb-4 text-slate-600">Conversas iniciadas por dia (contatos distintos)</h4>
            <ActivityChart data={messagesChartData} vendors={messagesChartVendors} target={35} />
          </div>
        )}

        <h3 className="text-sm font-semibold mt-8 mb-2 text-slate-600">Ligações · {periodLabel}</h3>
        <div className="bg-white rounded-xl border p-6 max-w-md">
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
          <div className="bg-white rounded-xl border p-6 mt-6">
            <h4 className="text-sm font-semibold mb-4 text-slate-600">Ligações por dia</h4>
            <ActivityChart data={callsChartData} vendors={callsChartVendors} target={20} />
          </div>
        )}
      </main>
    </div>
  )
}
