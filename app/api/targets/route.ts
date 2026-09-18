import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAccountKey } from '@/lib/account'
import { DEFAULT_CPL_ALERT_MULTIPLIER, DEFAULT_CTR_ALERT_MIN } from '@/lib/queries'

function parseNullableNumber(value: unknown): number | null {
  return value === '' || value == null ? null : Number(value)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const account = body?.account
  if (!isAccountKey(account)) return NextResponse.json({ error: 'Invalid account' }, { status: 400 })

  const cplTarget = parseNullableNumber(body?.cpl_target)
  const roasTarget = parseNullableNumber(body?.roas_target)
  // ctr_alert_pct arrives as a percentage (e.g. 0.3 for 0.3%) — stored as a fraction.
  const cplAlertMultiplier = parseNullableNumber(body?.cpl_alert_multiplier) ?? DEFAULT_CPL_ALERT_MULTIPLIER
  const ctrAlertPct = parseNullableNumber(body?.ctr_alert_pct)
  const ctrAlertMin = ctrAlertPct !== null ? ctrAlertPct / 100 : DEFAULT_CTR_ALERT_MIN

  for (const [label, value] of [
    ['cpl_target', cplTarget], ['roas_target', roasTarget],
    ['cpl_alert_multiplier', cplAlertMultiplier], ['ctr_alert_min', ctrAlertMin],
  ] as const) {
    if (value !== null && !Number.isFinite(value)) {
      return NextResponse.json({ error: `Invalid ${label}` }, { status: 400 })
    }
  }

  const { error } = await supabase.from('account_targets').upsert(
    {
      account,
      cpl_target: cplTarget,
      roas_target: roasTarget,
      cpl_alert_multiplier: cplAlertMultiplier,
      ctr_alert_min: ctrAlertMin,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'account' }
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
