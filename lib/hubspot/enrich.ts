import { SupabaseClient } from '@supabase/supabase-js'
import { searchContactByPhone, getTotalDealValue, fetchOwners, getContactCalls } from './client'

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

export interface EnrichResult { enriched: number; callsError: string | null }

export async function enrichLeads(supabase: SupabaseClient): Promise<EnrichResult> {
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

  if (allPhones.size === 0) return { enriched: 0, callsError: null }

  // Existing sync status for phones we care about, batched to avoid the .in() URL length limit
  const phoneList = [...allPhones]
  type SyncStatus = { updatedAt: string; hasDealButNoOwner: boolean }
  const statusByPhone = new Map<string, SyncStatus>()
  for (let i = 0; i < phoneList.length; i += 100) {
    const { data } = await supabase
      .from('hubspot_contacts')
      .select('phone, updated_at, deal_stage, owner_name')
      .in('phone', phoneList.slice(i, i + 100))
    for (const row of data ?? []) {
      statusByPhone.set(row.phone, { updatedAt: row.updated_at, hasDealButNoOwner: !!row.deal_stage && !row.owner_name })
    }
  }

  const resyncCutoff = new Date()
  resyncCutoff.setDate(resyncCutoff.getDate() - RESYNC_AFTER_DAYS)
  const resyncCutoffIso = resyncCutoff.toISOString()

  // Never-synced phones (zero HubSpot data) go first; contacts that already have a
  // deal but never got owner_name backfilled (added after they were last synced)
  // go next, regardless of freshness — otherwise a new field never fills in until
  // the routine 7-day resync happens to reach them; routine stale resyncs fill
  // any leftover budget.
  const neverSynced: string[] = []
  const missingOwner: string[] = []
  const stale: string[] = []
  for (const phone of phoneList) {
    const status = statusByPhone.get(phone)
    if (!status) neverSynced.push(phone)
    else if (status.updatedAt < resyncCutoffIso) stale.push(phone)
    else if (status.hasDealButNoOwner) missingOwner.push(phone)
  }

  const toSync = [...neverSynced, ...missingOwner, ...stale].slice(0, BATCH_LIMIT)

  if (toSync.length === 0) return { enriched: 0, callsError: null }

  // Owners are a small, slow-changing list — fetch once per run rather than per contact.
  const owners = await withRetry(() => fetchOwners(apiKey)).catch(() => [])
  const ownerNameById = new Map(owners.map(o => [o.id, o.name]))

  let enriched = 0
  let callsError: string | null = null
  const startedAt = Date.now()

  for (const phone of toSync) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) break
    try {
      const contact = await withRetry(() => searchContactByPhone(phone, apiKey))
      if (!contact) continue

      const deal = await withRetry(() => getTotalDealValue(contact.hs_contact_id, apiKey))
      const owner_name = deal.owner_id ? ownerNameById.get(deal.owner_id) ?? null : null

      await supabase.from('hubspot_contacts').upsert(
        { ...contact, ...deal, owner_name, phone, updated_at: new Date().toISOString() },
        { onConflict: 'phone' }
      )
      enriched++

      // Calls are supplementary — fetched after the contact/deal upsert so a
      // failure here never loses that sync. One extra round trip per contact,
      // so this batch effectively runs slower; the time-budget check above
      // already handles that gracefully (fewer contacts/run, not a timeout).
      try {
        const calls = await withRetry(() => getContactCalls(contact.hs_contact_id, apiKey))
        if (calls.length > 0) {
          const callRows = calls.map(c => ({
            hs_call_id: c.hs_call_id,
            phone,
            owner_id: c.owner_id,
            owner_name: c.owner_id ? ownerNameById.get(c.owner_id) ?? null : null,
            call_at: c.call_at,
            direction: c.direction,
            disposition: c.disposition,
          }))
          await supabase.from('hubspot_calls').upsert(callRows, { onConflict: 'hs_call_id' })
        }
      } catch (err) {
        // best-effort — contact sync above already succeeded. Keep the first
        // error only, surfaced via sync_logs, so a systematic failure (wrong
        // scope, wrong endpoint) is visible instead of silently zeroing calls.
        if (!callsError) callsError = err instanceof Error ? err.message : String(err)
      }
    } catch {
      continue
    }
  }

  return { enriched, callsError }
}
