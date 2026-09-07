'use client'

import { useState } from 'react'
import type { DealMotivoRow } from '@/lib/motivo-fechamento'
import { LOST_REASON_LABELS, WON_REASON_LABELS, isLostReason, isWonReason } from '@/lib/motivo-fechamento'
import { formatCurrency } from '@/lib/metrics'

export function DealMotivoList({ deals }: { deals: DealMotivoRow[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggle(label: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(label) ? next.delete(label) : next.add(label)
      return next
    })
  }

  const groups: Record<string, DealMotivoRow[]> = {}
  for (const d of deals) {
    const label = d.dealstage === 'closedlost'
      ? `Perda · ${isLostReason(d.closed_lost_reason) ? LOST_REASON_LABELS[d.closed_lost_reason] : 'Outro'}`
      : `Ganho · ${isWonReason(d.closed_won_reason) ? WON_REASON_LABELS[d.closed_won_reason] : 'Outro'}`
    if (!groups[label]) groups[label] = []
    groups[label].push(d)
  }
  const labels = Object.keys(groups).sort((a, b) => groups[b].length - groups[a].length)

  if (labels.length === 0) {
    return <p className="text-sm text-slate-400">Nenhum deal fechado nesse mês.</p>
  }

  return (
    <div className="space-y-2">
      {labels.map(label => {
        const isOpen = expanded.has(label)
        const items = groups[label]
        const isWon = label.startsWith('Ganho')
        return (
          <div key={label} className="border rounded-sm overflow-hidden">
            <button
              onClick={() => toggle(label)}
              className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-slate-50 transition-colors text-left"
            >
              <span className="text-sm font-medium text-slate-700">
                <span className="text-slate-400 text-xs mr-2">{isOpen ? '▼' : '▶'}</span>
                {label}
              </span>
              <span className={`text-xs font-medium ${isWon ? 'text-emerald-600' : 'text-red-500'}`}>
                {items.length} deal{items.length !== 1 ? 's' : ''}
              </span>
            </button>
            {isOpen && (
              <div className="divide-y bg-slate-50">
                {items.map(d => (
                  <div key={d.deal_id} className="px-4 py-2.5 flex items-center justify-between text-sm">
                    <span className="text-slate-700">{d.dealname ?? d.deal_id}</span>
                    <span className="text-slate-400 text-xs whitespace-nowrap ml-4">
                      {new Date(d.closedate).toLocaleDateString('pt-BR')} · {d.amount !== null ? formatCurrency(d.amount) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
