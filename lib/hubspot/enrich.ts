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
const BATCH_LIMIT = 150
// Vercel Hobby cron can only run once a day, so a bigger batch matters more than
// before — but the route's maxDuration is capped at 60s. Stop with margin to spare
// rather than risk a hard timeout mid-run; whatever's left picks up next run,
// still prioritized (never-synced phones first).
const TIME_BUDGET_MS = 50_000

export async function enrichLeads(supabase: SupabaseClient): Promise<number> {
  const apiKey = process.env.HUBSPOT_API_KEY!

  // All phones from conversions — paginate to avoid 1000-row default cap
  const allPhones = new Set<string>()
  let page = 0
  const PAGE_SIZE = 1000
  while (true) {
    const { data: batch } = await supabase
      .from('meta_ads_conversions')
      .select('phone_client')
      .not('phone_client', 'is', null)
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
    if (!batch?.length) break
    for (const row of batch) allPhones.add(row.phone_client as string)
    if (batch.length < PAGE_SIZE) break
    page++
  }

  if (allPhones.size === 0) return 0

  // Existing sync status for phones we care about, batched to avoid the .in() URL length limit
  const phoneList = [...allPhones]
  const updatedAtByPhone = new Map<string, string>()
  for (let i = 0; i < phoneList.length; i += 100) {
    const { data } = await supabase
      .from('hubspot_contacts')
      .select('phone, updated_at')
      .in('phone', phoneList.slice(i, i + 100))
    for (const row of data ?? []) updatedAtByPhone.set(row.phone, row.updated_at)
  }

  const resyncCutoff = new Date()
  resyncCutoff.setDate(resyncCutoff.getDate() - RESYNC_AFTER_DAYS)
  const resyncCutoffIso = resyncCutoff.toISOString()

  // Never-synced phones (zero HubSpot data — hurts ROAS visibility most) go first;
  // stale resyncs (already have some data, just outdated) only fill leftover budget.
  const neverSynced: string[] = []
  const stale: string[] = []
  for (const phone of phoneList) {
    const updatedAt = updatedAtByPhone.get(phone)
    if (!updatedAt) neverSynced.push(phone)
    else if (updatedAt < resyncCutoffIso) stale.push(phone)
  }

  const toSync = [...neverSynced, ...stale].slice(0, BATCH_LIMIT)

  if (toSync.length === 0) return 0

  let enriched = 0
  const startedAt = Date.now()

  for (const phone of toSync) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) break
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
