import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, createClient } from '@/lib/supabase/server'
import { syncMetaInsights } from '@/lib/meta/sync'

async function runSync() {
  const supabase = await createServiceClient()
  try {
    const count = await syncMetaInsights(supabase)
    await supabase.from('sync_logs').insert({
      type: 'meta',
      status: 'success',
      records_synced: count,
      message: `Synced ${count} records`,
    })
    return NextResponse.json({ synced: count })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    await supabase.from('sync_logs').insert({
      type: 'meta',
      status: 'error',
      records_synced: 0,
      message,
    })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Vercel Cron — GET with Bearer CRON_SECRET
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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
