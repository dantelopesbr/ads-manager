import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, createClient } from '@/lib/supabase/server'
import { checkAlerts } from '@/lib/alerts/check'
import { buildAlertEmail } from '@/lib/alerts/email'

const ALERT_TO = 'dante@fratellihouse.com.br'
const WEBHOOK_URL = 'https://n8n.fratellihouse.com.br/webhook/email-alert-vercel-ads-manager'

async function runAlerts() {
  const supabase = await createServiceClient()

  try {
    const { campaignAlerts, accountAlerts } = await checkAlerts(supabase)
    const total = campaignAlerts.length + accountAlerts.length

    if (total === 0) {
      await supabase.from('sync_logs').insert({
        type: 'alerts',
        status: 'success',
        records_synced: 0,
        message: 'Nenhuma anomalia detectada',
      })
      return NextResponse.json({ alerts: 0 })
    }

    const { subject, html } = buildAlertEmail(campaignAlerts, accountAlerts)

    const webhookRes = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: ALERT_TO,
        subject,
        html,
        campaignAlerts,
        accountAlerts,
      }),
    })

    if (!webhookRes.ok) {
      throw new Error(`n8n webhook error: ${webhookRes.status} ${await webhookRes.text()}`)
    }

    const billingMsg = accountAlerts.length > 0 ? ` | ${accountAlerts.length} alerta(s) de pagamento` : ''
    await supabase.from('sync_logs').insert({
      type: 'alerts',
      status: 'success',
      records_synced: total,
      message: `${campaignAlerts.length} alerta(s) de campanha${billingMsg} enviado(s)`,
    })

    return NextResponse.json({ alerts: total, campaignAlerts: campaignAlerts.length, accountAlerts: accountAlerts.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    await supabase.from('sync_logs').insert({
      type: 'alerts',
      status: 'error',
      records_synced: 0,
      message,
    })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Vercel Cron — GET with Bearer CRON_SECRET
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return runAlerts()
}

// Manual trigger from UI — POST with Supabase session
export async function POST(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return runAlerts()
}
