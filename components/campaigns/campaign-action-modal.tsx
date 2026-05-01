'use client'

import { useState } from 'react'
import { formatCurrency } from '@/lib/metrics'

type ActionType = 'pause' | 'budget'

interface Props {
  campaignId: string
  campaignName: string
  actionType: ActionType
  currentBudget?: number  // current daily budget in BRL (decimal), optional for pause
  onClose: () => void
  onSuccess: () => void
}

export function CampaignActionModal({
  campaignId,
  campaignName,
  actionType,
  currentBudget,
  onClose,
  onSuccess,
}: Props) {
  const [newBudget, setNewBudget] = useState<string>(
    currentBudget ? String(currentBudget) : ''
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dryRunResult, setDryRunResult] = useState<string | null>(null)

  async function callAPI(dryRun: boolean) {
    setError(null)
    setLoading(true)

    const body: Record<string, unknown> = { action: actionType, dry_run: dryRun }
    if (actionType === 'budget') {
      const brl = parseFloat(newBudget.replace(',', '.'))
      if (isNaN(brl) || brl <= 0) {
        setError('Valor inválido. Digite um número positivo em BRL.')
        setLoading(false)
        return
      }
      body.daily_budget_cents = Math.round(brl * 100)
    }

    try {
      const res = await fetch(`/api/meta/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro desconhecido')
      if (dryRun) {
        setDryRunResult(data.message)
      } else {
        onSuccess()
        onClose()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
        {/* Header */}
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            {actionType === 'pause' ? '⏸ Pausar Campanha' : '💰 Alterar Budget Diário'}
          </h3>
          <p className="text-sm text-slate-500 mt-1 truncate">{campaignName}</p>
        </div>

        {/* Content */}
        {actionType === 'pause' && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800 space-y-1">
            <p className="font-medium">⚠️ Atenção</p>
            <p>A campanha será pausada imediatamente. Para reativar, use o Meta Ads Manager.</p>
          </div>
        )}

        {actionType === 'budget' && (
          <div className="space-y-3">
            {currentBudget !== undefined && (
              <p className="text-sm text-slate-500">
                Budget atual: <span className="font-medium text-slate-800">{formatCurrency(currentBudget)}</span>/dia
              </p>
            )}
            <div>
              <label htmlFor="budget-input" className="block text-sm font-medium text-slate-700 mb-1">
                Novo budget diário (R$)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">R$</span>
                <input
                  id="budget-input"
                  type="text"
                  inputMode="decimal"
                  value={newBudget}
                  onChange={e => setNewBudget(e.target.value)}
                  placeholder="ex: 200.00"
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">Será convertido para centavos na API da Meta.</p>
            </div>
          </div>
        )}

        {/* Dry run result */}
        {dryRunResult && (
          <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
            <span className="font-mono">✓ {dryRunResult}</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2 px-4 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => callAPI(true)}
            disabled={loading}
            className="py-2 px-4 rounded-lg border border-blue-200 bg-blue-50 text-sm text-blue-700 hover:bg-blue-100 transition-colors"
          >
            Simular (Dry Run)
          </button>
          <button
            onClick={() => callAPI(false)}
            disabled={loading}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium text-white transition-colors ${
              loading
                ? 'bg-slate-300 cursor-not-allowed'
                : actionType === 'pause'
                  ? 'bg-amber-500 hover:bg-amber-600'
                  : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'Aguarde...' : actionType === 'pause' ? 'Pausar' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}
