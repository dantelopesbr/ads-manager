import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, createClient } from '@/lib/supabase/server'
import { enrichLeads } from '@/lib/hubspot/enrich'

async function runEnrich() {
  const supabase = await createServiceClient()
  try {
    const count = await enrichLeads(supabase)
    await supabase.from('sync_logs').insert({
      type: 'hubspot',
      status: 'success',
      records_synced: count,
      message: `Enriched ${count} contacts`,
    })
    return NextResponse.json({ enriched: count })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    await supabase.from('sync_logs').insert({
      type: 'hubspot',
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
  return runEnrich()
}

// Manual trigger from UI — POST with Supabase session
export async function POST(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return runEnrich()
}
