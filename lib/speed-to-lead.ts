import { SupabaseClient } from '@supabase/supabase-js'

// Populated daily by an external n8n workflow (05:30) from HubSpot response
// timestamps — read-only from this app's side. Has real large outliers (a
// single lead can sit unanswered for days), so médio/mediana are kept
// separate per day rather than collapsed into one all-time average.
export interface SpeedToLeadRow {
  vendedor: string
  cod_hubspot: string
  data: string
  qtd_leads_respondidos: number
  tempo_resposta_medio_minutos: number
  tempo_resposta_mediana_minutos: number
}

export async function getSpeedToLeadVendedor(
  supabase: SupabaseClient, since: string, until: string
): Promise<SpeedToLeadRow[]> {
  const { data, error } = await supabase
    .from('[FH]speed_to_lead_vendedor_diario')
    .select('vendedor, cod_hubspot, data, qtd_leads_respondidos, tempo_resposta_medio_minutos, tempo_resposta_mediana_minutos')
    .gte('data', since)
    .lte('data', until)
  if (error) throw error
  return data ?? []
}

/** "2d 5h", "3h 40min", "12min" — minutes alone are unreadable once a lead sits for days. */
export function formatMinutes(minutes: number): string {
  const totalMin = Math.round(minutes)
  const days = Math.floor(totalMin / 1440)
  const hours = Math.floor((totalMin % 1440) / 60)
  const mins = totalMin % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}min`
  return `${mins}min`
}
