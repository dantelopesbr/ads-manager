/**
 * Deduplicates meta_ads_conversions rows by click_id.
 * When a lead is recategorized, a new row is inserted with the same click_id.
 * Keep only the most recent row per click_id; rows with null click_id are kept as-is.
 */
export function dedupeByClickId<T extends { click_id?: string | null; created_at: string }>(rows: T[]): T[] {
  const byClickId = new Map<string, T>()
  const noClickId: T[] = []

  for (const row of rows) {
    if (!row.click_id) {
      noClickId.push(row)
      continue
    }
    const existing = byClickId.get(row.click_id)
    if (!existing || row.created_at > existing.created_at) {
      byClickId.set(row.click_id, row)
    }
  }

  return [...byClickId.values(), ...noClickId]
}
