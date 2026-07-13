import { cookies } from 'next/headers'
import { ACCOUNT_COOKIE, isAccountKey, type AccountKey, type AccountSelection } from './account'

/** Raw cookie value: a specific account, or 'all' for the consolidated view. */
export async function getAccountSelection(): Promise<AccountSelection> {
  const jar = await cookies()
  const val = jar.get(ACCOUNT_COOKIE)?.value
  if (val === 'all') return 'all'
  return isAccountKey(val) ? val : 'fratellihouse'
}

/** Single-account pages (campaigns, leads) don't support 'all' — fall back to the default account. */
export async function getAccount(): Promise<AccountKey> {
  const selection = await getAccountSelection()
  return selection === 'all' ? 'fratellihouse' : selection
}
