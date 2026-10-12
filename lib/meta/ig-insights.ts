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

function mapMedia(m: IgMediaRaw): IgMedia {
  return {
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
  }
}

const MEDIA_FIELDS = 'id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count'

// Safety cap on pagination — this account posts ~3-4x/day, so 365 days is
// normally ~900 posts; this just bounds a runaway account from blowing up
// the per-post insights fan-out below.
const MAX_POSTS_BY_DATE = 1500

/**
 * All posts published since `sinceUnix` (seconds) — paginates via the API's
 * own `since` cutoff (verified live: it stops paging exactly at the
 * boundary), not a fixed post count.
 */
export async function fetchIgMediaSince(
  accessToken: string,
  igBusinessId: string,
  sinceUnix: number
): Promise<IgMedia[]> {
  const params = new URLSearchParams({
    fields: MEDIA_FIELDS, limit: '50', since: String(sinceUnix), access_token: accessToken,
  })
  let url: string | null = `${BASE_URL}/${igBusinessId}/media?${params}`
  const results: IgMedia[] = []
  while (url && results.length < MAX_POSTS_BY_DATE) {
    const res: Response = await fetch(url)
    if (!res.ok) {
      const error: unknown = await res.json()
      throw new Error(`Meta API error: ${JSON.stringify(error)}`)
    }
    const json: { data?: IgMediaRaw[]; paging?: { next?: string } } = await res.json()
    results.push(...(json.data ?? []).map(mapMedia))
    url = json.paging?.next ?? null
  }
  return results
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

const DEFAULT_WINDOW_DAYS = 365

/** Ranks every post published in the last `windowDays` days (by date, not a fixed post count). */
export async function getCreativeRanking(
  accessToken: string,
  igBusinessId: string,
  windowDays = DEFAULT_WINDOW_DAYS
): Promise<CreativeRow[]> {
  const sinceUnix = Math.floor(Date.now() / 1000) - windowDays * 24 * 60 * 60
  const media = await fetchIgMediaSince(accessToken, igBusinessId, sinceUnix)
  const insights = await Promise.all(media.map(m => fetchIgMediaInsights(accessToken, m.id)))
  return media.map((m, i) => {
    const ins = insights[i]
    const engagementScore = computeEngagementScore(m, ins)
    const engagementRate = ins.reach && ins.reach > 0 ? engagementScore / ins.reach : null
    return { ...m, ...ins, engagementScore, engagementRate }
  })
}
