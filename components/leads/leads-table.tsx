'use client'

import { useState, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/metrics'
import { DEAL_STAGE_MAP, STATUS_GROUPS } from '@/lib/deal-stages'

interface LeadRow {
  id: number
  phone_client: string | null
  campaign_name: string | null
  adset_name: string | null
  ad_name: string | null
  created_at: string
  lifecycle_stage: string | null
  deal_value: number | null
  deal_stage: string | null
  /** Proprietário do contato (contact owner in HubSpot) — who's attending this client. */
  owner_name: string | null
}

const SEM_VENDEDOR = 'Sem vendedor'

function DealStageBadge({ stage }: { stage: string | null }) {
  if (!stage) return <span className="text-slate-300 text-xs">—</span>
  const mapped = DEAL_STAGE_MAP[stage]
  if (!mapped) return <Badge variant="outline" className="text-xs">{stage}</Badge>
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${mapped.className}`}>
      {mapped.label}
    </span>
  )
}

export function LeadsTable({ leads }: { leads: LeadRow[] }) {
  const [phone, setPhone] = useState('')
  const [campaign, setCampaign] = useState('')
  const [status, setStatus] = useState('')
  const [vendor, setVendor] = useState('')

  const campaigns = useMemo(() => {
    const names = [...new Set(leads.map(l => l.campaign_name).filter(Boolean))] as string[]
    return names.sort()
  }, [leads])

  const vendors = useMemo(() => {
    const names = [...new Set(leads.map(l => l.owner_name).filter(Boolean))] as string[]
    names.sort()
    if (leads.some(l => !l.owner_name)) names.push(SEM_VENDEDOR)
    return names
  }, [leads])

  const filtered = useMemo(() => {
    return leads.filter(l => {
      if (phone && !l.phone_client?.includes(phone)) return false
      if (campaign && l.campaign_name !== campaign) return false
      if (status) {
        const stages = STATUS_GROUPS[status] ?? []
        if (!l.deal_stage || !stages.includes(l.deal_stage)) return false
      }
      if (vendor) {
        if (vendor === SEM_VENDEDOR ? l.owner_name : l.owner_name !== vendor) return false
      }
      return true
    })
  }, [leads, phone, campaign, status, vendor])

  const hasFilter = phone || campaign || status || vendor

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Buscar telefone..."
          value={phone}
          onChange={e => setPhone(e.target.value)}
          className="border rounded-md px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300 w-44"
        />
        <select
          value={campaign}
          onChange={e => setCampaign(e.target.value)}
          className="border rounded-md px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300 max-w-xs"
        >
          <option value="">Todas as campanhas</option>
          {campaigns.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="border rounded-md px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="">Todos os status</option>
          {Object.keys(STATUS_GROUPS).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={vendor}
          onChange={e => setVendor(e.target.value)}
          className="border rounded-md px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="">Todos os vendedores</option>
          {vendors.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        {hasFilter && (
          <button
            onClick={() => { setPhone(''); setCampaign(''); setStatus(''); setVendor('') }}
            className="px-3 py-1.5 rounded-md text-xs text-slate-500 border hover:bg-slate-50 transition-colors"
          >
            Limpar
          </button>
        )}
        <span className="text-xs text-slate-400 self-center">{filtered.length} lead{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-slate-500 text-left">
              <th className="pb-3 pr-4 font-medium">Telefone</th>
              <th className="pb-3 pr-4 font-medium">Campanha</th>
              <th className="pb-3 pr-4 font-medium">Adset</th>
              <th className="pb-3 pr-4 font-medium">Ad</th>
              <th className="pb-3 pr-4 font-medium">Data</th>
              <th className="pb-3 pr-4 font-medium">Status</th>
              <th className="pb-3 pr-4 font-medium">Vendedor</th>
              <th className="pb-3 pr-4 font-medium text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(lead => (
              <tr key={lead.id} className="border-b hover:bg-slate-50">
                <td className="py-3 pr-4 font-mono text-xs">{lead.phone_client ?? '—'}</td>
                <td className="py-3 pr-4">{lead.campaign_name ?? '—'}</td>
                <td className="py-3 pr-4 text-slate-500">{lead.adset_name ?? '—'}</td>
                <td className="py-3 pr-4 text-slate-500">{lead.ad_name ?? '—'}</td>
                <td className="py-3 pr-4 text-slate-400 whitespace-nowrap">
                  {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                </td>
                <td className="py-3 pr-4">
                  {lead.deal_stage
                    ? <DealStageBadge stage={lead.deal_stage} />
                    : <span className="text-slate-300 text-xs">sem negócio</span>
                  }
                </td>
                <td className="py-3 pr-4 text-slate-500">
                  {lead.owner_name ?? <span className="text-slate-300">—</span>}
                </td>
                <td className="py-3 pr-4 text-right">
                  {lead.deal_value ? formatCurrency(lead.deal_value) : <span className="text-slate-300">—</span>}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-400 text-sm">Nenhum lead encontrado</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
