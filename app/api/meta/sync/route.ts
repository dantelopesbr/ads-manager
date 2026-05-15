import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, createClient } from '@/lib/supabase/server'
import { syncMetaInsights } from '@/lib/meta/sync'

async function runSync() {
  const supabase = await createServiceClient()

  const accounts = [
    {
      key: 'fratellihouse' as const,
      token: process.env.META_ACCESS_TOKEN!,
      accountId: process.env.META_AD_ACCOUNT_ID!,
    },
    {
      key: 'fratellirev' as const,
      token: process.env.META_ACCESS_TOKEN_REV!,
      accountId: process.env.META_AD_ACCOUNT_ID_REV!,
    },
  ]

  let totalCount = 0
  const errors: string[] = []

  for (const acc of accounts) {
    if (!acc.token || !acc.accountId) continue
    try {
      const count = await syncMetaInsights(supabase, acc.key, acc.token, acc.accountId)
      totalCount += count
    } catch (err) {
      errors.push(`${acc.key}: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  if (errors.length > 0 && totalCount === 0) {
    const message = errors.join(' | ')
    await supabase.from('sync_logs').insert({ type: 'meta', status: 'error', records_synced: 0, message })
    return NextResponse.json({ error: message }, { status: 500 })
  }

  await supabase.from('sync_logs').insert({
    type: 'meta',
    status: 'success',
    records_synced: totalCount,
    message: errors.length > 0
      ? `Synced ${totalCount} records (partial errors: ${errors.join(' | ')})`
      : `Synced ${totalCount} records`,
  })

  return NextResponse.json({ synced: totalCount })
}

// Vercel Cron — GET with Bearer CRON_SECRET
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return runSync()
}

// Manual trigger from UI — POST with Supabase session
export async function POST(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return runSync()
}
