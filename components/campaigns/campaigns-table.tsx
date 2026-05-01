'use client'

import { useState, useCallback, Fragment } from 'react'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatPercent, formatROAS } from '@/lib/metrics'
import { CampaignActionModal } from './campaign-action-modal'

interface AdRow {
  key: string
  name: string
  spend: number
  leads: number
  cpl: number | null
  ctr: number | null
  impressions: number
  roas_real: number | null
  roas_projected: number | null
}

interface AdsetRow {
  key: string
  name: string
  spend: number
  leads: number
  cpl: number | null
  ctr: number | null
  impressions: number
  roas_real: number | null
  roas_projected: number | null
  ads: AdRow[]
}

interface CampaignRow {
  id: string
  name: string
  spend: number
  leads: number
  cpl: number | null
  ctr: number | null
  impressions: number
  roas_real: number | null
  roas_projected: number | null
  adsets: AdsetRow[]
}

interface Props {
  campaigns: CampaignRow[]
  avgCpl: number | null
}

interface ActiveModal {
  campaignId: string
  campaignName: string
  actionType: 'pause' | 'budget'
}

function isBadCpl(cpl: number | null, avg: number | null) {
  return avg !== null && cpl !== null && cpl > avg * 1.2
}

function isBadCtr(ctr: number | null) {
  return ctr !== null && ctr < 0.005
}

function ActionButtons({
  campaignId,
  campaignName,
  onAction,
}: {
  campaignId: string
  campaignName: string
  onAction: (modal: ActiveModal) => void
}) {
  return (
    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
      <button
        title="Pausar campanha"
        onClick={() => onAction({ campaignId, campaignName, actionType: 'pause' })}
        className="px-2 py-1 rounded-md text-xs bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
      >
        ⏸
      </button>
      <button
        title="Alterar budget diário"
        onClick={() => onAction({ campaignId, campaignName, actionType: 'budget' })}
        className="px-2 py-1 rounded-md text-xs bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
      >
        💰
      </button>
    </div>
  )
}

