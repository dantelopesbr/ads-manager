// Shared constants — safe to import in both client and server components

export type AccountKey = 'fratellihouse' | 'fratellirev'
/** Account selector value — 'all' means consolidated across every account. */
export type AccountSelection = AccountKey | 'all'

export const ACCOUNTS: Record<AccountKey, { label: string; phoneCompany: string }> = {
  fratellihouse: { label: 'Fratelli House', phoneCompany: '+554433018191' },
  fratellirev:   { label: 'FratelliRev',    phoneCompany: '+554433050012' },
}

export const ACCOUNT_KEYS = Object.keys(ACCOUNTS) as AccountKey[]

export const ACCOUNT_COOKIE = 'ads_account'

export function isAccountKey(value: string | undefined): value is AccountKey {
  return value === 'fratellihouse' || value === 'fratellirev'
}
