import type { CampaignAlert, AccountAlert } from './check'

const CAMPAIGN_ALERT_LABELS: Record<CampaignAlert['type'], string> = {
  cpl_alto: 'CPL Alto',
  ctr_baixo: 'CTR Baixo',
  sem_leads: 'Sem Leads',
}

const CAMPAIGN_ALERT_DESC: Record<CampaignAlert['type'], (a: CampaignAlert) => string> = {
  cpl_alto: (a) => `CPL ${brl(a.value)} > limite ${brl(a.threshold)} (1.5× média)`,
  ctr_baixo: (a) => `CTR ${pct(a.value)} abaixo de ${pct(a.threshold)}`,
  sem_leads: (a) => `${brl(a.spend)} gasto sem nenhum lead`,
}

function brl(v: number | null) {
  if (v === null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function pct(v: number | null) {
  if (v === null) return '—'
  return `${(v * 100).toFixed(2)}%`
}

export function buildAlertEmail(
  campaignAlerts: CampaignAlert[],
  accountAlerts: AccountAlert[],
  periodDays = 7
): { subject: string; html: string } {
  const today = new Date().toLocaleDateString('pt-BR')
  const total = campaignAlerts.length + accountAlerts.length
  const hasBilling = accountAlerts.length > 0

  const subject = hasBilling
    ? `🚨 Problema de pagamento na conta Meta Ads — ${today}`
    : `⚠️ ${total} alerta${total > 1 ? 's' : ''} de campanha — ${today}`

  const accountSection = accountAlerts.length > 0 ? `
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#991b1b;">🚨 Alerta de Conta</p>
      ${accountAlerts.map(a => `
        <p style="margin:4px 0;font-size:13px;color:#7f1d1d;font-weight:600;">${a.message}</p>
        <p style="margin:0 0 8px;font-size:13px;color:#991b1b;">${a.detail}</p>
      `).join('')}
      <p style="margin:8px 0 0;font-size:12px;color:#b91c1c;">
        Verifique o método de pagamento em <a href="https://business.facebook.com/billing" style="color:#b91c1c;">Meta Ads Manager → Faturamento</a>.
      </p>
    </div>
  ` : ''

  const campaignRows = campaignAlerts.map(a => `
    <tr style="border-bottom:1px solid #e2e8f0;">
      <td style="padding:10px 12px;font-size:13px;">${a.campaignName}</td>
      <td style="padding:10px 12px;font-size:13px;">
        <span style="background:${a.type === 'sem_leads' ? '#fef3c7' : '#fee2e2'};color:${a.type === 'sem_leads' ? '#92400e' : '#991b1b'};padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;">
          ${CAMPAIGN_ALERT_LABELS[a.type]}
        </span>
      </td>
      <td style="padding:10px 12px;font-size:13px;color:#475569;">${CAMPAIGN_ALERT_DESC[a.type](a)}</td>
      <td style="padding:10px 12px;font-size:13px;text-align:right;color:#475569;">${brl(a.spend)}</td>
    </tr>
  `).join('')

  const campaignSection = campaignAlerts.length > 0 ? `
    <p style="color:#475569;font-size:14px;margin:0 0 12px;">
      ${campaignAlerts.length} campanha${campaignAlerts.length > 1 ? 's precisam' : ' precisa'} de atenção (últimos ${periodDays} dias):
    </p>
    <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <thead>
        <tr style="background:#f1f5f9;">
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#64748b;font-weight:600;">CAMPANHA</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#64748b;font-weight:600;">ALERTA</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#64748b;font-weight:600;">DETALHE</th>
          <th style="padding:10px 12px;text-align:right;font-size:12px;color:#64748b;font-weight:600;">SPEND</th>
        </tr>
      </thead>
      <tbody>${campaignRows}</tbody>
    </table>
  ` : ''

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;margin:0;padding:32px;">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
    <div style="background:#0f172a;padding:24px 28px;">
      <h1 style="color:#fff;margin:0;font-size:18px;font-weight:600;">ADS Manage — Alertas</h1>
      <p style="color:#94a3b8;margin:4px 0 0;font-size:13px;">${today}</p>
    </div>
    <div style="padding:24px 28px;">
      ${accountSection}
      ${campaignSection}
      <p style="margin:20px 0 0;font-size:13px;color:#94a3b8;">
        Acesse <a href="https://ads-manage.vercel.app/campaigns" style="color:#3b82f6;">ADS Manage</a> para ver detalhes e tomar ação.
      </p>
    </div>
  </div>
</body>
</html>`

  return { subject, html }
}
