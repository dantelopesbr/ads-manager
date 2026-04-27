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
            <th className="pb-3 pr-4 font-medium">HubSpot</th>
            <th className="pb-3 pr-4 font-medium text-right">Deal</th>
          </tr>
        </thead>
        <tbody>
          {leads.map(lead => (
            <tr key={lead.id} className="border-b hover:bg-slate-50">
              <td className="py-3 pr-4 font-mono text-xs">{lead.phone_client ?? '—'}</td>
              <td className="py-3 pr-4">{lead.campaign_name ?? '—'}</td>
              <td className="py-3 pr-4 text-slate-500">{lead.adset_name ?? '—'}</td>
              <td className="py-3 pr-4 text-slate-500">{lead.ad_name ?? '—'}</td>
              <td className="py-3 pr-4 text-slate-400">{new Date(lead.created_at).toLocaleDateString('pt-BR')}</td>
              <td className="py-3 pr-4">
                {lead.lifecycle_stage
                  ? <Badge variant="outline" className="text-xs">{lead.lifecycle_stage}</Badge>
                  : <span className="text-slate-300 text-xs">não encontrado</span>
                }
              </td>
              <td className="py-3 pr-4 text-right">{formatCurrency(lead.deal_value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
