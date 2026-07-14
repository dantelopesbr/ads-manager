const BASE_URL = 'https://api.hubapi.com'

export interface HubSpotContactResult {
  hs_contact_id: string
  phone: string
  lifecycle_stage: string | null
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
    properties: ['phone', 'lifecyclestage'],
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
  }
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

export interface HubSpotCall {
  hs_call_id: string
  owner_id: string | null
  call_at: string
  direction: string | null
  disposition: string | null
}

export async function getContactCalls(
  contactId: string,
  apiKey: string
): Promise<HubSpotCall[]> {
  const data = await hubspotFetch(
    `/crm/v3/objects/contacts/${contactId}/associations/calls`,
    { method: 'GET' },
    apiKey
  )

  if (!data.results?.length) return []

  const callIds: string[] = data.results.map((r: { id: string }) => r.id)
  const calls: HubSpotCall[] = []

  for (const callId of callIds) {
    const call = await hubspotFetch(
      `/crm/v3/objects/calls/${callId}?properties=hs_timestamp,hubspot_owner_id,hs_call_direction,hs_call_disposition`,
      { method: 'GET' },
      apiKey
    )
    const rawTimestamp: string | null = call.properties?.hs_timestamp ?? null
    if (!rawTimestamp) continue // no timestamp means we can't place it on the calls chart — skip
    // hs_timestamp comes back as epoch millis in some responses, ISO-8601 in others.
    const asEpoch = Number(rawTimestamp)
    const date = Number.isFinite(asEpoch) ? new Date(asEpoch) : new Date(rawTimestamp)
    if (isNaN(date.getTime())) continue // unparseable — skip this call rather than fail the whole contact
    calls.push({
      hs_call_id: callId,
      owner_id: call.properties?.hubspot_owner_id ?? null,
      call_at: date.toISOString(),
      direction: call.properties?.hs_call_direction ?? null,
      disposition: call.properties?.hs_call_disposition ?? null,
    })
  }

  return calls
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
