'use client'

import { ACCOUNTS, ACCOUNT_KEYS, ACCOUNT_COOKIE, type AccountSelection } from '@/lib/account'

const OPTIONS: { key: AccountSelection; label: string }[] = [
  { key: 'all', label: 'Todas' },
  ...ACCOUNT_KEYS.map(key => ({ key, label: ACCOUNTS[key].label })),
]

export function AccountSwitcher({ current }: { current: AccountSelection }) {
  function switchTo(key: AccountSelection) {
    document.cookie = `${ACCOUNT_COOKIE}=${key};path=/;max-age=31536000`
    window.location.reload()
  }

  return (
    <div className="flex rounded-md overflow-hidden border border-slate-700 mb-3 text-xs">
      {OPTIONS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => switchTo(key)}
          className={
            current === key
              ? 'flex-1 px-3 py-1.5 bg-slate-600 text-white font-medium'
              : 'flex-1 px-3 py-1.5 text-slate-400 hover:bg-slate-800 transition-colors'
          }
        >
          {label}
        </button>
      ))}
    </div>
  )
}
