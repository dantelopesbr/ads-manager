const BASE_URL = 'https://api.hubapi.com'

export interface HubSpotContactResult {
  hs_contact_id: string
  phone: string
  lifecycle_stage: string | null
  // "Proprietário do contato" — the contact's own owner property, distinct
  // from a deal's owner (a contact can have an owner with no deal yet, or a
  // deal owned by someone other than whoever owns the contact record).
  contact_owner_id: string | null
}

export interface HubSpotDeal {
  deal_value: number | null
  deal_value_won: number | null
  deal_stage: string | null
  owner_id: string | null
}

async function hubspotFetch(path: string, options: RequestInit, apiKey: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (!res.ok) throw new Error(`HubSpot API error ${res.status}: ${await res.text()}`)
  return res.json()
}

export async function searchContactByPhone(
  phone: string,
  apiKey: string
): Promise<HubSpotContactResult | null> {
  const body = {
    filterGroups: [{
      filters: [{ propertyName: 'phone', operator: 'EQ', value: phone }]
    }],
    properties: ['phone', 'lifecyclestage', 'hubspot_owner_id'],
    limit: 1,
  }

  const data = await hubspotFetch(
    '/crm/v3/objects/contacts/search',
    { method: 'POST', body: JSON.stringify(body) },
    apiKey
  )

  if (!data.results?.length) return null

  const contact = data.results[0]
  return {
    hs_contact_id: contact.id,
    phone,
    lifecycle_stage: contact.properties?.lifecyclestage ?? null,
    contact_owner_id: contact.properties?.hubspot_owner_id ?? null,
  }
}

/**
 * Looks up many contacts by phone in one round trip per 100 (HubSpot's batch
 * limit), instead of one request per phone — used where searchContactByPhone
 * in a loop would be too slow (e.g. a live re-check across a candidate list).
 * Phones with no matching contact are simply absent from the returned map.
 */
export async function batchGetContactsByPhone(
  phones: string[],
  apiKey: string
): Promise<Map<string, HubSpotContactResult>> {
  const result = new Map<string, HubSpotContactResult>()

  for (let i = 0; i < phones.length; i += 100) {
    const chunk = phones.slice(i, i + 100)
    const body = {
      idProperty: 'phone',
      inputs: chunk.map(phone => ({ id: phone })),
      properties: ['phone', 'lifecyclestage', 'hubspot_owner_id'],
    }

    const data = await hubspotFetch(
      '/crm/v3/objects/contacts/batch/read',
      { method: 'POST', body: JSON.stringify(body) },
      apiKey
    )

    for (const contact of data.results ?? []) {
      const phone: string | undefined = contact.properties?.phone
      if (!phone) continue
      result.set(phone, {
        hs_contact_id: contact.id,
        phone,
        lifecycle_stage: contact.properties?.lifecyclestage ?? null,
        contact_owner_id: contact.properties?.hubspot_owner_id ?? null,
      })
    }
  }

  return result
}

export async function getTotalDealValue(
  contactId: string,
  apiKey: string
): Promise<HubSpotDeal> {
  const data = await hubspotFetch(
    `/crm/v3/objects/contacts/${contactId}/associations/deals`,
    { method: 'GET' },
    apiKey
  )

  if (!data.results?.length) return { deal_value: null, deal_value_won: null, deal_stage: null, owner_id: null }

  // Fetch all deals. Sum won value independently of iteration order — a
  // contact can have a closed deal AND an open one, and HubSpot's association
  // order isn't guaranteed to put the closed one last.
  const dealIds: string[] = data.results.map((r: { id: string }) => r.id)
  let totalValue = 0
  let wonValue = 0
  let lastStage: string | null = null
  let lastOwnerId: string | null = null
  let wonOwnerId: string | null = null
  let hasWon = false

  for (const dealId of dealIds) {
    const deal = await hubspotFetch(
      `/crm/v3/objects/deals/${dealId}?properties=amount,dealstage,hubspot_owner_id`,
      { method: 'GET' },
      apiKey
    )
    const amount = deal.properties?.amount ? parseFloat(deal.properties.amount) : 0
    const stage: string | null = deal.properties?.dealstage ?? null
    const ownerId: string | null = deal.properties?.hubspot_owner_id ?? null

    totalValue += amount
    if (stage === 'closedwon') {
      wonValue += amount
      hasWon = true
      wonOwnerId = ownerId
    }
    if (stage) { lastStage = stage; lastOwnerId = ownerId }
  }

  return {
    deal_value: totalValue > 0 ? totalValue : null,
    deal_value_won: wonValue > 0 ? wonValue : null,
    // Prefer "closedwon" for display when any deal closed, even if it wasn't the last one fetched.
    deal_stage: hasWon ? 'closedwon' : lastStage,
    // Credit the closer for a won deal; otherwise whoever owns the most recent deal.
    owner_id: hasWon ? wonOwnerId : lastOwnerId,
  }
}

