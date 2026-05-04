import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { checkAlerts } from '@/lib/alerts/check'
import { buildAlertEmail } from '@/lib/alerts/email'

const ALERT_TO = 'dante@fratellihouse.com.br'

async function runAlerts() {
  const supabase = await createServiceClient()
  const resend = new Resend(process.env.RESEND_API_KEY)

  try {
    const alerts = await checkAlerts(supabase)

    if (alerts.length === 0) {
      await supabase.from('sync_logs').insert({
        type: 'alerts',
        status: 'success',
        records_synced: 0,
        message: 'Nenhuma anomalia detectada',
      })
      return NextResponse.json({ alerts: 0 })
    }

    const { subject, html } = buildAlertEmail(alerts)

    await resend.emails.send({
      from: 'ADS Manage <alerts@resend.dev>',
      to: ALERT_TO,
      subject,
      html,
    })

    await supabase.from('sync_logs').insert({
      type: 'alerts',
      status: 'success',
      records_synced: alerts.length,
      message: `${alerts.length} alerta(s) enviado(s) para ${ALERT_TO}`,
    })

    return NextResponse.json({ alerts: alerts.length })
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
