'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { AccountKey } from '@/lib/account'

interface Props {
  account: AccountKey
  label: string
  initialCplTarget: number | null
  initialRoasTarget: number | null
}

export function TargetsForm({ account, label, initialCplTarget, initialRoasTarget }: Props) {
  const [cplTarget, setCplTarget] = useState(initialCplTarget?.toString() ?? '')
  const [roasTarget, setRoasTarget] = useState(initialRoasTarget?.toString() ?? '')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setResult(null)
    try {
      const res = await fetch('/api/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account, cpl_target: cplTarget, roas_target: roasTarget }),
      })
      const json = await res.json()
      setResult(res.ok ? 'Salvo' : `Erro: ${json.error}`)
    } catch {
      setResult('Erro de rede')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-end gap-3">
      <div className="flex-1">
        <p className="text-sm font-medium mb-2">{label}</p>
        <div className="flex gap-3">
          <div>
            <Label htmlFor={`cpl-${account}`} className="text-xs text-slate-400">CPL máx. (R$)</Label>
            <Input
              id={`cpl-${account}`}
              type="number"
              step="0.01"
              placeholder="ex: 45.00"
              value={cplTarget}
              onChange={e => setCplTarget(e.target.value)}
              className="w-28"
            />
          </div>
          <div>
            <Label htmlFor={`roas-${account}`} className="text-xs text-slate-400">ROAS mín. (x)</Label>
            <Input
              id={`roas-${account}`}
              type="number"
              step="0.1"
              placeholder="ex: 3.0"
              value={roasTarget}
              onChange={e => setRoasTarget(e.target.value)}
              className="w-28"
            />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {result && <span className="text-xs text-slate-500">{result}</span>}
        <Button size="sm" variant="outline" onClick={handleSave} disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </div>
  )
}
