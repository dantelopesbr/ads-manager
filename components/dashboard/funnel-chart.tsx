import { FUNNEL_STAGES, type FunnelBucket } from '@/lib/deal-stages'

interface Props {
  counts: Partial<Record<FunnelBucket, number>>
  total: number
}

export function FunnelChart({ counts, total }: Props) {
  if (total === 0) {
    return <p className="text-sm text-slate-400">Sem leads no período.</p>
  }

  const stages = FUNNEL_STAGES.map(s => ({ ...s, count: counts[s.bucket] ?? 0 }))

  return (
    <div>
      <div className="flex w-full h-6 rounded-md overflow-hidden gap-0.5 bg-slate-100">
        {stages.map(s => {
          const pct = s.count / total
          if (pct === 0) return null
          return (
            <div
              key={s.bucket}
              className={s.barClassName}
              style={{ width: `${pct * 100}%` }}
              title={`${s.bucket}: ${s.count} (${(pct * 100).toFixed(1)}%)`}
            />
          )
        })}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4">
        {stages.map(s => (
          <div key={s.bucket} className="flex items-center gap-1.5 text-sm">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${s.dotClassName}`} />
            <span className="text-slate-600">{s.bucket}</span>
            <span className="font-medium">{s.count}</span>
            <span className="text-slate-400 text-xs">({((s.count / total) * 100).toFixed(0)}%)</span>
          </div>
        ))}
      </div>
    </div>
  )
}
