// Vendor identity for WhatsApp messages comes from phone_fratelli (which team
// line handled the conversation), joined against phones_team_fratelli — not
// from the free-text `source` column, which is noisy (sometimes the sender's
// name, sometimes the client's saved contact name). `source` is only used
// afterward to detect bot-sent messages.
//
// phone_fratelli in [FH]conversation_Whatsapp is missing the leading "9" that
// Brazilian mobile numbers have in phones_team_fratelli (e.g. "+554498380507"
// vs "+5544998380507") — match on the last 8 digits, which is stable across
// both formats and doesn't collide across the ~9 known team numbers.
export function normalizePhoneSuffix(phone: string | null): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (!digits) return null
  return digits.length >= 8 ? digits.slice(-8) : digits
}

export function buildTeamPhoneIndex(teamPhones: { phone: string; name: string }[]): Map<string, string> {
  const index = new Map<string, string>()
  for (const { phone, name } of teamPhones) {
    const key = normalizePhoneSuffix(phone)
    if (key) index.set(key, name)
  }
  return index
}

// phones_team_fratelli.name → canonical first name, for the four salespeople
// this KPI tracks. Other entries (the shared "Fratelli House"/"Fratelli Rev"
// lines, "Administrativo Fratelli", personal numbers) aren't a specific
// vendor's line, so messages routed through them fall to the "outro" bucket
// unless they're bot-tagged (see classifyMessage).
const TEAM_LABEL_TO_VENDOR: Record<string, string> = {
  'Dante - Fratelli': 'Dante',
  'Wakilla - Fratelli': 'Wakilla',
  'Ketlyn - Fratelli': 'Ketlyn',
  'Giovany - Fratelli': 'Giovany',
}

export const KNOWN_VENDORS = ['Dante', 'Wakilla', 'Ketlyn', 'Giovany'] as const

// Bot messages are split by which shared line sent them (Fratelli House vs
// FratelliRev's own IA), not lumped into one generic "IA" bucket.
const IA_LABEL_BY_TEAM_LABEL: Record<string, string> = {
  'Fratelli House': 'IA Fratelli House',
  'Fratelli Rev': 'IA Fratelli Rev',
}
export const IA_VENDORS = ['IA Fratelli House', 'IA Fratelli Rev'] as const
const IA_FALLBACK = 'IA Fratelli House' // bot-tagged messages not on either shared line (e.g. "IA - Dante")

export type MessageBucket = 'vendedor' | 'ia' | 'outro'

export interface ClassifiedMessage {
  type: MessageBucket
  vendor?: string
}

export function classifyMessage(source: string | null, teamLabel: string | null): ClassifiedMessage {
  if (source && /\bIA\b/.test(source)) {
    const iaLabel = (teamLabel && IA_LABEL_BY_TEAM_LABEL[teamLabel]) || IA_FALLBACK
    return { type: 'ia', vendor: iaLabel }
  }
  if (teamLabel) {
    const vendor = TEAM_LABEL_TO_VENDOR[teamLabel]
    if (vendor) return { type: 'vendedor', vendor }
  }
  return { type: 'outro' }
}