export interface HubSpotCallActivity {
  hs_call_id: string
  owner_id: string | null
  call_at: string
  direction: string | null
  disposition: string | null
}

function parseHsTimestamp(raw: string | null): string | null {
  if (!raw) return null
  // hs_timestamp comes back as epoch millis in some responses, ISO-8601 in others.
  const asEpoch = Number(raw)
  const date = Number.isFinite(asEpoch) ? new Date(asEpoch) : new Date(raw)
  return isNaN(date.getTime()) ? null : date.toISOString()
}

/**
 * Sweeps the Calls object directly (not per-contact associations) so a call
 * shows up even for a contact our own enrich loop hasn't reached yet.
 * Paginated by HubSpot's `after` cursor.
 */
export async function searchRecentCalls(
  apiKey: string,
  sinceMs: number,
  after?: string
): Promise<{ calls: (HubSpotCallActivity & { id: string })[]; nextAfter: string | null }> {
  const body = {
    filterGroups: [{
      filters: [{ propertyName: 'hs_timestamp', operator: 'GTE', value: String(sinceMs) }],
    }],
    sorts: [{ propertyName: 'hs_timestamp', direction: 'DESCENDING' }],
    properties: ['hs_timestamp', 'hubspot_owner_id', 'hs_call_direction', 'hs_call_disposition'],
    limit: 100,
    ...(after ? { after } : {}),
  }

  const data = await hubspotFetch(
    '/crm/v3/objects/calls/search',
    { method: 'POST', body: JSON.stringify(body) },
    apiKey
  )

  const calls = (data.results ?? [])
    .map((r: { id: string; properties: Record<string, string | null> }) => {
      const call_at = parseHsTimestamp(r.properties.hs_timestamp)
      if (!call_at) return null
      return {
        id: r.id,
        hs_call_id: r.id,
        owner_id: r.properties.hubspot_owner_id ?? null,
        call_at,
        direction: r.properties.hs_call_direction ?? null,
        disposition: r.properties.hs_call_disposition ?? null,
      }
    })
    .filter((c: unknown): c is HubSpotCallActivity & { id: string } => c !== null)

  return { calls, nextAfter: data.paging?.next?.after ?? null }
}

/** Contact IDs associated with a call — usually one. */
export async function getCallContactIds(callId: string, apiKey: string): Promise<string[]> {
  const data = await hubspotFetch(
    `/crm/v3/objects/calls/${callId}/associations/contacts`,
    { method: 'GET' },
    apiKey
  )
  return (data.results ?? []).map((r: { id: string }) => r.id)
}

/** A contact's phone property, for calls whose contact we haven't synced yet. */
export async function getContactPhone(contactId: string, apiKey: string): Promise<string | null> {
  const data = await hubspotFetch(
    `/crm/v3/objects/contacts/${contactId}?properties=phone`,
    { method: 'GET' },
    apiKey
  )
  return data.properties?.phone ?? null
}

export interface HubSpotOwner {
  id: string
  name: string
}

/** All HubSpot owners (users), fetched once per enrich run and cached by the caller. */
export async function fetchOwners(apiKey: string): Promise<HubSpotOwner[]> {
  const owners: HubSpotOwner[] = []
  let after: string | undefined

  do {
    const query = after ? `?limit=100&after=${after}` : '?limit=100'
    const data = await hubspotFetch(`/crm/v3/owners${query}`, { method: 'GET' }, apiKey)
    for (const o of data.results ?? []) {
      const name = [o.firstName, o.lastName].filter(Boolean).join(' ').trim()
      owners.push({ id: o.id, name: name || o.email || o.id })
    }
    after = data.paging?.next?.after
  } while (after)

  return owners
}
