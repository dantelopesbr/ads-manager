import { SupabaseClient } from '@supabase/supabase-js'

// Populated by an external n8n job from HubSpot (contact's origem_do_lead +
// hs_analytics_source, joined onto every deal regardless of stage) — a
// point-in-time export for now, not a recurring sync.

export interface LeadCanalRow {
  deal_id: string
  vendedor: string | null
  origem_do_lead: string | null
  hs_analytics_source: string | null
  dealstage: string
  amount: number | null
  create_date: string
  closedate: string | null
}

export async function getLeadCanalVendedor(
  supabase: SupabaseClient, since: string, until: string
): Promise<LeadCanalRow[]> {
  const { data, error } = await supabase
    .from('[FH]lead_canal_vendedor')
    .select('deal_id, vendedor, origem_do_lead, hs_analytics_source, dealstage, amount, create_date, closedate')
    .gte('create_date', since)
    .lte('create_date', until)
  if (error) throw error
  return data ?? []
}

/**
 * "Veio do Instagram" per Dante's confirmed definition: origem_do_lead =
 * "Cliente Instagram" AND hs_analytics_source = "SOCIAL_MEDIA" — deliberately
 * includes WhatsApp conversations that originated from an Instagram
 * touchpoint, excludes PAID_SOCIAL (ad clicks, tracked separately) and
 * OFFLINE (manual entry, no real source).
 */
export function isInstagramLead(r: Pick<LeadCanalRow, 'origem_do_lead' | 'hs_analytics_source'>): boolean {
  return r.origem_do_lead === 'Cliente Instagram' && r.hs_analytics_source === 'SOCIAL_MEDIA'
}
