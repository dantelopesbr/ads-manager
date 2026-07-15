import { createClient } from '@/lib/supabase/server'
import { Nav } from '@/components/nav'
import { format, subHours, subDays } from 'date-fns'
import { getAccount, getAccountSelection } from '@/lib/account-server'
import { ACCOUNTS } from '@/lib/account'
import { dedupeByClickId } from '@/lib/conversions'
import { getTeamPhones } from '@/lib/queries'
import { classifyMessage, buildTeamPhoneIndex, normalizePhoneSuffix } from '@/lib/whatsapp-team'
import { bucketDealStage } from '@/lib/deal-stages'
import { batchGetContactsByPhone, fetchOwners } from '@/lib/hubspot/client'

export const dynamic = 'force-dynamic'
// Hobby plan cap — the live HubSpot re-check below is bounded to the (usually
// small) unattended candidate list, but give it real headroom regardless.
export const maxDuration = 60

export default async function SemAtendimentoPage() {
  const supabase = await createClient()

  const now = new Date()
  const cutoffRecent = subHours(now, 24) // leads newer than this are still "fresh," not overdue yet
  const cutoffOld = subDays(now, 7) // leads older than this have likely gone cold — different problem, not tracked here

  const selection = await getAccountSelection()
  const account = await getAccount()
  const { phoneCompany } = ACCOUNTS[account]

  // Leads in the 24h-7d window, deduped by click_id like every other page here
  const allConversions: { id: number; phone_client: string | null; campaign_name: string | null; adset_name: string | null; ad_name: string | null; created_at: string; click_id: string | null }[] = []
  const PAGE_SIZE = 1000
  for (let page = 0; ; page++) {
    const { data: batch } = await supabase
      .from('meta_ads_conversions')
      .select('id, phone_client, campaign_name, adset_name, ad_name, created_at, click_id')
      .eq('phone_company', phoneCompany)
      .gte('created_at', cutoffOld.toISOString())
      .lte('created_at', cutoffRecent.toISOString())
      .order('created_at', { ascending: true })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
    if (!batch?.length) break
    allConversions.push(...batch)
    if (batch.length < PAGE_SIZE) break
  }
  const leads = dedupeByClickId(allConversions).filter(l => l.phone_client)
  const phones = [...new Set(leads.map(l => l.phone_client))] as string[]

  // "Sem atendimento" here means the IA handled the client but "Proprietário
  // do contato" (the contact's own owner property in HubSpot) is still empty
  // — not the deal's owner, which can differ or not exist yet.
  const contactByPhone: Record<string, { contact_owner_name: string | null; deal_stage: string | null }> = {}
  for (let i = 0; i < phones.length; i += 100) {
    const { data } = await supabase
      .from('hubspot_contacts')
      .select('phone, contact_owner_name, deal_stage')
      .in('phone', phones.slice(i, i + 100))
    for (const row of data ?? []) contactByPhone[row.phone] = row
  }

  // Context columns only (not used to decide inclusion): did anyone reach out already?
  const calledPhones = new Set<string>()
  for (let i = 0; i < phones.length; i += 100) {
    const { data } = await supabase
      .from('hubspot_calls')
      .select('phone')
      .in('phone', phones.slice(i, i + 100))
    for (const row of data ?? []) calledPhones.add(row.phone)
  }

  const iaRepliedPhones = new Set<string>()
  let whatsappAvailable = false
  if (account === 'fratellihouse' && phones.length > 0) {
    whatsappAvailable = true
    const teamPhones = await getTeamPhones(supabase)
    const teamIndex = buildTeamPhoneIndex(teamPhones)
    const sinceStr = format(cutoffOld, 'yyyy-MM-dd')
    const untilStr = format(now, 'yyyy-MM-dd')
    const phoneSet = new Set(phones)
    const msgs: { phone: string | null; phone_fratelli: string | null; source: string | null }[] = []
    for (let page = 0; ; page++) {
      const { data } = await supabase
        .from('[FH]conversation_Whatsapp')
        .select('phone, phone_fratelli, source')
        .gte('created_at', sinceStr)
        .lte('created_at', `${untilStr}T23:59:59`)
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
      if (!data?.length) break
      msgs.push(...data)
      if (data.length < PAGE_SIZE) break
    }
    for (const m of msgs) {
      if (!m.phone || !phoneSet.has(m.phone)) continue
      const teamLabel = teamIndex.get(normalizePhoneSuffix(m.phone_fratelli) ?? '') ?? null
      const classified = classifyMessage(m.source, teamLabel)
      if (classified.type === 'ia') iaRepliedPhones.add(m.phone)
    }
  }

  const candidates = leads.filter(l => !contactByPhone[l.phone_client!]?.contact_owner_name)

  // Live re-check against HubSpot for just this candidate list — the local
  // cache can lag up to 7 days behind (or longer if the sync batch hasn't
  // caught up), and showing someone as unattended who's actually already
  // owned undermines the one thing this page is for. One batch-read round
  // trip per 100 phones (not one search per phone); also opportunistically
  // refreshes the cache for anyone the live check finds an owner for.
  let unattended = candidates
  if (candidates.length > 0) {
    const apiKey = process.env.HUBSPOT_API_KEY!
    const candidatePhones = [...new Set(candidates.map(l => l.phone_client!))]
    const [owners, liveContacts] = await Promise.all([
      fetchOwners(apiKey).catch(() => []),
      batchGetContactsByPhone(candidatePhones, apiKey).catch(() => new Map()),
    ])
    const ownerNameById = new Map(owners.map(o => [o.id, o.name]))

    const updates: { phone: string; hs_contact_id: string; lifecycle_stage: string | null; contact_owner_id: string; contact_owner_name: string | null; updated_at: string }[] = []
    for (const [phone, contact] of liveContacts) {
      if (!contact.contact_owner_id) continue
      const contact_owner_name = ownerNameById.get(contact.contact_owner_id) ?? null
      contactByPhone[phone] = { contact_owner_name, deal_stage: contactByPhone[phone]?.deal_stage ?? null }
      updates.push({
        phone,
        hs_contact_id: contact.hs_contact_id,
        lifecycle_stage: contact.lifecycle_stage,
        contact_owner_id: contact.contact_owner_id,
        contact_owner_name,
        updated_at: new Date().toISOString(),
      })
    }
    if (updates.length > 0) {
      await supabase.from('hubspot_contacts').upsert(updates, { onConflict: 'phone' })
    }

    unattended = candidates.filter(l => !contactByPhone[l.phone_client!]?.contact_owner_name)
  }

  function hoursAgo(iso: string) {
    return Math.floor((now.getTime() - new Date(iso).getTime()) / (60 * 60 * 1000))
  }

  return (
    <div className="flex">
      <Nav />
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold">Sem Atendimento</h2>
        </div>
        {selection === 'all' && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-3">
            Modo “Todas as contas” só se aplica ao Dashboard — mostrando {ACCOUNTS[account].label} aqui.
          </p>
        )}
        {!whatsappAvailable && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-3">
            {ACCOUNTS[account].label} não tem WhatsApp rastreado — coluna “IA respondeu” não disponível aqui.
          </p>
        )}
        <p className="text-sm text-slate-500 mb-6">
          Leads entre 24h e 7 dias sem vendedor definido no HubSpot (atendidos pela IA mas não transferidos) · {unattended.length} de {leads.length}
        </p>

        <div className="bg-white rounded-xl border p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-slate-500 text-left">
                  <th className="pb-3 pr-4 font-medium">Telefone</th>
                  <th className="pb-3 pr-4 font-medium">Campanha</th>
                  <th className="pb-3 pr-4 font-medium">IA respondeu</th>
                  <th className="pb-3 pr-4 font-medium">Teve ligação</th>
                  <th className="pb-3 pr-4 font-medium">Vendedor</th>
                  <th className="pb-3 pr-4 font-medium">Status</th>
                  <th className="pb-3 font-medium text-right">Há quanto tempo</th>
                </tr>
              </thead>
              <tbody>
                {unattended.map(l => (
                  <tr key={l.id} className="border-b hover:bg-slate-50">
                    <td className="py-3 pr-4 font-mono text-xs">{l.phone_client}</td>
                    <td className="py-3 pr-4">{l.campaign_name ?? '—'}</td>
                    <td className="py-3 pr-4">
                      {whatsappAvailable
                        ? (iaRepliedPhones.has(l.phone_client!)
                          ? <span className="text-emerald-700">Sim</span>
                          : <span className="text-slate-300">Não</span>)
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="py-3 pr-4">
                      {calledPhones.has(l.phone_client!)
                        ? <span className="text-emerald-700">Sim</span>
                        : <span className="text-slate-300">Não</span>}
                    </td>
                    <td className="py-3 pr-4 text-slate-500">
                      {contactByPhone[l.phone_client!]?.contact_owner_name ?? <span className="text-slate-300">sem vendedor</span>}
                    </td>
                    <td className="py-3 pr-4 text-slate-500">{bucketDealStage(contactByPhone[l.phone_client!]?.deal_stage ?? null)}</td>
                    <td className="py-3 text-right font-medium text-red-600">há {hoursAgo(l.created_at)}h</td>
                  </tr>
                ))}
                {unattended.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 text-sm">Todo mundo desse período já tem vendedor definido</td>
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
