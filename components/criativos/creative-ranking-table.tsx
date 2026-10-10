'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { formatPercent } from '@/lib/metrics'

export interface CreativeRankingRow {
  id: string
  thumbnail: string | null
  caption: string | null
  mediaType: string
  timestamp: string
  permalink: string
  likes: number
  comments: number
  saved: number | null
  shares: number | null
  reach: number | null
  engagementScore: number
  engagementRate: number | null
}

type SortKey = Exclude<keyof CreativeRankingRow, 'thumbnail' | 'caption' | 'mediaType' | 'permalink' | 'id'>
type SortDir = 'asc' | 'desc'

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'timestamp', label: 'Data' },
  { key: 'likes', label: 'Curtidas' },
  { key: 'comments', label: 'Comentários' },
  { key: 'saved', label: 'Salvos' },
  { key: 'shares', label: 'Compart.' },
  { key: 'reach', label: 'Alcance' },
  { key: 'engagementRate', label: 'Taxa Eng.' },
  { key: 'engagementScore', label: 'Score' },
]

export function CreativeRankingTable({ rows }: { rows: CreativeRankingRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('engagementScore')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('desc') }
  }

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey]
    const bv = b[sortKey]
    if (av === null && bv === null) return 0
    if (av === null) return 1
    if (bv === null) return -1
    if (sortKey === 'timestamp') {
      const an = new Date(av as string).getTime()
      const bn = new Date(bv as string).getTime()
      return sortDir === 'asc' ? an - bn : bn - an
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
            <th className="pb-3 pr-4 font-medium">Post</th>
            {COLUMNS.map(c => (
              <th
                key={c.key}
                onClick={() => toggleSort(c.key)}
                className="pb-3 pr-4 font-medium text-right cursor-pointer select-none hover:text-slate-700 whitespace-nowrap"
              >
                {c.label}{sortKey === c.key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map(r => (
            <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50">
              <td className="py-2.5 pr-4">
                <a href={r.permalink} target="_blank" rel="noreferrer" className="flex items-center gap-3 group">
                  {r.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element -- external Meta CDN URL, not a local/optimizable asset
                    <img src={r.thumbnail} alt="" className="w-12 h-12 rounded object-cover shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded bg-slate-100 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400">{r.mediaType}</p>
                    <p className="truncate max-w-[220px] group-hover:underline">{r.caption ?? '—'}</p>
                  </div>
                </a>
              </td>
              <td className="py-2.5 pr-4 text-right whitespace-nowrap">
                {format(new Date(r.timestamp), 'dd/MM/yy', { locale: ptBR })}
              </td>
              <td className="py-2.5 pr-4 text-right">{r.likes}</td>
              <td className="py-2.5 pr-4 text-right">{r.comments}</td>
              <td className="py-2.5 pr-4 text-right">{r.saved ?? '—'}</td>
              <td className="py-2.5 pr-4 text-right">{r.shares ?? '—'}</td>
              <td className="py-2.5 pr-4 text-right">{r.reach ?? '—'}</td>
              <td className="py-2.5 pr-4 text-right">{formatPercent(r.engagementRate)}</td>
              <td className="py-2.5 pr-4 text-right font-semibold">{r.engagementScore}</td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={COLUMNS.length + 1} className="py-6 text-center text-slate-400 text-sm">Sem posts encontrados</td>
            </tr>
          )}
        </tbody>
      </table>
      <p className="text-[11px] text-slate-400 mt-3">Score = curtidas + comentários×2 + salvos×3 + compart.×4. Clica no cabeçalho da coluna pra ordenar.</p>
    </div>
  )
}
