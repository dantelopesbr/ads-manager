// Shared constants — safe to import in both client and server components

export type AccountKey = 'fratellihouse' | 'fratellirev'

export const ACCOUNTS: Record<AccountKey, { label: string; phoneCompany: string }> = {
  fratellihouse: { label: 'Fratelli House', phoneCompany: '+554433018191' },
  fratellirev:   { label: 'FratelliRev',    phoneCompany: '+554433050012' },
}

export const ACCOUNT_COOKIE = 'ads_account'
