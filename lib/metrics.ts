export function calcCPL(spend: number | null, leads: number): number | null {
  if (spend === null || leads === 0) return null
  return spend / leads
}

export function calcCTR(clicks: number | null, impressions: number | null): number | null {
  if (clicks === null || impressions === null || impressions === 0) return null
  return clicks / impressions
}

export function calcROAS(dealValue: number | null, spend: number | null): number | null {
  if (dealValue === null || spend === null || spend === 0) return null
  return dealValue / spend
}

export function formatROAS(value: number | null): string {
  if (value === null) return '—'
  return `${value.toFixed(2)}x`
}

export function formatCurrency(value: number | null): string {
  if (value === null) return '—'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatPercent(value: number | null): string {
  if (value === null) return '—'
  return `${(value * 100).toFixed(2)}%`
}
