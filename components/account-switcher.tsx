'use client'

import { ACCOUNTS, ACCOUNT_COOKIE, type AccountKey } from '@/lib/account'

export function AccountSwitcher({ current }: { current: AccountKey }) {
  function switchTo(key: AccountKey) {
    document.cookie = `${ACCOUNT_COOKIE}=${key};path=/;max-age=31536000`
    window.location.reload()
  }

  return (
    <div className="flex rounded-md overflow-hidden border border-slate-700 mb-6 text-xs">
      {(Object.keys(ACCOUNTS) as AccountKey[]).map(key => (
        <button
          key={key}
          onClick={() => switchTo(key)}
          className={
            current === key
              ? 'flex-1 px-3 py-1.5 bg-slate-600 text-white font-medium'
              : 'flex-1 px-3 py-1.5 text-slate-400 hover:bg-slate-800 transition-colors'
          }
        >
          {ACCOUNTS[key].label}
        </button>
      ))}
    </div>
  )
}
