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
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs text-slate-400 mb-2 font-medium">LEADS · SPEND</p>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data}>
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
            <Tooltip formatter={(value, name) => name === 'Spend (R$)' ? [`R$${value}`, name] : [value, name]} />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="leads" stroke="#6366f1" name="Leads" dot={false} />
            <Line yAxisId="right" type="monotone" dataKey="spend" stroke="#f59e0b" name="Spend (R$)" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div>
        <p className="text-xs text-slate-400 mb-2 font-medium">CPL (R$)</p>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data}>
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="left" tick={false} axisLine={false} tickLine={false} width={40} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
            <Tooltip formatter={(value) => [`R$${value}`, 'CPL']} />
            <Line yAxisId="right" type="monotone" dataKey="cpl" stroke="#ef4444" name="CPL (R$)" dot={false} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
