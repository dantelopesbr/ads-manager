'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'

// Fixed order, never reassigned by rank — identity color, not status. Distinct
// from the emerald/red/amber already used for won/lost/warning elsewhere in
// this app, so a line here never reads as a status signal.
const VENDOR_COLORS: Record<string, string> = {
  Dante: '#2a78d6',
  Wakilla: '#4a3aa7',
  Ketlyn: '#eb6834',
  Giovany: '#e87ba4',
  'IA Fratelli House': '#94a3b8',
  'IA Fratelli Rev': '#cbd5e1',
}

interface ChartPoint {
  date: string
  [vendor: string]: string | number
}

export function MessagesChart({ data, vendors }: { data: ChartPoint[]; vendors: string[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data}>
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip />
        <Legend />
        {vendors.map(vendor => (
          <Line
            key={vendor}
            type="monotone"
            dataKey={vendor}
            stroke={VENDOR_COLORS[vendor] ?? '#94a3b8'}
            strokeWidth={2}
            dot={false}
            name={vendor}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
