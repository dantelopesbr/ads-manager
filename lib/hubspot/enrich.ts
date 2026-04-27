import { SupabaseClient } from '@supabase/supabase-js'
import { searchContactByPhone, getTotalDealValue } from './client'

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt === maxAttempts) throw err
      await sleep(Math.pow(2, attempt) * 500)
    }
  }
  throw new Error('Max retries exceeded')
}

const RESYNC_AFTER_DAYS = 7
const BATCH_LIMIT = 50

export async function enrichLeads(supabase: SupabaseClient): Promise<number> {
  const apiKey = process.env.HUBSPOT_API_KEY!

  // All phones from conversions
  const { data: conversions } = await supabase
    .from('meta_ads_conversions')
    .select('phone_client')
    .not('phone_client', 'is', null)

  if (!conversions?.length) return 0

  const allPhones = [...new Set(conversions.map(c => c.phone_client as string))]

  // Phones already synced recently (< RESYNC_AFTER_DAYS ago)
  const resyncCutoff = new Date()
  resyncCutoff.setDate(resyncCutoff.getDate() - RESYNC_AFTER_DAYS)

  const { data: recentlySynced } = await supabase
    .from('hubspot_contacts')
    .select('phone')
    .gte('updated_at', resyncCutoff.toISOString())

  const skipPhones = new Set((recentlySynced ?? []).map(c => c.phone))

  // Only process new or stale contacts, limited to BATCH_LIMIT per run
  const toSync = allPhones.filter(p => !skipPhones.has(p)).slice(0, BATCH_LIMIT)

  if (toSync.length === 0) return 0

  let enriched = 0

  for (const phone of toSync) {
    try {
      const contact = await withRetry(() => searchContactByPhone(phone, apiKey))
      if (!contact) continue

      const deal = await withRetry(() => getTotalDealValue(contact.hs_contact_id, apiKey))

      await supabase.from('hubspot_contacts').upsert(
        { ...contact, ...deal, phone, updated_at: new Date().toISOString() },
        { onConflict: 'phone' }
      )
      enriched++
    } catch {
      continue
    }
  }

  return enriched
}
