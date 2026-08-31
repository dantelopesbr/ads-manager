// Weighted score (0-100) for a vendor over some period: Meta (weight 50,
// capped at 100 so an exceptional period doesn't inflate it — the uncapped
// atingimento is reported separately), Conversão (weight 30, only computed
// with 5+ deals criados in the period — noisy below that), Atividade
// (weight 20, ranked relative to the team's max in the same period). Any
// component that can't be computed drops out and the remaining weights
// renormalize automatically.

export function weightedScore(components: { score: number | null; weight: number }[]): number | null {
  const available = components.filter((c): c is { score: number; weight: number } => c.score !== null)
  if (available.length === 0) return null
  const totalWeight = available.reduce((s, c) => s + c.weight, 0)
  return available.reduce((s, c) => s + c.score * c.weight, 0) / totalWeight
}

export interface VendorScoreInputs {
  receita: number
  metaValor: number | null
  criados: number
  ganhos: number
  activity: number
  maxActivity: number
}

export interface VendorScoreResult {
  score: number | null
  hasConversaoScore: boolean
  /** Uncapped receita/metaValor — null when no meta is defined for the period. */
  atingimento: number | null
}

export function computeVendorScore(inputs: VendorScoreInputs): VendorScoreResult {
  const atingimento = inputs.metaValor !== null && inputs.metaValor > 0 ? inputs.receita / inputs.metaValor : null
  const metaScore = atingimento !== null ? Math.min(100, atingimento * 100) : null
  const hasConversaoScore = inputs.criados >= 5
  const conversaoScore = hasConversaoScore ? (inputs.ganhos / inputs.criados) * 100 : null
  const activityScore = inputs.maxActivity > 0 ? (inputs.activity / inputs.maxActivity) * 100 : 0
  const score = weightedScore([
    { score: metaScore, weight: 50 },
    { score: conversaoScore, weight: 30 },
    { score: activityScore, weight: 20 },
  ])
  return { score, hasConversaoScore, atingimento }
}
