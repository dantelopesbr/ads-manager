'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface ChartPoint {
  date: string
  leads: number
  spend: number
  cpl: number | null
}

export function PerformanceChart({ data }: { data: ChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
        <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} tickFormatter={(v) => `R$${v}`} />
        <Tooltip
          formatter={(value, name) => {
            if (name === 'Spend (R$)' || name === 'CPL (R$)') return [`R$${value}`, name]
            return [value, name]
          }}
        />
        <Legend />
        <Line yAxisId="left" type="monotone" dataKey="leads" stroke="#6366f1" name="Leads" dot={false} />
        <Line yAxisId="right" type="monotone" dataKey="spend" stroke="#f59e0b" name="Spend (R$)" dot={false} />
        <Line yAxisId="right" type="monotone" dataKey="cpl" stroke="#ef4444" name="CPL (R$)" dot={false} connectNulls={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
