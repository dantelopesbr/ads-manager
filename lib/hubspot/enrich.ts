import { SupabaseClient } from '@supabase/supabase-js'
import { searchContactByPhone, getMostRecentDeal } from './client'

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

export async function enrichLeads(supabase: SupabaseClient): Promise<number> {
  const apiKey = process.env.HUBSPOT_API_KEY!

  const { data: conversions } = await supabase
    .from('meta_ads_conversions')
    .select('phone_client')
    .not('phone_client', 'is', null)

  if (!conversions?.length) return 0

  const phones = [...new Set(conversions.map(c => c.phone_client as string))]
  let enriched = 0

  for (const phone of phones) {
    try {
      const contact = await withRetry(() => searchContactByPhone(phone, apiKey))
      if (!contact) continue

      const deal = await withRetry(() => getMostRecentDeal(contact.hs_contact_id, apiKey))

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