export function CampaignsTable({ campaigns, avgCpl }: Props) {
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set())
  const [expandedAdsets, setExpandedAdsets] = useState<Set<string>>(new Set())
  const [activeModal, setActiveModal] = useState<ActiveModal | null>(null)

  function toggleCampaign(id: string) {
    setExpandedCampaigns(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAdset(key: string) {
    setExpandedAdsets(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const handleActionSuccess = useCallback(() => {
    // Reload page to reflect updated status
    window.location.reload()
  }, [])

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-slate-500 text-left">
              <th className="pb-3 pr-4 font-medium">Nome</th>
              <th className="pb-3 pr-4 font-medium text-right">Spend</th>
              <th className="pb-3 pr-4 font-medium text-right">Leads</th>
              <th className="pb-3 pr-4 font-medium text-right">CPL</th>
              <th className="pb-3 pr-4 font-medium text-right">CTR</th>
              <th className="pb-3 pr-4 font-medium text-right">Impressões</th>
              <th className="pb-3 pr-4 font-medium text-right">ROAS Real</th>
              <th className="pb-3 pr-4 font-medium text-right">ROAS Proj.</th>
              <th className="pb-3 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map(campaign => {
              const campExpanded = expandedCampaigns.has(campaign.id)
              return (
                <Fragment key={campaign.id}>
                  {/* Campaign row */}
                  <tr
                    className="border-b hover:bg-slate-50 select-none"
                  >
                    <td
                      className="py-3 pr-4 font-medium cursor-pointer"
                      onClick={() => toggleCampaign(campaign.id)}
                    >
                      <span className="mr-2 text-slate-400 text-xs">{campExpanded ? '▼' : '▶'}</span>
                      {campaign.name}
                      {isBadCpl(campaign.cpl, avgCpl) && <Badge variant="destructive" className="ml-2 text-xs">CPL alto</Badge>}
                      {isBadCtr(campaign.ctr) && <Badge variant="outline" className="ml-2 text-xs">CTR baixo</Badge>}
                    </td>
                    <td className="py-3 pr-4 text-right">{formatCurrency(campaign.spend)}</td>
                    <td className="py-3 pr-4 text-right">{campaign.leads}</td>
                    <td className="py-3 pr-4 text-right">{formatCurrency(campaign.cpl)}</td>
                    <td className="py-3 pr-4 text-right">{formatPercent(campaign.ctr)}</td>
                    <td className="py-3 pr-4 text-right">{campaign.impressions.toLocaleString('pt-BR')}</td>
                    <td className="py-3 pr-4 text-right font-medium text-emerald-700">{formatROAS(campaign.roas_real)}</td>
                    <td className="py-3 pr-4 text-right text-slate-500">{formatROAS(campaign.roas_projected)}</td>
                    <td className="py-3 text-right">
                      <ActionButtons
                        campaignId={campaign.id}
                        campaignName={campaign.name}
                        onAction={setActiveModal}
                      />
                    </td>
                  </tr>

                  {/* Adset rows */}
                  {campExpanded && campaign.adsets.map(adset => {
                    const adsetExpanded = expandedAdsets.has(adset.key)
                    return (
                      <Fragment key={adset.key}>
                        <tr
                          className="border-b bg-slate-50 hover:bg-slate-100 cursor-pointer select-none"
                          onClick={e => { e.stopPropagation(); toggleAdset(adset.key) }}
                        >
                          <td className="py-2 pr-4 pl-6 text-slate-700">
                            <span className="mr-2 text-slate-400 text-xs">{adsetExpanded ? '▼' : '▶'}</span>
                            {adset.name}
                            {isBadCpl(adset.cpl, avgCpl) && <Badge variant="destructive" className="ml-2 text-xs">CPL alto</Badge>}
                            {isBadCtr(adset.ctr) && <Badge variant="outline" className="ml-2 text-xs">CTR baixo</Badge>}
                          </td>
                          <td className="py-2 pr-4 text-right">{formatCurrency(adset.spend)}</td>
                          <td className="py-2 pr-4 text-right">{adset.leads}</td>
                          <td className="py-2 pr-4 text-right">{formatCurrency(adset.cpl)}</td>
                          <td className="py-2 pr-4 text-right">{formatPercent(adset.ctr)}</td>
                          <td className="py-2 pr-4 text-right">{adset.impressions.toLocaleString('pt-BR')}</td>
                          <td className="py-2 pr-4 text-right font-medium text-emerald-700">{formatROAS(adset.roas_real)}</td>
                          <td className="py-2 pr-4 text-right text-slate-500">{formatROAS(adset.roas_projected)}</td>
                          <td className="py-2 text-right text-slate-300 text-xs">—</td>
                        </tr>

                        {/* Ad rows */}
                        {adsetExpanded && adset.ads.map(ad => (
                          <tr key={ad.key} className="border-b bg-slate-100">
                            <td className="py-2 pr-4 pl-12 text-slate-600 text-xs">{ad.name}
                              {isBadCpl(ad.cpl, avgCpl) && <Badge variant="destructive" className="ml-2 text-xs">CPL alto</Badge>}
                              {isBadCtr(ad.ctr) && <Badge variant="outline" className="ml-2 text-xs">CTR baixo</Badge>}
                            </td>
                            <td className="py-2 pr-4 text-right text-xs">{formatCurrency(ad.spend)}</td>
                            <td className="py-2 pr-4 text-right text-xs">{ad.leads}</td>
                            <td className="py-2 pr-4 text-right text-xs">{formatCurrency(ad.cpl)}</td>
                            <td className="py-2 pr-4 text-right text-xs">{formatPercent(ad.ctr)}</td>
                            <td className="py-2 pr-4 text-right text-xs">{ad.impressions.toLocaleString('pt-BR')}</td>
                            <td className="py-2 pr-4 text-right text-xs font-medium text-emerald-700">{formatROAS(ad.roas_real)}</td>
                            <td className="py-2 pr-4 text-right text-xs text-slate-500">{formatROAS(ad.roas_projected)}</td>
                            <td className="py-2 text-right text-slate-300 text-xs">—</td>
                          </tr>
                        ))}
                      </Fragment>
                    )
                  })}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Action Modal */}
      {activeModal && (
        <CampaignActionModal
          campaignId={activeModal.campaignId}
          campaignName={activeModal.campaignName}
          actionType={activeModal.actionType}
          onClose={() => setActiveModal(null)}
          onSuccess={handleActionSuccess}
        />
      )}
    </>
  )
}



