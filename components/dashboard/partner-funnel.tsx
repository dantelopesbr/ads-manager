'use client'

import { useState } from 'react'
import {
  PARCEIRO_GROWTH_STAGES, PARCEIRO_RISK_STAGES, PARCEIRO_ESTAGIO_LABELS, PARCEIRO_ESTAGIO_COLORS,
  HUBSPOT_PORTAL_ID, type ParceiroEstagio, type PartnerCurrent,
} from '@/lib/atividade-comercial'

function hubspotUrl(contactId: string) {
  return `https://app.hubspot.com/contacts/${HUBSPOT_PORTAL_ID}/record/0-1/${contactId}`
}

function PartnerList({ partners }: { partners: PartnerCurrent[] }) {
  const sorted = [...partners].sort((a, b) => (b.dias_desde_contato ?? 0) - (a.dias_desde_contato ?? 0))
  return (
    <div className="border rounded-lg divide-y bg-slate-50 mt-2">
      {sorted.map(p => (
        <div key={p.contact_id} className="flex items-center justify-between px-4 py-2.5 text-sm">
          <span className="font-medium text-slate-700">{p.nome ?? '—'}</span>
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-500">
              {p.dias_desde_contato != null ? `há ${p.dias_desde_contato}d sem contato` : '—'}
            </span>
            <a
              href={hubspotUrl(p.contact_id)}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-blue-600 hover:underline"
            >
              HubSpot ↗
            </a>
          </div>
        </div>
      ))}
      {sorted.length === 0 && (
        <div className="px-4 py-6 text-center text-slate-400 text-sm">Nenhum parceiro nesse estágio</div>
      )}
    </div>
  )
}

export function PartnerFunnel({ partners }: { partners: PartnerCurrent[] }) {
  const [selected, setSelected] = useState<ParceiroEstagio | null>(null)

  const byStage: Record<string, PartnerCurrent[]> = {}
  for (const p of partners) {
    if (!byStage[p.estagio]) byStage[p.estagio] = []
    byStage[p.estagio].push(p)
  }
  const countOf = (estagio: ParceiroEstagio) => byStage[estagio]?.length ?? 0
  const maxGrowth = Math.max(1, ...PARCEIRO_GROWTH_STAGES.map(countOf))

  function toggle(estagio: ParceiroEstagio) {
    setSelected(prev => (prev === estagio ? null : estagio))
  }

  return (
    <div>
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <p className="text-xs font-medium text-slate-400 mb-3 uppercase tracking-wide">Crescimento</p>
          <div className="space-y-2">
            {PARCEIRO_GROWTH_STAGES.map(estagio => {
              const count = countOf(estagio)
              const widthPct = Math.max(8, (count / maxGrowth) * 100)
              return (
                <button
                  key={estagio}
                  onClick={() => toggle(estagio)}
                  className="w-full text-left group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-700 group-hover:underline">
                      {PARCEIRO_ESTAGIO_LABELS[estagio]}
                    </span>
                    <span className="text-sm font-bold text-slate-700">{count}</span>
                  </div>
                  <div className="h-6 bg-slate-100 rounded-md overflow-hidden">
                    <div
                      className="h-full rounded-md transition-all"
                      style={{ width: `${widthPct}%`, backgroundColor: PARCEIRO_ESTAGIO_COLORS[estagio] }}
                    />
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-slate-400 mb-3 uppercase tracking-wide">Risco / Perdido</p>
          <div className="grid grid-cols-3 gap-3">
            {PARCEIRO_RISK_STAGES.map(estagio => {
              const count = countOf(estagio)
              const isSelected = selected === estagio
              return (
                <button
                  key={estagio}
                  onClick={() => toggle(estagio)}
                  className={`rounded-lg border p-3 text-left transition-colors ${isSelected ? 'ring-2 ring-offset-1' : 'hover:bg-slate-50'}`}
                  style={isSelected ? { borderColor: PARCEIRO_ESTAGIO_COLORS[estagio] } : undefined}
                >
                  <p className="text-2xl font-bold" style={{ color: PARCEIRO_ESTAGIO_COLORS[estagio] }}>{count}</p>
                  <p className="text-xs text-slate-500 mt-1">{PARCEIRO_ESTAGIO_LABELS[estagio]}</p>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {selected && (
        <div className="mt-6">
          <p className="text-sm font-semibold text-slate-600 mb-1">
            {PARCEIRO_ESTAGIO_LABELS[selected]} · {countOf(selected)}
          </p>
          <PartnerList partners={byStage[selected] ?? []} />
        </div>
      )}
    </div>
  )
}
