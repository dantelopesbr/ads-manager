import { SupabaseClient } from '@supabase/supabase-js'
import {
  searchContactByPhone, getTotalDealValue, fetchOwners,
  searchRecentCalls, getCallContactIds, getContactPhone,
} from './client'

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
// before — but the route's maxDuration is capped at 60s. Each phase gets its own
// fixed budget, timed from when THAT phase starts — sharing one clock meant the
// contact loop (which reliably fills its whole budget with 150 contacts) always
// starved the calls sweep down to zero, since by the time calls sync started the
// shared clock had already run out.
const CONTACTS_TIME_BUDGET_MS = 30_000
const CALLS_TIME_BUDGET_MS = 20_000

const CALLS_LOOKBACK_DAYS = 30

export interface EnrichResult { enriched: number; callsSynced: number; callsError: string | null }

export async function enrichLeads(supabase: SupabaseClient): Promise<EnrichResult> {
  const apiKey = process.env.HUBSPOT_API_KEY!
  const contactsStartedAt = Date.now()

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

  // Owners are a small, slow-changing list — fetch once per run rather than per contact.
  const owners = await withRetry(() => fetchOwners(apiKey)).catch(() => [])
  const ownerNameById = new Map(owners.map(o => [o.id, o.name]))

  let enriched = 0

  if (allPhones.size > 0) {
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

    for (const phone of toSync) {
      if (Date.now() - contactsStartedAt > CONTACTS_TIME_BUDGET_MS) break
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
      } catch {
        continue
      }
    }
  }

  const { synced: callsSynced, error: callsError } = await syncRecentCalls(supabase, apiKey, ownerNameById)

  return { enriched, callsSynced, callsError }
}

/**
 * Sweeps the Calls object directly (not per-contact associations), so a call
 * shows up even for a contact our enrich loop above hasn't reached yet.
 * Rolling 30-day window, idempotent upsert by hs_call_id.
 *
 * No single run gets through the whole window in its time budget (each call
 * costs 1-2 extra HubSpot round trips), so the HubSpot pagination cursor is
 * persisted in hubspot_calls_sync_state between runs — otherwise every run
 * restarts at page 1 (most recent calls) and older ones are never reached.
 * The cursor resets to null once a full pass reaches the end of the window,
 * so the next run starts fresh at the top again and picks up new calls.
 */
async function syncRecentCalls(
  supabase: SupabaseClient,
  apiKey: string,
  ownerNameById: Map<string, string>
): Promise<{ synced: number; error: string | null }> {
  const startedAt = Date.now()
  const sinceMs = startedAt - CALLS_LOOKBACK_DAYS * 24 * 60 * 60 * 1000
  const contactPhoneCache = new Map<string, string | null>()
  let synced = 0
  let error: string | null = null

  const { data: state } = await supabase
    .from('hubspot_calls_sync_state')
    .select('after_cursor')
    .eq('id', 1)
    .maybeSingle()
  let after: string | undefined = state?.after_cursor ?? undefined

  try {
    do {
      if (Date.now() - startedAt > CALLS_TIME_BUDGET_MS) break
      const { calls, nextAfter } = await withRetry(() => searchRecentCalls(apiKey, sinceMs, after))

      for (const call of calls) {
        if (Date.now() - startedAt > CALLS_TIME_BUDGET_MS) break
        try {
          const contactIds = await withRetry(() => getCallContactIds(call.id, apiKey))
          if (contactIds.length === 0) continue
          const contactId = contactIds[0]

          let phone: string | null
          if (contactPhoneCache.has(contactId)) {
            phone = contactPhoneCache.get(contactId) ?? null
          } else {
            const { data: local } = await supabase
              .from('hubspot_contacts')
              .select('phone')
              .eq('hs_contact_id', contactId)
              .maybeSingle()
            if (local?.phone) {
              phone = local.phone
            } else {
              const remotePhone = await withRetry(() => getContactPhone(contactId, apiKey))
              phone = remotePhone ?? null
            }
            contactPhoneCache.set(contactId, phone)
          }
          if (!phone) continue

          const { error: upsertError } = await supabase.from('hubspot_calls').upsert({
            hs_call_id: call.hs_call_id,
            phone,
            owner_id: call.owner_id,
            owner_name: call.owner_id ? ownerNameById.get(call.owner_id) ?? null : null,
            call_at: call.call_at,
            direction: call.direction,
            disposition: call.disposition,
          }, { onConflict: 'hs_call_id' })
          if (upsertError) throw new Error(upsertError.message)
          synced++
        } catch (err) {
          if (!error) error = err instanceof Error ? err.message : String(err)
        }
      }

      after = nextAfter ?? undefined
    } while (after)
  } catch (err) {
    if (!error) error = err instanceof Error ? err.message : String(err)
  }

  // Persist wherever we ended up — null (loop exhausted) restarts the next
  // pass at the top; a live cursor lets the next run continue deeper in.
  await supabase
    .from('hubspot_calls_sync_state')
    .upsert({ id: 1, after_cursor: after ?? null, updated_at: new Date().toISOString() }, { onConflict: 'id' })

  return { synced, error }
}
