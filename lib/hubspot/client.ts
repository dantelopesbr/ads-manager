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

export async function getTotalDealValue(
  contactId: string,
  apiKey: string
): Promise<HubSpotDeal> {
  const data = await hubspotFetch(
    `/crm/v3/objects/contacts/${contactId}/associations/deals`,
    { method: 'GET' },
    apiKey
  )

  if (!data.results?.length) return { deal_value: null, deal_stage: null }

  // Fetch all deals and sum their amounts
  const dealIds: string[] = data.results.map((r: { id: string }) => r.id)
  let totalValue = 0
  let lastStage: string | null = null

  for (const dealId of dealIds) {
    const deal = await hubspotFetch(
      `/crm/v3/objects/deals/${dealId}?properties=amount,dealstage`,
      { method: 'GET' },
      apiKey
    )
    if (deal.properties?.amount) {
      totalValue += parseFloat(deal.properties.amount)
    }
    if (deal.properties?.dealstage) {
      lastStage = deal.properties.dealstage
    }
  }

  return {
    deal_value: totalValue > 0 ? totalValue : null,
    deal_stage: lastStage,
  }
}
