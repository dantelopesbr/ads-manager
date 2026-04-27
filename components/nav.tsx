'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/campaigns', label: 'Campanhas' },
  { href: '/leads', label: 'Leads' },
  { href: '/settings', label: 'Configurações' },
]

export function Nav() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <nav className="w-56 min-h-screen bg-slate-900 text-white flex flex-col p-4 shrink-0">
      <h1 className="text-lg font-bold mb-8">ADS Manager</h1>
      <ul className="space-y-1 flex-1">
        {links.map(link => (
          <li key={link.href}>
            <Link
              href={link.href}
              className={cn(
                'block px-3 py-2 rounded-md text-sm transition-colors',
                pathname.startsWith(link.href)
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-300 hover:bg-slate-800'
              )}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
      <button
        onClick={handleSignOut}
        className="text-sm text-slate-400 hover:text-white px-3 py-2 text-left"
      >
        Sair
      </button>
    </nav>
  )
}
