'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatCurrency, formatPercent } from '@/lib/metrics'
import { formatMinutes } from '@/lib/speed-to-lead'

export interface VendorRankingRow {
  vendedor: string
  criados: number
  ganhos: number
  conversao: number | null
  ticketMedio: number | null
  receita: number
  atingimento: number | null
  score: number | null
  hasConversaoScore: boolean
  tempoResposta: number | null
  naoRetornamosRate: number | null
}

type SortKey = Exclude<keyof VendorRankingRow, 'hasConversaoScore'>
type SortDir = 'asc' | 'desc'

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'vendedor', label: 'Vendedor' },
  { key: 'criados', label: 'Deals Criados' },
  { key: 'ganhos', label: 'Deals Ganhos' },
  { key: 'conversao', label: 'Conversão' },
  { key: 'ticketMedio', label: 'Ticket Médio' },
  { key: 'receita', label: 'Receita' },
  { key: 'atingimento', label: 'Atingimento' },
  { key: 'score', label: 'Score' },
  { key: 'tempoResposta', label: 'Tempo de Resposta' },
  { key: 'naoRetornamosRate', label: '% Não Retornamos' },
]

export function VendorRankingTable({ rows }: { rows: VendorRankingRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('receita')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir(key === 'vendedor' ? 'asc' : 'desc') }
  }

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey]
    const bv = b[sortKey]
    if (av === null && bv === null) return 0
    if (av === null) return 1
    if (bv === null) return -1
    if (typeof av === 'string' && typeof bv === 'string') {
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    }
    const an = Number(av)
    const bn = Number(bv)
    return sortDir === 'asc' ? an - bn : bn - an
  })

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-slate-500 text-left">
            {COLUMNS.map(c => (
              <th
                key={c.key}
                onClick={() => toggleSort(c.key)}
                className={`pb-3 pr-4 font-medium cursor-pointer select-none hover:text-slate-700 whitespace-nowrap ${c.key !== 'vendedor' ? 'text-right' : ''}`}
              >
                {c.label}{sortKey === c.key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
              </th>
            ))}
            <th className="pb-3 font-medium text-right">Relatório</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(r => (
            <tr key={r.vendedor} className="border-b last:border-0 hover:bg-slate-50">
              <td className="py-2.5 pr-4 font-medium">{r.vendedor}</td>
              <td className="py-2.5 pr-4 text-right">{r.criados}</td>
              <td className="py-2.5 pr-4 text-right">{r.ganhos}</td>
              <td className="py-2.5 pr-4 text-right">{formatPercent(r.conversao)}</td>
              <td className="py-2.5 pr-4 text-right">{r.ticketMedio !== null ? formatCurrency(r.ticketMedio) : '—'}</td>
              <td className="py-2.5 pr-4 text-right font-medium text-emerald-700">{formatCurrency(r.receita || null)}</td>
              <td className="py-2.5 pr-4 text-right font-medium">{r.atingimento !== null ? formatPercent(r.atingimento) : '—'}</td>
              <td className="py-2.5 pr-4 text-right font-semibold">
                {r.score !== null ? r.score.toFixed(0) : '—'}
                {!r.hasConversaoScore && r.score !== null && <span className="text-slate-400 font-normal">*</span>}
              </td>
              <td className="py-2.5 pr-4 text-right">{r.tempoResposta !== null ? formatMinutes(r.tempoResposta) : '—'}</td>
              <td className="py-2.5 pr-4 text-right">{r.naoRetornamosRate !== null ? formatPercent(r.naoRetornamosRate) : '—'}</td>
              <td className="py-2.5 text-right">
                <Link href={`/vendedores/${encodeURIComponent(r.vendedor)}`} className="text-brand-dark-green hover:underline text-xs font-medium">
                  Ver relatório
                </Link>
              </td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={COLUMNS.length + 1} className="py-6 text-center text-slate-400 text-sm">Sem dado no período</td>
            </tr>
          )}
        </tbody>
      </table>
      <p className="text-[11px] text-slate-400 mt-3">* menos de 5 deals criados no período — conversão fora do Score, peso redistribuído entre Meta e Atividade. Clica no cabeçalho da coluna pra ordenar.</p>
    </div>
  )
}
