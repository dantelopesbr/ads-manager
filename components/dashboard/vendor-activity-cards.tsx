import type { ResumoDiarioRow } from '@/lib/atividade-comercial'

interface VendorSummary {
  vendedor: string
  conversas: number
  ligacoes: number
  detalhe: Record<string, number>
}

export function VendorActivityCards({ rows }: { rows: ResumoDiarioRow[] }) {
  const byVendor: Record<string, VendorSummary> = {}
  for (const r of rows) {
    if (!byVendor[r.vendedor]) byVendor[r.vendedor] = { vendedor: r.vendedor, conversas: 0, ligacoes: 0, detalhe: {} }
    const v = byVendor[r.vendedor]
    v.conversas += r.total_conversas_whatsapp ?? 0
    v.ligacoes += r.total_ligacoes ?? 0
    for (const [label, count] of Object.entries(r.ligacoes_detalhe ?? {})) {
      v.detalhe[label] = (v.detalhe[label] ?? 0) + count
    }
  }

  const vendors = Object.values(byVendor).sort((a, b) => b.conversas + b.ligacoes - (a.conversas + a.ligacoes))

  if (vendors.length === 0) {
    return <p className="text-sm text-slate-400">Sem atividade registrada nesse período.</p>
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {vendors.map(v => (
        <div key={v.vendedor} className="bg-white rounded-xl border p-5">
          <p className="text-sm font-semibold text-slate-700 mb-3">{v.vendedor}</p>
          <div className="flex gap-6">
            <div>
              <p className="text-2xl font-bold">{v.conversas}</p>
              <p className="text-xs text-slate-400">Conversas WhatsApp</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{v.ligacoes}</p>
              <p className="text-xs text-slate-400">Ligações</p>
            </div>
          </div>
          {Object.keys(v.detalhe).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {Object.entries(v.detalhe).map(([label, count]) => (
                <span key={label} className="text-xs bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">
                  {label}: {count}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
