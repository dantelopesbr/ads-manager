'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { AccountSwitcher } from './account-switcher'
import { ACCOUNT_COOKIE, isAccountKey, type AccountSelection } from '@/lib/account'
import { useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const STALE_AFTER_HOURS = 26 // cron runs daily — flag if the last success is older than that + slack

function LastSynced() {
  const supabase = createClient()
  const [state, setState] = useState<{ syncedAt: string; isStale: boolean } | null | undefined>(undefined)

  useEffect(() => {
    supabase
      .from('sync_logs')
      .select('created_at')
      .eq('type', 'meta')
      .eq('status', 'success')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!data?.created_at) { setState(null); return }
        const isStale = Date.now() - new Date(data.created_at).getTime() > STALE_AFTER_HOURS * 60 * 60 * 1000
        setState({ syncedAt: data.created_at, isStale })
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (state === undefined) return null
  if (state === null) return <p className="text-xs text-slate-500 px-3 mb-3">Sem sync ainda</p>

  const date = new Date(state.syncedAt)

  return (
    <p
      className={cn('text-xs px-3 mb-3', state.isStale ? 'text-amber-400' : 'text-slate-500')}
      title={date.toLocaleString('pt-BR')}
    >
      {state.isStale && '⚠ '}Dados {formatDistanceToNow(date, { locale: ptBR, addSuffix: true })}
    </p>
  )
}

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/campaigns', label: 'Campanhas' },
  { href: '/leads', label: 'Leads' },
  { href: '/sem-atendimento', label: 'Sem Atendimento' },
  { href: '/vendedores', label: 'Vendedores' },
  { href: '/settings', label: 'Configurações' },
]

function getCookieAccount(): AccountSelection {
  if (typeof document === 'undefined') return 'fratellihouse'
  const match = document.cookie.match(new RegExp(`${ACCOUNT_COOKIE}=([^;]+)`))
  const val = match?.[1]
  if (val === 'all') return 'all'
  return isAccountKey(val) ? val : 'fratellihouse'
}

export function Nav() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [account, setAccount] = useState<AccountSelection>('fratellihouse')

  useEffect(() => { setAccount(getCookieAccount()) }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <nav className="w-56 min-h-screen bg-brand-dark-gray text-white flex flex-col p-4 shrink-0">
      <h1 className="font-display text-sm font-semibold uppercase tracking-[0.2em] mb-4">ADS Manager</h1>
      <AccountSwitcher current={account} />
      <LastSynced />
      <ul className="space-y-1 flex-1">
        {links.map(link => (
          <li key={link.href}>
            <Link
              href={link.href}
              className={cn(
                'block px-3 py-2 text-sm transition-colors',
                pathname.startsWith(link.href)
                  ? 'bg-brand-dark-green text-white'
                  : 'text-brand-light-green/80 hover:bg-white/10 hover:text-white'
              )}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
      <button
        onClick={handleSignOut}
        className="text-sm text-brand-light-green/70 hover:text-white px-3 py-2 text-left"
      >
        Sair
      </button>
    </nav>
  )
}
