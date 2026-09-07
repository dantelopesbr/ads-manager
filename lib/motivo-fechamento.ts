import { SupabaseClient } from '@supabase/supabase-js'

// Populated by an external n8n job from HubSpot's closed_lost_reason /
// closed_won_reason dropdowns — historical deals from before these became
// fixed dropdowns can still carry stale free-text values (confirmed via
// direct query: e.g. "SOU FODA", "acompanhamento pelo whatsap" alongside
// the real enum values). Anything outside the known enum buckets into
// "outro" rather than being dropped or crashing.

export const LOST_REASONS = [
  'concorrencia', 'produto_estoque', 'produto_prazo', 'preco', 'timing', 'sem_decisao', 'nao_retornamos',
] as const
export type LostReason = (typeof LOST_REASONS)[number]

export const LOST_REASON_LABELS: Record<LostReason, string> = {
  concorrencia: 'Concorrência',
  produto_estoque: 'Sem estoque',
  produto_prazo: 'Prazo',
  preco: 'Preço',
  timing: 'Timing',
  sem_decisao: 'Sem decisão',
  nao_retornamos: 'Não retornamos',
}

export const WON_REASONS = [
  'produto_certo', 'preco_bom', 'confiou_atendimento', 'pronta_entrega', 'indicacao', 'ja_era_cliente',
] as const
export type WonReason = (typeof WON_REASONS)[number]

export const WON_REASON_LABELS: Record<WonReason, string> = {
  produto_certo: 'Produto certo',
  preco_bom: 'Preço bom',
  confiou_atendimento: 'Confiou no atendimento',
  pronta_entrega: 'Pronta entrega',
  indicacao: 'Indicação',
  ja_era_cliente: 'Já era cliente',
}

export function isLostReason(value: string | null): value is LostReason {
  return value !== null && (LOST_REASONS as readonly string[]).includes(value)
}

export function isWonReason(value: string | null): value is WonReason {
  return value !== null && (WON_REASONS as readonly string[]).includes(value)
}

export interface DealMotivoRow {
  deal_id: string
  dealname: string | null
  vendedor: string | null
  dealstage: 'closedlost' | 'closedwon'
  closed_lost_reason: string | null
  closed_won_reason: string | null
  amount: number | null
  closedate: string
}

export async function getDealMotivoFechamento(
  supabase: SupabaseClient, since: string, until: string
): Promise<DealMotivoRow[]> {
  const { data, error } = await supabase
    .from('[FH]deal_motivo_fechamento')
    .select('deal_id, dealname, vendedor, dealstage, closed_lost_reason, closed_won_reason, amount, closedate')
    .gte('closedate', since)
    .lte('closedate', until)
  if (error) throw error
  return data ?? []
}
