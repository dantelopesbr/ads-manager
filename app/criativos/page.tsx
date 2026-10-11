import { Nav } from '@/components/nav'
import { getAccount } from '@/lib/account-server'
import { ACCOUNTS } from '@/lib/account'
import { createServiceClient } from '@/lib/supabase/server'
import { syncAndGetCreativeRanking } from '@/lib/meta/ig-creative-sync'
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
      const supabaseService = createServiceClient()
      const creatives = await syncAndGetCreativeRanking(supabaseService, account, token, igBusinessId)
      rows = creatives.map(c => ({
        id: c.post_id,
        thumbnail: c.thumbnail_url,
        caption: c.caption,
        mediaType: c.media_type ?? '',
        timestamp: c.posted_at,
        permalink: c.permalink,
        likes: c.likes,
        comments: c.comments,
        saved: c.saved,
        shares: c.shares,
        reach: c.reach,
        engagementScore: c.engagement_score,
        engagementRate: c.engagement_rate,
        categoria: c.categoria,
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
          Posts do Instagram de {ACCOUNTS[account].label} dos últimos 90 dias, ordenados por engajamento orgânico — usa pra escolher o próximo criativo de anúncio. Posts que saem da janela continuam listados com o último desempenho salvo.
        </p>
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
        {!error && <CreativeRankingTable rows={rows} />}
      </main>
    </div>
  )
}
