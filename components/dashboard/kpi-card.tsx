import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface KpiCardProps {
  title: string
  value: string
  subtitle?: string
  /** Percent change vs. the previous period (e.g. 12.5 = +12.5%). Omit when there's no prior-period baseline. */
  delta?: number | null
  /** Whether a positive delta should be shown as good (green). Spend/CPL should pass false. */
  positiveIsGood?: boolean
  /** Fixed target set in Settings (e.g. "Meta: R$ 45,00"). Omit when no target is configured. */
  target?: { label: string; met: boolean } | null
}

function DeltaBadge({ delta, positiveIsGood = true }: { delta: number; positiveIsGood: boolean }) {
  const isFlat = Math.abs(delta) < 0.05
  const isUp = delta > 0
  const isGood = isFlat ? null : isUp === positiveIsGood
  const color = isFlat ? 'text-slate-400' : isGood ? 'text-emerald-600' : 'text-red-600'
  const arrow = isFlat ? '–' : isUp ? '▲' : '▼'
  return (
    <span className={`text-xs font-medium ${color}`}>
      {arrow} {Math.abs(delta).toFixed(1)}%
    </span>
  )
}

export function KpiCard({ title, value, subtitle, delta, positiveIsGood = true, target }: KpiCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-500">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-bold">{value}</p>
          {delta !== null && delta !== undefined && (
            <DeltaBadge delta={delta} positiveIsGood={positiveIsGood} />
          )}
        </div>
        {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        {target && (
          <p className={`text-xs mt-1 font-medium ${target.met ? 'text-emerald-600' : 'text-amber-600'}`}>
            {target.met ? '✓' : '✗'} Meta: {target.label}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
