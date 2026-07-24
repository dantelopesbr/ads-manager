'use client'

import { useState } from 'react'
import type { AtividadeLogRow } from '@/lib/atividade-comercial'

export function VendorActivityLog({ rows }: { rows: AtividadeLogRow[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggle(vendedor: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(vendedor) ? next.delete(vendedor) : next.add(vendedor)
      return next
    })
  }

  const byVendor: Record<string, AtividadeLogRow[]> = {}
  for (const r of rows) {
    if (!byVendor[r.vendedor]) byVendor[r.vendedor] = []
    byVendor[r.vendedor].push(r)
  }
  const vendors = Object.keys(byVendor).sort((a, b) => byVendor[b].length - byVendor[a].length)

  if (vendors.length === 0) {
    return <p className="text-sm text-slate-400">Sem conversas registradas nesse período.</p>
  }

  return (
    <div className="space-y-2">
      {vendors.map(vendedor => {
        const isOpen = expanded.has(vendedor)
        const entries = byVendor[vendedor]
        return (
          <div key={vendedor} className="border rounded-lg overflow-hidden">
            <button
              onClick={() => toggle(vendedor)}
              className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-slate-50 transition-colors text-left"
            >
              <span className="text-sm font-medium text-slate-700">
                <span className="text-slate-400 text-xs mr-2">{isOpen ? '▼' : '▶'}</span>
                {vendedor}
              </span>
              <span className="text-xs text-slate-400">{entries.length} conversa{entries.length !== 1 ? 's' : ''}</span>
            </button>
            {isOpen && (
              <div className="divide-y bg-slate-50">
                {entries.map((e, i) => (
                  <div key={i} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700">{e.contato_nome ?? e.contato_telefone ?? '—'}</span>
                      <span className="text-xs text-slate-400 whitespace-nowrap">
                        {new Date(e.data_atividade).toLocaleDateString('pt-BR')} · {e.qtd_mensagens} msg{e.qtd_mensagens !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600">{e.resumo ?? <span className="text-slate-300">sem resumo</span>}</p>
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
