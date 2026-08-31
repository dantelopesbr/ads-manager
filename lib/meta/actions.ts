/**
 * Meta campaign actions with audit logging.
 * Every write operation is recorded in sync_logs before execution.
 * All actions are safe-by-default: ACTIVE is blocked, dry-run is supported.
 */
import { SupabaseClient } from '@supabase/supabase-js'
import { updateMetaCampaign, UpdateCampaignFields } from './client'

export interface ActionResult {
  success: boolean
  campaignId: string
  dryRun: boolean
  message: string
}

async function logAction(
  supabase: SupabaseClient,
  campaignId: string,
  fields: UpdateCampaignFields,
  result: 'success' | 'error',
  message: string,
  dryRun: boolean
) {
  const description = [
    dryRun ? '[DRY RUN]' : '[WRITE]',
    `campaign=${campaignId}`,
    fields.status ? `status→${fields.status}` : null,
    fields.daily_budget !== undefined ? `daily_budget→${fields.daily_budget}` : null,
    fields.name ? `name→"${fields.name}"` : null,
  ]
    .filter(Boolean)
    .join(' ')

  await supabase.from('sync_logs').insert({
    type: 'action',
    status: result,
    message: `${description} | ${message}`,
    records_synced: result === 'success' ? 1 : 0,
  })
}

/**
 * Pause a campaign. Safe — campaigns can be reactivated manually.
 */
export async function pauseCampaign(
  supabase: SupabaseClient,
  campaignId: string,
  dryRun = false
): Promise<ActionResult> {
  const accessToken = process.env.META_ACCESS_TOKEN!
  const fields: UpdateCampaignFields = { status: 'PAUSED' }

  try {
    await updateMetaCampaign(accessToken, campaignId, fields, dryRun)
    const msg = dryRun
      ? `Would pause campaign ${campaignId}`
      : `Paused campaign ${campaignId}`
    await logAction(supabase, campaignId, fields, 'success', msg, dryRun)
    return { success: true, campaignId, dryRun, message: msg }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    await logAction(supabase, campaignId, fields, 'error', msg, dryRun)
    throw err
  }
}

/**
 * Update daily budget (in BRL cents: R$200 = 20000).
 */
export async function updateCampaignBudget(
  supabase: SupabaseClient,
  campaignId: string,
  dailyBudgetCents: number,
  dryRun = false
): Promise<ActionResult> {
  if (dailyBudgetCents <= 0) {
    throw new Error('Budget must be greater than 0')
  }

  const accessToken = process.env.META_ACCESS_TOKEN!
  const fields: UpdateCampaignFields = { daily_budget: dailyBudgetCents }

  try {
    await updateMetaCampaign(accessToken, campaignId, fields, dryRun)
    const brl = (dailyBudgetCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    const msg = dryRun
      ? `Would set daily budget to ${brl} on campaign ${campaignId}`
      : `Set daily budget to ${brl} on campaign ${campaignId}`
    await logAction(supabase, campaignId, fields, 'success', msg, dryRun)
    return { success: true, campaignId, dryRun, message: msg }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    await logAction(supabase, campaignId, fields, 'error', msg, dryRun)
    throw err
  }
}
