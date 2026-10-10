'use client'

import { useRouter } from 'next/navigation'

export function VendorSelect({ current, vendors, mes }: { current: string; vendors: string[]; mes: string }) {
  const router = useRouter()

  return (
    <select
      value={current}
      onChange={e => router.push(`/vendedores/${encodeURIComponent(e.target.value)}?mes=${mes}`)}
      className="border rounded-sm px-2 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50"
    >
      {vendors.map(v => (
        <option key={v} value={v}>{v}</option>
      ))}
    </select>
  )
}
