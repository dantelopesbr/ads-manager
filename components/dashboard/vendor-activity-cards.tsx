import type { ResumoDiarioRow } from '@/lib/atividade-comercial'

interface GroupTotals {
  conversas: number
  ligacoes: number
  detalhe: Record<string, number>
}

interface VendorSummary {
  vendedor: string
  cliente: GroupTotals
  parceiro: GroupTotals
}

function emptyGroup(): GroupTotals {
  return { conversas: 0, ligacoes: 0, detalhe: {} }
}

function addDetalhe(target: Record<string, number>, source: Record<string, number> | null) {
  for (const [label, count] of Object.entries(source ?? {})) {
    target[label] = (target[label] ?? 0) + count
  }
}

function GroupStat({ label, group }: { label: string; group: GroupTotals }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-400 mb-1.5">{label}</p>
      <div className="flex gap-5">
        <div>
          <p className="text-xl font-bold">{group.conversas}</p>
          <p className="text-[11px] text-slate-400">Conversas</p>
        </div>
        <div>
          <p className="text-xl font-bold">{group.ligacoes}</p>
          <p className="text-[11px] text-slate-400">Ligações</p>
        </div>
      </div>
      {Object.keys(group.detalhe).length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {Object.entries(group.detalhe).map(([l, count]) => (
            <span key={l} className="text-[11px] bg-slate-100 text-slate-600 rounded-full px-1.5 py-0.5">
              {l}: {count}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export function VendorActivityCards({ rows }: { rows: ResumoDiarioRow[] }) {
  const byVendor: Record<string, VendorSummary> = {}
  for (const r of rows) {
    if (!byVendor[r.vendedor]) byVendor[r.vendedor] = { vendedor: r.vendedor, cliente: emptyGroup(), parceiro: emptyGroup() }
    const v = byVendor[r.vendedor]
    v.cliente.conversas += r.total_conversas_cliente ?? 0
    v.cliente.ligacoes += r.total_ligacoes_cliente ?? 0
    addDetalhe(v.cliente.detalhe, r.ligacoes_detalhe_cliente)
    v.parceiro.conversas += r.total_conversas_parceiro ?? 0
    v.parceiro.ligacoes += r.total_ligacoes_parceiro ?? 0
    addDetalhe(v.parceiro.detalhe, r.ligacoes_detalhe_parceiro)
  }

  const totalOf = (v: VendorSummary) => v.cliente.conversas + v.cliente.ligacoes + v.parceiro.conversas + v.parceiro.ligacoes
  const vendors = Object.values(byVendor).sort((a, b) => totalOf(b) - totalOf(a))

  if (vendors.length === 0) {
    return <p className="text-sm text-slate-400">Sem atividade registrada nesse período.</p>
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {vendors.map(v => (
        <div key={v.vendedor} className="bg-white rounded-xl border p-5">
          <p className="text-sm font-semibold text-slate-700 mb-3">{v.vendedor}</p>
          <div className="grid grid-cols-2 gap-4">
            <GroupStat label="Clientes" group={v.cliente} />
            <GroupStat label="Parceiros" group={v.parceiro} />
          </div>
        </div>
      ))}
    </div>
  )
}
