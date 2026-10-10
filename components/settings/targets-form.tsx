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
  initialCplAlertMultiplier: number
  initialCtrAlertMin: number
}

export function TargetsForm({
  account, label, initialCplTarget, initialRoasTarget, initialCplAlertMultiplier, initialCtrAlertMin,
}: Props) {
  const [cplTarget, setCplTarget] = useState(initialCplTarget?.toString() ?? '')
  const [roasTarget, setRoasTarget] = useState(initialRoasTarget?.toString() ?? '')
  const [cplAlertMultiplier, setCplAlertMultiplier] = useState(initialCplAlertMultiplier.toString())
  const [ctrAlertPct, setCtrAlertPct] = useState((initialCtrAlertMin * 100).toString())
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setResult(null)
    try {
      const res = await fetch('/api/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account,
          cpl_target: cplTarget,
          roas_target: roasTarget,
          cpl_alert_multiplier: cplAlertMultiplier,
          ctr_alert_pct: ctrAlertPct,
        }),
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
    <div className="flex items-end gap-3 flex-wrap">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium mb-2">{label}</p>
        <div className="flex gap-3 flex-wrap">
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
          <div>
            <Label htmlFor={`cpl-alert-${account}`} className="text-xs text-slate-400">Alerta CPL (x média)</Label>
            <Input
              id={`cpl-alert-${account}`}
              type="number"
              step="0.1"
              placeholder="ex: 1.5"
              value={cplAlertMultiplier}
              onChange={e => setCplAlertMultiplier(e.target.value)}
              className="w-28"
            />
          </div>
          <div>
            <Label htmlFor={`ctr-alert-${account}`} className="text-xs text-slate-400">Alerta CTR mín. (%)</Label>
            <Input
              id={`ctr-alert-${account}`}
              type="number"
              step="0.01"
              placeholder="ex: 0.3"
              value={ctrAlertPct}
              onChange={e => setCtrAlertPct(e.target.value)}
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
