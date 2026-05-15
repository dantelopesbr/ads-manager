import { cookies } from 'next/headers'
import { ACCOUNT_COOKIE, type AccountKey } from './account'

export async function getAccount(): Promise<AccountKey> {
  const jar = await cookies()
  const val = jar.get(ACCOUNT_COOKIE)?.value
  return val === 'fratellirev' ? 'fratellirev' : 'fratellihouse'
}
