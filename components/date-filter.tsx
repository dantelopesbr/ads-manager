'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { format, startOfWeek, startOfMonth, endOfMonth, subMonths } from 'date-fns'

interface Props {
  from: string
  to: string
}

const fmt = (d: Date) => format(d, 'yyyy-MM-dd')

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

  const setRange = useCallback((rangeFrom: string, rangeTo: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('from', rangeFrom)
    params.set('to', rangeTo)
    router.push(`${pathname}?${params.toString()}`)
  }, [router, pathname, searchParams])

  const today = new Date()
  const shortcuts = [
    { label: 'Hoje', from: fmt(today), to: fmt(today) },
    { label: 'Semana', from: fmt(startOfWeek(today, { weekStartsOn: 1 })), to: fmt(today) },
    { label: 'Mês', from: fmt(startOfMonth(today)), to: fmt(today) },
    { label: 'Mês passado', from: fmt(startOfMonth(subMonths(today, 1))), to: fmt(endOfMonth(subMonths(today, 1))) },
  ]

  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="flex items-center gap-1">
        {shortcuts.map(s => (
          <button
            key={s.label}
            onClick={() => setRange(s.from, s.to)}
            className="px-2.5 py-1.5 rounded-sm text-xs text-slate-500 border hover:bg-slate-50 transition-colors"
          >
            {s.label}
          </button>
        ))}
      </div>
      <span className="text-slate-500">De</span>
      <input
        type="date"
        value={from}
        onChange={e => update('from', e.target.value)}
        className="border rounded-sm px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
      />
      <span className="text-slate-500">até</span>
      <input
        type="date"
        value={to}
        onChange={e => update('to', e.target.value)}
        className="border rounded-sm px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
      />
      <button
        onClick={() => {
          const params = new URLSearchParams(searchParams.toString())
          params.delete('from')
          params.delete('to')
          router.push(`${pathname}?${params.toString()}`)
        }}
        className="px-3 py-1.5 rounded-sm text-xs text-slate-500 border hover:bg-slate-50 transition-colors"
      >
        Limpar
      </button>
    </div>
  )
}
