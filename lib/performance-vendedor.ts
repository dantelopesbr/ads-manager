import { SupabaseClient } from '@supabase/supabase-js'
import { startOfMonth, endOfMonth, eachMonthOfInterval, differenceInCalendarDays, format } from 'date-fns'

// Populated daily by an external n8n workflow (arquitetos-vendedores), from
// HubSpot deals_raw — read-only from this app's side.

export interface PerformanceVendedorRow {
  vendedor: string
  data: string
  receita_fechada: number
  deals_criados: number
  deals_ganhos: number
}

export async function getPerformanceVendedorDiario(
  supabase: SupabaseClient, since: string, until: string
): Promise<PerformanceVendedorRow[]> {
  const { data, error } = await supabase
    .from('[FH]performance_vendedor_diario')
    .select('vendedor, data, receita_fechada, deals_criados, deals_ganhos')
    .gte('data', since)
    .lte('data', until)
  if (error) throw error
  return data ?? []
}

export interface MetaVendedorRow {
  vendedor: string
  mes: string
  meta_valor: number
}

export async function getMetaVendedorMensal(
  supabase: SupabaseClient, since: string, until: string
): Promise<MetaVendedorRow[]> {
  const fromMonth = format(startOfMonth(new Date(since)), 'yyyy-MM-dd')
  const toMonth = format(startOfMonth(new Date(until)), 'yyyy-MM-dd')
  const { data, error } = await supabase
    .from('[FH]meta_vendedor_mensal')
    .select('vendedor, mes, meta_valor')
    .gte('mes', fromMonth)
    .lte('mes', toMonth)
  if (error) throw error
  return data ?? []
}

// Daily snapshot of "how many deals sit in each stage today", counted
// directly from HubSpot deals_raw (BigQuery) per owner — not scoped to a
// date range like performance_vendedor_diario, and not derived from this
// app's own hubspot_contacts snapshot (which lags too far behind real
// stage changes to be trustworthy for a funnel).
export interface FunilVendedorRow {
  vendedor: string
  data: string
  lead: number
  orcamento: number
  venda_realizada: number
  venda_perdida: number
  inativo: number
}

/**
 * Latest snapshot per vendor — same "keep only the most recent row per key"
 * reduction as getPartnerCurrentStatus, since this table is a daily
 * point-in-time board, not additive across days.
 */
export async function getFunilVendedorAtual(supabase: SupabaseClient): Promise<FunilVendedorRow[]> {
  const lookback = new Date()
  lookback.setDate(lookback.getDate() - 35)
  const lookbackStr = format(lookback, 'yyyy-MM-dd')

  const { data, error } = await supabase
    .from('[FH]funil_vendedor_diario')
    .select('vendedor, data, lead, orcamento, venda_realizada, venda_perdida, inativo')
    .gte('data', lookbackStr)
    .order('data', { ascending: false })
  if (error) throw error

  const latestByVendor = new Map<string, FunilVendedorRow>()
  for (const row of data ?? []) {
    if (!latestByVendor.has(row.vendedor)) latestByVendor.set(row.vendedor, row)
  }
  return [...latestByVendor.values()]
}

/**
 * Meta proportional to the days of [since, until] that fall in each month —
 * summed across months when the range spans more than one. Returns null
 * when no month in range has a meta defined (vs. 0, which would mean a
 * defined meta of zero).
 */
export function proportionalMeta(
  since: Date, until: Date, metaByMonth: Record<string, number>
): number | null {
  const months = eachMonthOfInterval({ start: startOfMonth(since), end: startOfMonth(until) })
  let total = 0
  let hasAny = false
  for (const m of months) {
    const monthKey = format(startOfMonth(m), 'yyyy-MM-dd')
    const metaValor = metaByMonth[monthKey]
    if (metaValor == null) continue
    hasAny = true
    const mStart = startOfMonth(m)
    const mEnd = endOfMonth(m)
    const rangeStart = since > mStart ? since : mStart
    const rangeEnd = until < mEnd ? until : mEnd
    const daysInRange = differenceInCalendarDays(rangeEnd, rangeStart) + 1
    const daysInMonth = differenceInCalendarDays(mEnd, mStart) + 1
    total += metaValor * (daysInRange / daysInMonth)
  }
  return hasAny ? total : null
}
