const META_API_VERSION = 'v20.0'
const BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`

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
