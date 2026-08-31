// Shared HubSpot deal_stage → funnel bucket mapping. This account uses custom
// pipeline stage IDs (not HubSpot's generic lifecycle stages), reused here from
// the Leads table's badge so the dashboard funnel and the Leads filters agree.
export type FunnelBucket = 'Lead' | 'Inativo' | 'Orçamento' | 'Venda Realizada' | 'Venda Perdida' | 'Outro'

export const DEAL_STAGE_MAP: Record<string, { label: FunnelBucket; className: string }> = {
  appointmentscheduled: { label: 'Lead',            className: 'bg-slate-100 text-slate-700 border-slate-200' },
  qualifiedtobuy:       { label: 'Orçamento',       className: 'bg-amber-50 text-amber-700 border-amber-200' },
  closedwon:            { label: 'Venda Realizada', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  closedlost:           { label: 'Venda Perdida',   className: 'bg-red-50 text-red-600 border-red-200' },
  checkout_abandoned:   { label: 'Lead',            className: 'bg-slate-100 text-slate-700 border-slate-200' },
  checkout_pending:     { label: 'Orçamento',       className: 'bg-amber-50 text-amber-700 border-amber-200' },
  processed:            { label: 'Venda Realizada', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cancelled:            { label: 'Venda Perdida',   className: 'bg-red-50 text-red-600 border-red-200' },
  '1374501735':         { label: 'Inativo',         className: 'bg-violet-50 text-violet-700 border-violet-200' },
}

export const STATUS_GROUPS: Record<string, string[]> = {
  'Lead':            ['appointmentscheduled', 'checkout_abandoned'],
  'Inativo':         ['1374501735'],
  'Orçamento':       ['qualifiedtobuy', 'checkout_pending'],
  'Venda Realizada': ['closedwon', 'processed'],
  'Venda Perdida':   ['closedlost', 'cancelled'],
}

/** Ordered funnel stages with their bar/legend colors — status semantics (won=good, lost=critical). */
export const FUNNEL_STAGES: { bucket: FunnelBucket; barClassName: string; dotClassName: string }[] = [
  { bucket: 'Lead',              barClassName: 'bg-slate-300',   dotClassName: 'bg-slate-400' },
  { bucket: 'Inativo',           barClassName: 'bg-violet-300',  dotClassName: 'bg-violet-400' },
  { bucket: 'Orçamento',         barClassName: 'bg-amber-400',   dotClassName: 'bg-amber-500' },
  { bucket: 'Venda Realizada',   barClassName: 'bg-emerald-500', dotClassName: 'bg-emerald-500' },
  { bucket: 'Venda Perdida',     barClassName: 'bg-red-400',     dotClassName: 'bg-red-500' },
]

/** A lead with no HubSpot match yet is still in the earliest stage, not unclassified. */
export function bucketDealStage(stage: string | null): FunnelBucket {
  if (!stage) return 'Lead'
  return DEAL_STAGE_MAP[stage]?.label ?? 'Outro'
}
