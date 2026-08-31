import { SupabaseClient } from '@supabase/supabase-js'

// Three tables populated daily by an external n8n workflow — read-only from
// this app's side (see migration 018 for the RLS read policy).

export interface ResumoDiarioRow {
  vendedor: string
  data_atividade: string
  // Combined totals — fornecedor already excluded from both, kept for
  // whatever still reads the un-split numbers (e.g. the weekly scorecard).
  total_conversas_whatsapp: number
  total_ligacoes: number
  ligacoes_detalhe: Record<string, number> | null
  // Cliente/parceiro split (fornecedor excluded from both sides too).
  total_conversas_cliente: number
  total_conversas_parceiro: number
  total_ligacoes_cliente: number
  total_ligacoes_parceiro: number
  ligacoes_detalhe_cliente: Record<string, number> | null
  ligacoes_detalhe_parceiro: Record<string, number> | null
}

export async function getResumoDiario(
  supabase: SupabaseClient, since: string, until: string
): Promise<ResumoDiarioRow[]> {
  const { data, error } = await supabase
    .from('[FH]atividade_vendedor_resumo_diario')
    .select(`
      vendedor, data_atividade, total_conversas_whatsapp, total_ligacoes, ligacoes_detalhe,
      total_conversas_cliente, total_conversas_parceiro,
      total_ligacoes_cliente, total_ligacoes_parceiro,
      ligacoes_detalhe_cliente, ligacoes_detalhe_parceiro
    `)
    .gte('data_atividade', since)
    .lte('data_atividade', until)
  if (error) throw error
  return data ?? []
}

export type AtividadeTipo = 'cliente' | 'parceiro'

export interface AtividadeLogRow {
  vendedor: string
  contato_nome: string | null
  contato_telefone: string | null
  resumo: string | null
  qtd_mensagens: number
  data_atividade: string
  tipo: AtividadeTipo
}

export async function getAtividadeLog(
  supabase: SupabaseClient, since: string, until: string
): Promise<AtividadeLogRow[]> {
  const { data, error } = await supabase
    .from('[FH]atividade_vendedor_log')
    .select('vendedor, contato_nome, contato_telefone, resumo, qtd_mensagens, data_atividade, tipo')
    .gte('data_atividade', since)
    .lte('data_atividade', until)
    .order('data_atividade', { ascending: false })
  if (error) throw error
  return data ?? []
}

export type ParceiroEstagio =
  | 'novo_parceiro' | 'em_aquecimento' | 'ativo' | 'parceiro_chave'
  | 'esfriando' | 'abandonado' | 'inativo'

export interface ParceiroStatusRow {
  contact_id: string
  nome: string | null
  owner_id: string | null
  estagio: ParceiroEstagio
  negocios_fechados: number | null
  dias_desde_contato: number | null
  data_snapshot: string
}

export async function getParceiroStatusLog(
  supabase: SupabaseClient, since: string, until: string
): Promise<ParceiroStatusRow[]> {
  const { data, error } = await supabase
    .from('[FH]parceiro_status_log')
    .select('contact_id, nome, owner_id, estagio, negocios_fechados, dias_desde_contato, data_snapshot')
    .gte('data_snapshot', since)
    .lte('data_snapshot', until)
  if (error) throw error
  return data ?? []
}

export const PARCEIRO_ESTAGIOS: ParceiroEstagio[] = [
  'novo_parceiro', 'em_aquecimento', 'ativo', 'parceiro_chave', 'esfriando', 'abandonado', 'inativo',
]

// Growth track (ordered, funnel-style) vs. risk/lost group — not a single
// linear sequence, "esfriando" etc. don't follow from "parceiro_chave".
export const PARCEIRO_GROWTH_STAGES: ParceiroEstagio[] = ['novo_parceiro', 'em_aquecimento', 'ativo', 'parceiro_chave']
export const PARCEIRO_RISK_STAGES: ParceiroEstagio[] = ['esfriando', 'abandonado', 'inativo']

export const PARCEIRO_ESTAGIO_LABELS: Record<ParceiroEstagio, string> = {
  novo_parceiro: 'Novo parceiro',
  em_aquecimento: 'Em aquecimento',
  ativo: 'Ativo',
  parceiro_chave: 'Parceiro chave',
  esfriando: 'Esfriando',
  abandonado: 'Abandonado',
  inativo: 'Inativo',
}

// Two tracks, not a single linear ramp: growth (blue -> green) vs. risk
// (amber -> red -> gray) — "em_aquecimento" (warming up) is a good sign,
// not a warning, so it doesn't share the risk track's hues.
export const PARCEIRO_ESTAGIO_COLORS: Record<ParceiroEstagio, string> = {
  novo_parceiro: '#93c5fd',
  em_aquecimento: '#3b82f6',
  ativo: '#4ade80',
  parceiro_chave: '#16a34a',
  esfriando: '#fbbf24',
  abandonado: '#ef4444',
  inativo: '#94a3b8',
}

// This business's HubSpot portal id, for direct contact-record links.
export const HUBSPOT_PORTAL_ID = '5529297'

export interface PartnerCurrent {
  contact_id: string
  nome: string | null
  owner_id: string | null
  estagio: ParceiroEstagio
  negocios_fechados: number | null
  dias_desde_contato: number | null
  data_snapshot: string
}

/**
 * Current state per partner — the log has one row per contact per day, so
 * this keeps only each contact_id's most recent snapshot. Reduced in JS
 * rather than a SQL DISTINCT ON/window function to avoid a new RPC for a
 * dataset this small (a few hundred partners at most).
 */
export async function getPartnerCurrentStatus(supabase: SupabaseClient): Promise<PartnerCurrent[]> {
  const lookback = new Date()
  lookback.setDate(lookback.getDate() - 35)
  const lookbackStr = lookback.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('[FH]parceiro_status_log')
    .select('contact_id, nome, owner_id, estagio, negocios_fechados, dias_desde_contato, data_snapshot')
    .gte('data_snapshot', lookbackStr)
    .order('data_snapshot', { ascending: false })
  if (error) throw error

  const latestByContact = new Map<string, PartnerCurrent>()
  for (const row of data ?? []) {
    if (!latestByContact.has(row.contact_id)) latestByContact.set(row.contact_id, row)
  }
  return [...latestByContact.values()]
}
