import { cookies } from 'next/headers'

export type AccountKey = 'fratellihouse' | 'fratellirev'

export const ACCOUNTS: Record<AccountKey, { label: string; phoneCompany: string }> = {
  fratellihouse: { label: 'Fratelli House', phoneCompany: '+554433018191' },
  fratellirev:   { label: 'FratelliRev',    phoneCompany: '+554433050012' },
}

export const ACCOUNT_COOKIE = 'ads_account'

export async function getAccount(): Promise<AccountKey> {
  const jar = await cookies()
  const val = jar.get(ACCOUNT_COOKIE)?.value
  return val === 'fratellirev' ? 'fratellirev' : 'fratellihouse'
}
