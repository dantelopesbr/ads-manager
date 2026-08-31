import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { pauseCampaign, updateCampaignBudget } from '@/lib/meta/actions'

interface Params {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, { params }: Params) {
  // Auth check — must be authenticated user (not just cron secret)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: campaignId } = await params

  let body: {
    action: 'pause' | 'budget'
    daily_budget_cents?: number
    dry_run?: boolean
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { action, daily_budget_cents, dry_run = false } = body

  if (!action) {
    return NextResponse.json({ error: 'Missing action field' }, { status: 400 })
  }

  // Use service client for DB writes (sync_logs)
  const serviceSupabase = await createServiceClient()

  try {
    if (action === 'pause') {
      const result = await pauseCampaign(serviceSupabase, campaignId, dry_run)
      return NextResponse.json(result)
    }

    if (action === 'budget') {
      if (daily_budget_cents === undefined || daily_budget_cents <= 0) {
        return NextResponse.json({ error: 'daily_budget_cents must be > 0' }, { status: 400 })
      }
      const result = await updateCampaignBudget(serviceSupabase, campaignId, daily_budget_cents, dry_run)
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
