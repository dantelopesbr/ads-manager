import { SupabaseClient } from '@supabase/supabase-js'
import { getCreativeRanking } from './ig-insights'

export interface IgCreativeStatsRow {
  post_id: string
  account: string
  caption: string | null
  media_type: string | null
  permalink: string
  thumbnail_url: string | null
  posted_at: string
  likes: number
  comments: number
  saved: number | null
  shares: number | null
  reach: number | null
  engagement_score: number
  engagement_rate: number | null
  categoria: string | null
  categoria_metodo: string | null
}

/**
 * Fetches the live window from Meta and persists stats into ig_creative_stats,
 * then returns the FULL accumulated history for this account — including
 * posts that have since aged out of the live fetch window. A post stays on
 * the ranking as long as its last known score holds up, instead of
 * disappearing the moment it's no longer in the last N days.
 *
 * Classification (categoria/categoria_metodo) is NOT written here — that's
 * an n8n batch pipeline (caption match + vision fallback) writing into the
 * same table. This upsert omits those columns so it never clobbers n8n's
 * values; it only ever reads them back for display.
 */
export async function syncAndGetCreativeRanking(
  supabaseService: SupabaseClient,
  account: string,
  accessToken: string,
  igBusinessId: string
): Promise<IgCreativeStatsRow[]> {
  const live = await getCreativeRanking(accessToken, igBusinessId)

  const toUpsert = live.map(post => ({
    post_id: post.id,
    account,
    caption: post.caption,
    media_type: post.media_type,
    permalink: post.permalink,
    thumbnail_url: post.thumbnail_url ?? null,
    posted_at: post.timestamp,
    likes: post.like_count,
    comments: post.comments_count,
    saved: post.saved,
    shares: post.shares,
    reach: post.reach,
    engagement_score: post.engagementScore,
    engagement_rate: post.engagementRate,
    last_synced_at: new Date().toISOString(),
  }))

  if (toUpsert.length > 0) {
    const { error } = await supabaseService.from('ig_creative_stats').upsert(toUpsert, { onConflict: 'post_id' })
    if (error) throw error
  }

  const { data: all, error: readError } = await supabaseService
    .from('ig_creative_stats')
    .select('post_id, account, caption, media_type, permalink, thumbnail_url, posted_at, likes, comments, saved, shares, reach, engagement_score, engagement_rate, categoria, categoria_metodo')
    .eq('account', account)
    .order('engagement_score', { ascending: false })
  if (readError) throw readError
  return all ?? []
}
