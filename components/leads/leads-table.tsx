import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/metrics'

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
}

const DEAL_STAGE_MAP: Record<string, { label: string; className: string }> = {
  // Fluxo de Vendas Loja
  appointmentscheduled: { label: 'Lead',             className: 'bg-slate-100 text-slate-700 border-slate-200' },
  qualifiedtobuy:       { label: 'Orçamento',        className: 'bg-amber-50 text-amber-700 border-amber-200' },
  closedwon:            { label: 'Venda Realizada',  className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  closedlost:           { label: 'Venda Perdida',    className: 'bg-red-50 text-red-600 border-red-200' },
  // Resale pipeline
  checkout_abandoned:   { label: 'Lead',             className: 'bg-slate-100 text-slate-700 border-slate-200' },
  checkout_pending:     { label: 'Orçamento',        className: 'bg-amber-50 text-amber-700 border-amber-200' },
  processed:            { label: 'Venda Realizada',  className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cancelled:            { label: 'Venda Perdida',    className: 'bg-red-50 text-red-600 border-red-200' },
}

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
  return (
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
            <th className="pb-3 pr-4 font-medium text-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          {leads.map(lead => (
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
              <td className="py-3 pr-4 text-right">
                {lead.deal_value ? formatCurrency(lead.deal_value) : <span className="text-slate-300">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
