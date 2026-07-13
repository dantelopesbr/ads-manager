import { createClient } from '@/lib/supabase/server'
import { Nav } from '@/components/nav'
import { DateFilter } from '@/components/date-filter'
import { formatCurrency, formatPercent } from '@/lib/metrics'
import { format, subDays } from 'date-fns'
import { Suspense } from 'react'
import { getAccountSelection } from '@/lib/account-server'
import { ACCOUNT_KEYS, type AccountKey } from '@/lib/account'
import { getOwnerBreakdown, getWhatsappMessages, getTeamPhones } from '@/lib/queries'
import { classifyMessage, buildTeamPhoneIndex, normalizePhoneSuffix, KNOWN_VENDORS, IA_VENDORS } from '@/lib/whatsapp-team'
import { MessagesChart } from '@/components/vendedores/messages-chart'

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

  const [rows, messages, teamPhones] = await Promise.all([
    getOwnerBreakdown(supabase, accountKeys, since, until),
    getWhatsappMessages(supabase, since, until),
    getTeamPhones(supabase),
  ])

  const teamIndex = buildTeamPhoneIndex(teamPhones)
  const contactsByVendor: Record<string, Set<string>> = {}
  const messageCountByVendor: Record<string, number> = {}
  const dailyByVendor: Record<string, Record<string, number>> = {}
  for (const m of messages) {
    const teamLabel = teamIndex.get(normalizePhoneSuffix(m.phone_fratelli) ?? '') ?? null
    const classified = classifyMessage(m.source, teamLabel)
    const bucket = classified.vendor ?? null
    if (!bucket) continue
    if (!contactsByVendor[bucket]) contactsByVendor[bucket] = new Set()
    if (m.phone) contactsByVendor[bucket].add(m.phone)
    messageCountByVendor[bucket] = (messageCountByVendor[bucket] ?? 0) + 1

    const day = m.created_at.split('T')[0]
    if (!dailyByVendor[day]) dailyByVendor[day] = {}
    dailyByVendor[day][bucket] = (dailyByVendor[day][bucket] ?? 0) + 1
  }
  const messageRows = [...KNOWN_VENDORS, ...IA_VENDORS]
    .map(name => ({ name, contacts: contactsByVendor[name]?.size ?? 0, messages: messageCountByVendor[name] ?? 0 }))
    .sort((a, b) => b.contacts - a.contacts)
  const messagesChartVendors = [...KNOWN_VENDORS, ...IA_VENDORS].filter(v => messageCountByVendor[v] > 0)
  const messagesChartData = Object.keys(dailyByVendor).sort().map(day => ({ date: day, ...dailyByVendor[day] }))

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
            <h4 className="text-sm font-semibold mb-4 text-slate-600">Mensagens por dia</h4>
            <MessagesChart data={messagesChartData} vendors={messagesChartVendors} />
          </div>
        )}
      </main>
    </div>
  )
}
