const META_API_VERSION = 'v21.0'
const BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`

export type IgMediaType = 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'

export interface IgMedia {
  id: string
  caption: string | null
  media_type: IgMediaType
  media_product_type?: string
  permalink: string
  thumbnail_url?: string
  media_url?: string
  timestamp: string
  like_count: number
  comments_count: number
}

interface IgMediaRaw {
  id: string
  caption?: string
  media_type: IgMediaType
  media_product_type?: string
  permalink: string
  thumbnail_url?: string
  media_url?: string
  timestamp: string
  like_count?: number
  comments_count?: number
}

export async function fetchIgMedia(
  accessToken: string,
  igBusinessId: string,
  limit = 30
): Promise<IgMedia[]> {
  const params = new URLSearchParams({
    fields: 'id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count',
    limit: String(limit),
    access_token: accessToken,
  })
  const res = await fetch(`${BASE_URL}/${igBusinessId}/media?${params}`)
  if (!res.ok) {
    const error: unknown = await res.json()
    throw new Error(`Meta API error: ${JSON.stringify(error)}`)
  }
  const json: { data?: IgMediaRaw[] } = await res.json()
  return (json.data ?? []).map(m => ({
    id: m.id,
    caption: m.caption ?? null,
    media_type: m.media_type,
    media_product_type: m.media_product_type,
    permalink: m.permalink,
    thumbnail_url: m.thumbnail_url,
    media_url: m.media_url,
    timestamp: m.timestamp,
    like_count: m.like_count ?? 0,
    comments_count: m.comments_count ?? 0,
  }))
}

export interface IgMediaInsights {
  reach: number | null
  saved: number | null
  shares: number | null
}

// Best-effort per post — older posts or some media types can reject a metric,
// and one failure shouldn't blank out the rest of the ranking.
export async function fetchIgMediaInsights(accessToken: string, mediaId: string): Promise<IgMediaInsights> {
  const params = new URLSearchParams({ metric: 'reach,saved,shares', access_token: accessToken })
  const res = await fetch(`${BASE_URL}/${mediaId}/insights?${params}`)
  if (!res.ok) return { reach: null, saved: null, shares: null }
  const json: { data?: { name: string; values?: { value: number }[] }[] } = await res.json()
  const byName: Record<string, number> = {}
  for (const m of json.data ?? []) byName[m.name] = m.values?.[0]?.value ?? 0
  return {
    reach: byName.reach ?? null,
    saved: byName.saved ?? null,
    shares: byName.shares ?? null,
  }
}

export interface CreativeRow extends IgMedia, IgMediaInsights {
  engagementScore: number
  engagementRate: number | null
}

/**
 * Weighted so save/share (higher-intent actions) count more than a like —
 * a like costs a tap, a save or share means the content was worth keeping
 * or passing on. Weights are a starting heuristic, not a fixed formula.
 */
function computeEngagementScore(m: IgMedia, ins: IgMediaInsights): number {
  return m.like_count + m.comments_count * 2 + (ins.saved ?? 0) * 3 + (ins.shares ?? 0) * 4
}

export async function getCreativeRanking(
  accessToken: string,
  igBusinessId: string,
  limit = 30
): Promise<CreativeRow[]> {
  const media = await fetchIgMedia(accessToken, igBusinessId, limit)
  const insights = await Promise.all(media.map(m => fetchIgMediaInsights(accessToken, m.id)))
  return media.map((m, i) => {
    const ins = insights[i]
    const engagementScore = computeEngagementScore(m, ins)
    const engagementRate = ins.reach && ins.reach > 0 ? engagementScore / ins.reach : null
    return { ...m, ...ins, engagementScore, engagementRate }
  })
}
