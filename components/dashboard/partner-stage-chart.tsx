'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import {
  PARCEIRO_ESTAGIOS, PARCEIRO_ESTAGIO_LABELS, PARCEIRO_ESTAGIO_COLORS,
  type ParceiroStatusRow,
} from '@/lib/atividade-comercial'

export function PartnerStageChart({ rows }: { rows: ParceiroStatusRow[] }) {
  const byDate: Record<string, Record<string, number>> = {}
  for (const r of rows) {
    if (!byDate[r.data_snapshot]) byDate[r.data_snapshot] = {}
    byDate[r.data_snapshot][r.estagio] = (byDate[r.data_snapshot][r.estagio] ?? 0) + 1
  }

  const data = Object.keys(byDate).sort().map(date => {
    const row: { date: string; [estagio: string]: string | number } = { date }
    for (const estagio of PARCEIRO_ESTAGIOS) row[estagio] = byDate[date][estagio] ?? 0
    return row
  })

  if (data.length === 0) {
    return <p className="text-sm text-slate-400">Sem snapshots de parceiros nesse período.</p>
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip />
        <Legend formatter={(value: string) => PARCEIRO_ESTAGIO_LABELS[value as keyof typeof PARCEIRO_ESTAGIO_LABELS] ?? value} />
        {PARCEIRO_ESTAGIOS.map(estagio => (
          <Bar
            key={estagio}
            dataKey={estagio}
            stackId="estagio"
            fill={PARCEIRO_ESTAGIO_COLORS[estagio]}
            name={estagio}
            stroke="#fcfcfb"
            strokeWidth={1}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
