'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'

// Fixed order, never reassigned by rank — identity color, not status. Distinct
// from the emerald/red/amber already used for won/lost/warning elsewhere in
// this app, so a line here never reads as a status signal.
const KNOWN_COLORS: Record<string, string> = {
  Dante: '#2a78d6',
  Wakilla: '#4a3aa7',
  Ketlyn: '#eb6834',
  Giovany: '#e87ba4',
  'IA Fratelli House': '#94a3b8',
  'IA Fratelli Rev': '#cbd5e1',
}

// Calls can have HubSpot owners beyond the four known salespeople — this
// fallback palette is assigned by first-appearance order (stable within a
// render, not reassigned by rank) rather than left as a single flat gray.
const FALLBACK_PALETTE = ['#1baf7a', '#eda100', '#008300', '#e34948']

interface ChartPoint {
  date: string
  [vendor: string]: string | number
}

export function ActivityChart({ data, vendors }: { data: ChartPoint[]; vendors: string[] }) {
  let fallbackIndex = 0
  const colorFor = (vendor: string) => {
    if (KNOWN_COLORS[vendor]) return KNOWN_COLORS[vendor]
    const color = FALLBACK_PALETTE[fallbackIndex % FALLBACK_PALETTE.length]
    fallbackIndex++
    return color
  }

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
            stroke={colorFor(vendor)}
            strokeWidth={2}
            dot={false}
            name={vendor}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
