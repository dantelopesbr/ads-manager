import { createClient } from '@/lib/supabase/server'
import { Nav } from '@/components/nav'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SyncButton } from './sync-button'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const supabase = await createClient()

  const { data: logs } = await supabase
    .from('sync_logs')
    .select('type, status, records_synced, message, created_at')
    .order('created_at', { ascending: false })
    .limit(20)

  const lastMeta = logs?.find(l => l.type === 'meta')
  const lastHubspot = logs?.find(l => l.type === 'hubspot')
  const lastAlerts = logs?.find(l => l.type === 'alerts')

  const metaTokenSet = !!process.env.META_ACCESS_TOKEN
  const hubspotKeySet = !!process.env.HUBSPOT_API_KEY

  return (
    <div className="flex">
      <Nav />
      <main className="flex-1 p-8 max-w-2xl">
        <h2 className="text-2xl font-bold mb-6">Configurações</h2>

        <Card className="mb-6">
          <CardHeader><CardTitle className="text-base">Integrações</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Meta Ads</p>
                <p className="text-xs text-slate-400">META_ACCESS_TOKEN + META_AD_ACCOUNT_ID</p>
              </div>
              <Badge variant={metaTokenSet ? 'default' : 'destructive'}>
                {metaTokenSet ? 'Configurado' : 'Não configurado'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">HubSpot</p>
                <p className="text-xs text-slate-400">HUBSPOT_API_KEY</p>
              </div>
              <Badge variant={hubspotKeySet ? 'default' : 'destructive'}>
                {hubspotKeySet ? 'Configurado' : 'Não configurado'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader><CardTitle className="text-base">Sincronização Manual</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Meta Ads</p>
                {lastMeta && (
                  <p className="text-xs text-slate-400">
                    Último: {new Date(lastMeta.created_at).toLocaleString('pt-BR')} ·{' '}
                    <span className={lastMeta.status === 'success' ? 'text-green-500' : 'text-red-500'}>
                      {lastMeta.status === 'success' ? `${lastMeta.records_synced} registros` : lastMeta.message}
                    </span>
                  </p>
                )}
              </div>
              <SyncButton endpoint="/api/meta/sync" label="Sync Meta" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">HubSpot</p>
                {lastHubspot && (
                  <p className="text-xs text-slate-400">
                    Último: {new Date(lastHubspot.created_at).toLocaleString('pt-BR')} ·{' '}
                    <span className={lastHubspot.status === 'success' ? 'text-green-500' : 'text-red-500'}>
                      {lastHubspot.status === 'success' ? `${lastHubspot.records_synced} contatos` : lastHubspot.message}
                    </span>
                  </p>
                )}
              </div>
              <SyncButton endpoint="/api/hubspot/enrich" label="Sync HubSpot" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Alertas</p>
                {lastAlerts && (
                  <p className="text-xs text-slate-400">
                    Último: {new Date(lastAlerts.created_at).toLocaleString('pt-BR')} ·{' '}
                    <span className={lastAlerts.status === 'success' ? 'text-green-500' : 'text-red-500'}>
                      {lastAlerts.status === 'success' ? lastAlerts.message : lastAlerts.message}
                    </span>
                  </p>
                )}
              </div>
              <SyncButton endpoint="/api/alerts" label="Verificar Alertas" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Histórico de Syncs</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 border-b">
                  <th className="pb-2 text-left">Tipo</th>
                  <th className="pb-2 text-left">Status</th>
                  <th className="pb-2 text-left">Registros</th>
                  <th className="pb-2 text-left">Data</th>
                </tr>
              </thead>
              <tbody>
                {(logs ?? []).map((log, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-2 pr-4 capitalize">{log.type}</td>
                    <td className="py-2 pr-4">
                      <Badge variant={log.status === 'success' ? 'default' : 'destructive'} className="text-xs">
                        {log.status}
                      </Badge>
                    </td>
                    <td className="py-2 pr-4">{log.records_synced ?? '—'}</td>
                    <td className="py-2 text-slate-400">{new Date(log.created_at).toLocaleString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
