'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export function SyncButton({ endpoint, label }: { endpoint: string; label: string }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function handleSync() {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET ?? ''}` },
      })
      const json = await res.json()
      setResult(res.ok ? 'OK' : `Erro: ${json.error}`)
    } catch {
      setResult('Erro de rede')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {result && <span className="text-xs text-slate-500">{result}</span>}
      <Button size="sm" variant="outline" onClick={handleSync} disabled={loading}>
        {loading ? 'Sincronizando...' : label}
      </Button>
    </div>
  )
}
