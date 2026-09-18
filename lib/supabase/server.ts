import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

/**
 * Backend-only privileged client — deliberately NOT built on @supabase/ssr's
 * createServerClient, which is designed to propagate an end user's session
 * cookie as the request's auth (correct for `createClient` above, wrong
 * here). That cookie-based auth was silently overriding the service role
 * key on every request, so this client never actually authenticated as
 * Postgres's `service_role` — writes were rejected by RLS regardless of
 * `to service_role` policies, which is why hubspot_calls /
 * hubspot_calls_sync_state were loosened to `to public` (migrations
 * 015/016) as a workaround, leaving those tables writable by anyone with
 * the anon key. A plain createClient with no cookie wiring has no session
 * to override the key with, so it authenticates as the real service_role
 * and bypasses RLS as intended.
 */
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
