'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatPercent } from '@/lib/metrics'

interface CampaignRow {
  id: string
  name: string
  spend: number
  leads: number
  cpl: number | null
  ctr: number | null
  impressions: number
  clicks: number
}

interface Props {
  campaigns: CampaignRow[]
  avgCpl: number | null
}

export function CampaignsTable({ campaigns, avgCpl }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-slate-500 text-left">
            <th className="pb-3 pr-4 font-medium">Campanha</th>
            <th className="pb-3 pr-4 font-medium text-right">Spend</th>
            <th className="pb-3 pr-4 font-medium text-right">Leads</th>
            <th className="pb-3 pr-4 font-medium text-right">CPL</th>
            <th className="pb-3 pr-4 font-medium text-right">CTR</th>
            <th className="pb-3 pr-4 font-medium text-right">Impressões</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map(row => {
            const highCpl = avgCpl !== null && row.cpl !== null && row.cpl > avgCpl * 1.2
            const lowCtr = row.ctr !== null && row.ctr < 0.005
            return (
              <tr key={row.id} className="border-b hover:bg-slate-50">
                <td className="py-3 pr-4 font-medium">
                  <Link href={`/campaigns/${encodeURIComponent(row.id)}`} className="text-blue-600 underline hover:text-blue-800">
                    {row.name}
                  </Link>
                  {highCpl && <Badge variant="destructive" className="ml-2 text-xs">CPL alto</Badge>}
                  {lowCtr && <Badge variant="outline" className="ml-2 text-xs">CTR baixo</Badge>}
                </td>
                <td className="py-3 pr-4 text-right">{formatCurrency(row.spend)}</td>
                <td className="py-3 pr-4 text-right">{row.leads}</td>
                <td className="py-3 pr-4 text-right">{formatCurrency(row.cpl)}</td>
                <td className="py-3 pr-4 text-right">{formatPercent(row.ctr)}</td>
                <td className="py-3 pr-4 text-right">{row.impressions.toLocaleString('pt-BR')}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
