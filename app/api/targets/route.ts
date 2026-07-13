import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAccountKey } from '@/lib/account'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const account = body?.account
  if (!isAccountKey(account)) return NextResponse.json({ error: 'Invalid account' }, { status: 400 })

  const cplTarget = body?.cpl_target === '' || body?.cpl_target == null ? null : Number(body.cpl_target)
  const roasTarget = body?.roas_target === '' || body?.roas_target == null ? null : Number(body.roas_target)
  if (cplTarget !== null && !Number.isFinite(cplTarget)) {
    return NextResponse.json({ error: 'Invalid cpl_target' }, { status: 400 })
  }
  if (roasTarget !== null && !Number.isFinite(roasTarget)) {
    return NextResponse.json({ error: 'Invalid roas_target' }, { status: 400 })
  }

  const { error } = await supabase.from('account_targets').upsert(
    { account, cpl_target: cplTarget, roas_target: roasTarget, updated_at: new Date().toISOString() },
    { onConflict: 'account' }
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
