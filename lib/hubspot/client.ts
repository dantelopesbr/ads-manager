const BASE_URL = 'https://api.hubapi.com'

export interface HubSpotContactResult {
  hs_contact_id: string
  phone: string
  lifecycle_stage: string | null
}

export interface HubSpotDeal {
  deal_value: number | null
  deal_stage: string | null
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

export async function getMostRecentDeal(
  contactId: string,
  apiKey: string
): Promise<HubSpotDeal> {
  const data = await hubspotFetch(
    `/crm/v3/objects/contacts/${contactId}/associations/deals`,
    { method: 'GET' },
    apiKey
  )

  if (!data.results?.length) return { deal_value: null, deal_stage: null }

  const dealId = data.results[data.results.length - 1].id
  const deal = await hubspotFetch(
    `/crm/v3/objects/deals/${dealId}?properties=amount,dealstage`,
    { method: 'GET' },
    apiKey
  )

  return {
    deal_value: deal.properties?.amount ? parseFloat(deal.properties.amount) : null,
    deal_stage: deal.properties?.dealstage ?? null,
  }
}
