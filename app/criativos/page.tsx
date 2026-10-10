import { Nav } from '@/components/nav'
import { getAccount } from '@/lib/account-server'
import { ACCOUNTS } from '@/lib/account'
import { getCreativeRanking } from '@/lib/meta/ig-insights'
import { CreativeRankingTable, type CreativeRankingRow } from '@/components/criativos/creative-ranking-table'

export const dynamic = 'force-dynamic'

export default async function CriativosPage() {
  const account = await getAccount()
  const igBusinessId = account === 'fratellirev'
    ? process.env.META_IG_BUSINESS_ID_REV
    : process.env.META_IG_BUSINESS_ID
  const token = process.env.META_IG_TOKEN

  let rows: CreativeRankingRow[] = []
  let error: string | null = null

  if (!token || !igBusinessId) {
    error = 'Token ou conta do Instagram não configurados (META_IG_TOKEN / META_IG_BUSINESS_ID).'
  } else {
    try {
      const creatives = await getCreativeRanking(token, igBusinessId, 30)
      rows = creatives.map(c => ({
        id: c.id,
        thumbnail: c.thumbnail_url ?? c.media_url ?? null,
        caption: c.caption,
        mediaType: c.media_type,
        timestamp: c.timestamp,
        permalink: c.permalink,
        likes: c.like_count,
        comments: c.comments_count,
        saved: c.saved,
        shares: c.shares,
        reach: c.reach,
        engagementScore: c.engagementScore,
        engagementRate: c.engagementRate,
      }))
    } catch (e) {
      error = e instanceof Error ? e.message : 'Erro ao buscar dados do Instagram'
    }
  }

  return (
    <div className="flex">
      <Nav />
      <main className="flex-1 p-8">
        <h2 className="text-2xl font-bold mb-1">Criativos</h2>
        <p className="text-sm text-slate-500 mb-6">
          Posts do Instagram de {ACCOUNTS[account].label} ordenados por engajamento orgânico — usa pra escolher o próximo criativo de anúncio.
        </p>
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
        {!error && <CreativeRankingTable rows={rows} />}
      </main>
    </div>
  )
}
