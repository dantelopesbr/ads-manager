'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

interface Props {
  from: string
  to: string
}

export function DateFilter({ from, to }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const update = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.push(`${pathname}?${params.toString()}`)
  }, [router, pathname, searchParams])

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-slate-500">De</span>
      <input
        type="date"
        value={from}
        onChange={e => update('from', e.target.value)}
        className="border rounded-md px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
      />
      <span className="text-slate-500">até</span>
      <input
        type="date"
        value={to}
        onChange={e => update('to', e.target.value)}
        className="border rounded-md px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
      />
      <button
        onClick={() => {
          const params = new URLSearchParams(searchParams.toString())
          params.delete('from')
          params.delete('to')
          router.push(`${pathname}?${params.toString()}`)
        }}
        className="px-3 py-1.5 rounded-md text-xs text-slate-500 border hover:bg-slate-50 transition-colors"
      >
        Limpar
      </button>
    </div>
  )
}
