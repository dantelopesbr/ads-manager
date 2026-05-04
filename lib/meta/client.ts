const META_API_VERSION = 'v20.0'
const BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`
const ALL_STATUSES = '["ACTIVE","PAUSED","ARCHIVED"]'

// ─── Read types ──────────────────────────────────────────────────────────────

export interface MetaInsightRaw {
  campaign_id: string
  campaign_name: string
  adset_id: string
  adset_name: string
  ad_id: string
  ad_name: string
  spend: string
  impressions: string
  clicks: string
  reach: string
  date_start: string
}

export interface MetaCampaign {
  id: string
  name: string
  status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED'
  daily_budget?: string  // in account currency cents (e.g. "50000" = R$500)
  lifetime_budget?: string
  effective_status: string
}

// ─── Write types ─────────────────────────────────────────────────────────────

export type CampaignStatus = 'ACTIVE' | 'PAUSED'

export interface UpdateCampaignFields {
  status?: CampaignStatus
  daily_budget?: number  // in cents (multiply BRL by 100)
  name?: string
}

export interface MetaWriteResult {
  success: boolean
  id: string
}

// ─── Read operations ──────────────────────────────────────────────────────────

export async function fetchMetaInsights(
  accessToken: string,
  adAccountId: string,
  since: string,
  until: string
): Promise<MetaInsightRaw[]> {
  const params = new URLSearchParams({
    fields: 'campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,clicks,reach',
    level: 'ad',
    time_range: JSON.stringify({ since, until }),
    time_increment: '1',
    limit: '500',
    access_token: accessToken,
  })

  const results: MetaInsightRaw[] = []
  let url: string | null = `${BASE_URL}/${adAccountId}/insights?${params}`

  while (url) {
    const res: Response = await fetch(url)
    if (!res.ok) {
      const error: unknown = await res.json()
      throw new Error(`Meta API error: ${JSON.stringify(error)}`)
    }
    const json: { data?: MetaInsightRaw[]; paging?: { next?: string } } = await res.json()
    results.push(...(json.data ?? []))
    url = json.paging?.next ?? null
  }

  return results
}

/**
 * Fetch live campaign list from Meta API (status, budget, name).
 * Used by the CLI and action modals to show before/after state.
 */
export async function fetchMetaCampaigns(
  accessToken: string,
  adAccountId: string
): Promise<MetaCampaign[]> {
  const params = new URLSearchParams({
    fields: 'id,name,status,effective_status,daily_budget,lifetime_budget',
    effective_status: ALL_STATUSES,
    limit: '200',
    access_token: accessToken,
  })

  const results: MetaCampaign[] = []
  let url: string | null = `${BASE_URL}/${adAccountId}/campaigns?${params}`

  while (url) {
    const res = await fetch(url)
    if (!res.ok) {
      const error: unknown = await res.json()
      throw new Error(`Meta API error: ${JSON.stringify(error)}`)
    }
    const json: { data?: MetaCampaign[]; paging?: { next?: string } } = await res.json()
    results.push(...(json.data ?? []))
    url = json.paging?.next ?? null
  }

  return results
}

export interface MetaAdset {
  id: string
  name: string
  status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED'
  effective_status: string
  campaign_id: string
}

export interface MetaAd {
  id: string
  name: string
  status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED'
  effective_status: string
  adset_id: string
  campaign_id: string
}

async function fetchPaged<T>(url: string): Promise<T[]> {
  const results: T[] = []
  let next: string | null = url
  while (next) {
    const res = await fetch(next)
    if (!res.ok) throw new Error(`Meta API error: ${JSON.stringify(await res.json())}`)
    const json: { data?: T[]; paging?: { next?: string } } = await res.json()
    results.push(...(json.data ?? []))
    next = json.paging?.next ?? null
  }
  return results
}

export async function fetchMetaAdsets(
  accessToken: string,
  adAccountId: string
): Promise<MetaAdset[]> {
  const params = new URLSearchParams({
    fields: 'id,name,status,effective_status,campaign_id',
    effective_status: ALL_STATUSES,
    limit: '200',
    access_token: accessToken,
  })
  return fetchPaged<MetaAdset>(`${BASE_URL}/${adAccountId}/adsets?${params}`)
}

export async function fetchMetaAds(
  accessToken: string,
  adAccountId: string
): Promise<MetaAd[]> {
  const params = new URLSearchParams({
    fields: 'id,name,status,effective_status,adset_id,campaign_id',
    effective_status: ALL_STATUSES,
    limit: '200',
    access_token: accessToken,
  })
  return fetchPaged<MetaAd>(`${BASE_URL}/${adAccountId}/ads?${params}`)
}

// ─── Account billing ──────────────────────────────────────────────────────────

export interface MetaAccountStatus {
  account_status: number   // 1=ACTIVE 3=UNSETTLED 9=IN_GRACE_PERIOD 201=PENDING_BILLING_INFO
  disable_reason: number
  balance: string          // prepaid balance in account currency cents (may be "0" for postpaid)
  currency: string
}

// account_status codes that indicate a billing problem
export const BILLING_PROBLEM_STATUSES: Record<number, string> = {
  3: 'Pagamento vencido (UNSETTLED)',
  9: 'Conta em período de carência (IN_GRACE_PERIOD)',
  201: 'Sem método de pagamento cadastrado (PENDING_BILLING_INFO)',
}

export async function fetchMetaAccountStatus(
  accessToken: string,
  adAccountId: string
): Promise<MetaAccountStatus> {
  const params = new URLSearchParams({
    fields: 'account_status,disable_reason,balance,currency',
    access_token: accessToken,
  })
  const res = await fetch(`${BASE_URL}/${adAccountId}?${params}`)
  if (!res.ok) throw new Error(`Meta API error: ${JSON.stringify(await res.json())}`)
  return res.json()
}

// ─── Write operations ─────────────────────────────────────────────────────────

/**
 * Update a campaign on Meta.
 * Safety: will NEVER set status to ACTIVE — that requires explicit opt-in.
 * Returns { success, id } or throws with a descriptive message.
 */
export async function updateMetaCampaign(
  accessToken: string,
  campaignId: string,
  fields: UpdateCampaignFields,
  dryRun = false
): Promise<MetaWriteResult> {
  // Safety: block accidental activation
  if (fields.status === 'ACTIVE') {
    throw new Error(
      'Activating campaigns via API is disabled for safety. Use Meta Ads Manager to activate.'
    )
  }

  if (dryRun) {
    return { success: true, id: campaignId }
  }

  const body = new URLSearchParams({ access_token: accessToken })
  if (fields.status) body.append('status', fields.status)
  if (fields.daily_budget !== undefined) body.append('daily_budget', String(fields.daily_budget))
  if (fields.name) body.append('name', fields.name)

  const res = await fetch(`${BASE_URL}/${campaignId}`, {
    method: 'POST',  // Meta Marketing API uses POST for updates
    body,
  })

  if (!res.ok) {
    const error: unknown = await res.json()
    throw new Error(`Meta API write error: ${JSON.stringify(error)}`)
  }

  const json: { success?: boolean; id?: string } = await res.json()

  if (!json.success) {
    throw new Error(`Meta API returned success=false for campaign ${campaignId}`)
  }

  return { success: true, id: campaignId }
}
