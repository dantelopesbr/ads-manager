# ADS Management System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js 15 web app that combines Meta Ads spend data, Supabase conversion data, and HubSpot lead enrichment into a single campaign performance dashboard.

**Architecture:** Next.js 15 App Router with Supabase as central DB. Meta Ads insights sync via Vercel Cron (daily). HubSpot enrichment on-demand by phone match. All data aggregated server-side via API routes before rendering.

**Tech Stack:** Next.js 15, TypeScript, Supabase (PostgreSQL + Auth + SSR), Meta Marketing API v20, HubSpot API v3, shadcn/ui, Recharts, TanStack Table, Vitest, Playwright

---

## File Structure

```
/
├── app/
│   ├── layout.tsx                        # Root layout with auth check
│   ├── page.tsx                          # Redirect → /dashboard
│   ├── (auth)/login/page.tsx             # Login page
│   ├── dashboard/page.tsx                # KPIs + chart
│   ├── campaigns/page.tsx                # Campaigns drill-down table
│   ├── leads/page.tsx                    # Leads table + HubSpot data
│   ├── settings/page.tsx                 # Config + sync status
│   └── api/
│       ├── meta/sync/route.ts            # POST — Vercel Cron trigger
│       ├── hubspot/enrich/route.ts       # POST — enrich leads by phone
│       └── insights/campaigns/route.ts  # GET — aggregated campaign metrics
├── lib/
│   ├── supabase/
│   │   ├── client.ts                     # Browser Supabase client
│   │   ├── server.ts                     # Server Supabase client (cookies)
│   │   └── types.ts                      # TypeScript types for all tables
│   ├── meta/
│   │   ├── client.ts                     # Meta Graph API fetch wrapper
│   │   └── sync.ts                       # Sync logic: fetch → upsert
│   ├── hubspot/
│   │   ├── client.ts                     # HubSpot API fetch wrapper
│   │   └── enrich.ts                     # Enrich logic: phone → contact + deal
│   └── metrics.ts                        # CPL, CTR, ROAS calculations
├── components/
│   ├── nav.tsx                           # Sidebar navigation
│   ├── dashboard/
│   │   ├── kpi-card.tsx                  # Single KPI display
│   │   └── performance-chart.tsx         # Leads + spend over time
│   ├── campaigns/
│   │   └── campaigns-table.tsx           # Drill-down: campaign → adset → ad
│   └── leads/
│       └── leads-table.tsx               # Leads with HubSpot enrichment
├── middleware.ts                          # Auth redirect protection
├── vercel.json                            # Cron job config
└── supabase/
    └── migrations/
        └── 001_create_tables.sql         # meta_insights, hubspot_contacts, sync_logs
```

---

## Task 1: Project Initialization

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts` (via create-next-app)
- Create: `.env.local.example`
- Create: `vercel.json`

- [ ] **Step 1: Scaffold Next.js app**

```bash
cd "/Users/dantelopes/ADS - Manage"
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=no --import-alias="@/*"
```

Expected output: files created, dependencies installed.

- [ ] **Step 2: Install dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install @tanstack/react-table recharts
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
npm install -D playwright @playwright/test
npx shadcn@latest init
```

When shadcn asks: style=Default, base color=Slate, CSS variables=yes.

Then add components:
```bash
npx shadcn@latest add card table badge button input label select
```

- [ ] **Step 3: Create `.env.local.example`**

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Meta Ads
META_ACCESS_TOKEN=
META_AD_ACCOUNT_ID=   # format: act_XXXXXXXXXX

# HubSpot
HUBSPOT_API_KEY=

# Vercel Cron protection
CRON_SECRET=
```

Copy to `.env.local` and fill in values.

- [ ] **Step 4: Create `vercel.json`**

```json
{
  "crons": [
    {
      "path": "/api/meta/sync",
      "schedule": "0 6 * * *"
    }
  ]
}
```

- [ ] **Step 5: Configure Vitest — create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

- [ ] **Step 6: Create `vitest.setup.ts`**

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 7: Add test script to `package.json`**

Add to `scripts`:
```json
"test": "vitest",
"test:run": "vitest run",
"test:e2e": "playwright test"
```

- [ ] **Step 8: Commit**

```bash
git init
git add .
git commit -m "feat: initialize Next.js 15 project with dependencies"
```

---

## Task 2: Supabase Types & Clients

**Files:**
- Create: `lib/supabase/types.ts`
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`

- [ ] **Step 1: Create `lib/supabase/types.ts`**

```typescript
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface MetaAdsConversion {
  id: number
  created_at: string
  ads_id: string | null
  phone_client: string | null
  click_id: string | null
  source_url: string | null
  phone_company: string | null
  data_sent: string | null
  campaign_id: string | null
  campaign_name: string | null
  adset_id: string | null
  adset_name: string | null
  ad_name: string | null
}

export interface MetaInsight {
  id: number
  date: string
  campaign_id: string
  campaign_name: string | null
  adset_id: string
  adset_name: string | null
  ad_id: string
  ad_name: string | null
  spend: number | null
  impressions: number | null
  clicks: number | null
  reach: number | null
  synced_at: string
}

export interface HubspotContact {
  id: number
  phone: string
  hs_contact_id: string | null
  lifecycle_stage: string | null
  deal_value: number | null
  deal_stage: string | null
  updated_at: string
}

export interface SyncLog {
  id: number
  type: 'meta' | 'hubspot'
  status: 'success' | 'error'
  message: string | null
  records_synced: number | null
  created_at: string
}
```

- [ ] **Step 2: Create `lib/supabase/client.ts`**

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 3: Create `lib/supabase/server.ts`**

```typescript
import { createServerClient } from '@supabase/ssr'
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

export async function createServiceClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
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
```

- [ ] **Step 4: Commit**

```bash
git add lib/supabase/
git commit -m "feat: add Supabase clients and TypeScript types"
```

---

## Task 3: Database Migration

**Files:**
- Create: `supabase/migrations/001_create_tables.sql`

- [ ] **Step 1: Create migration file**

```sql
-- meta_insights: daily snapshot of Meta Ads performance
create table if not exists public.meta_insights (
  id            bigint generated by default as identity primary key,
  date          date not null,
  campaign_id   text not null,
  campaign_name text,
  adset_id      text not null,
  adset_name    text,
  ad_id         text not null,
  ad_name       text,
  spend         numeric(10,2),
  impressions   integer,
  clicks        integer,
  reach         integer,
  synced_at     timestamp with time zone default now(),
  unique (date, campaign_id, adset_id, ad_id)
);

-- hubspot_contacts: enriched contacts matched by phone
create table if not exists public.hubspot_contacts (
  id              bigint generated by default as identity primary key,
  phone           text not null unique,
  hs_contact_id   text,
  lifecycle_stage text,
  deal_value      numeric(10,2),  -- valor do deal aberto mais recente
  deal_stage      text,
  updated_at      timestamp with time zone default now()
);

-- sync_logs: record of all sync operations
create table if not exists public.sync_logs (
  id              bigint generated by default as identity primary key,
  type            text not null check (type in ('meta', 'hubspot')),
  status          text not null check (status in ('success', 'error')),
  message         text,
  records_synced  integer,
  created_at      timestamp with time zone default now()
);

-- RLS policies
alter table public.meta_insights enable row level security;
alter table public.hubspot_contacts enable row level security;
alter table public.sync_logs enable row level security;

-- Only authenticated users can read
create policy "Authenticated read meta_insights"
  on public.meta_insights for select
  to authenticated using (true);

create policy "Authenticated read hubspot_contacts"
  on public.hubspot_contacts for select
  to authenticated using (true);

create policy "Authenticated read sync_logs"
  on public.sync_logs for select
  to authenticated using (true);

-- Service role can write (used by API routes with service key)
create policy "Service role write meta_insights"
  on public.meta_insights for all
  to service_role using (true);

create policy "Service role write hubspot_contacts"
  on public.hubspot_contacts for all
  to service_role using (true);

create policy "Service role write sync_logs"
  on public.sync_logs for all
  to service_role using (true);
```

- [ ] **Step 2: Apply migration in Supabase dashboard**

Go to Supabase dashboard → SQL Editor → paste content of `001_create_tables.sql` → Run.

Verify tables exist: `meta_insights`, `hubspot_contacts`, `sync_logs`.

- [ ] **Step 3: Commit**

```bash
git add supabase/
git commit -m "feat: add database migration for meta_insights, hubspot_contacts, sync_logs"
```

---

## Task 4: Metrics Calculations (TDD)

**Files:**
- Create: `lib/metrics.ts`
- Create: `lib/__tests__/metrics.test.ts`

- [ ] **Step 1: Write failing tests — create `lib/__tests__/metrics.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { calcCPL, calcCTR, calcROAS, formatCurrency, formatPercent } from '../metrics'

describe('calcCPL', () => {
  it('returns spend divided by leads', () => {
    expect(calcCPL(1000, 10)).toBe(100)
  })
  it('returns null when leads is zero', () => {
    expect(calcCPL(1000, 0)).toBeNull()
  })
  it('returns null when spend is null', () => {
    expect(calcCPL(null, 10)).toBeNull()
  })
})

describe('calcCTR', () => {
  it('returns clicks divided by impressions as percentage', () => {
    expect(calcCTR(100, 1000)).toBeCloseTo(0.1)
  })
  it('returns null when impressions is zero', () => {
    expect(calcCTR(100, 0)).toBeNull()
  })
  it('returns null when impressions is null', () => {
    expect(calcCTR(100, null)).toBeNull()
  })
})

describe('calcROAS', () => {
  it('returns deal_value divided by spend', () => {
    expect(calcROAS(5000, 1000)).toBe(5)
  })
  it('returns null when spend is zero', () => {
    expect(calcROAS(5000, 0)).toBeNull()
  })
  it('returns null when deal_value is null', () => {
    expect(calcROAS(null, 1000)).toBeNull()
  })
})

describe('formatCurrency', () => {
  it('formats number as BRL currency', () => {
    expect(formatCurrency(1234.56)).toBe('R$ 1.234,56')
  })
  it('returns "—" for null', () => {
    expect(formatCurrency(null)).toBe('—')
  })
})

describe('formatPercent', () => {
  it('formats decimal as percentage with 2 decimals', () => {
    expect(formatPercent(0.1234)).toBe('12.34%')
  })
  it('returns "—" for null', () => {
    expect(formatPercent(null)).toBe('—')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:run
```

Expected: FAIL — "Cannot find module '../metrics'"

- [ ] **Step 3: Create `lib/metrics.ts`**

```typescript
export function calcCPL(spend: number | null, leads: number): number | null {
  if (spend === null || leads === 0) return null
  return spend / leads
}

export function calcCTR(clicks: number | null, impressions: number | null): number | null {
  if (clicks === null || impressions === null || impressions === 0) return null
  return clicks / impressions
}

export function calcROAS(dealValue: number | null, spend: number | null): number | null {
  if (dealValue === null || spend === null || spend === 0) return null
  return dealValue / spend
}

export function formatCurrency(value: number | null): string {
  if (value === null) return '—'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatPercent(value: number | null): string {
  if (value === null) return '—'
  return `${(value * 100).toFixed(2)}%`
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:run
```

Expected: PASS — all 11 tests

- [ ] **Step 5: Commit**

```bash
git add lib/metrics.ts lib/__tests__/
git commit -m "feat: add CPL, CTR, ROAS metrics calculations with tests"
```

---

## Task 5: Meta Ads API Client

**Files:**
- Create: `lib/meta/client.ts`
- Create: `lib/meta/sync.ts`
- Create: `lib/__tests__/meta-sync.test.ts`

- [ ] **Step 1: Create `lib/meta/client.ts`**

```typescript
const META_API_VERSION = 'v20.0'
const BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`

export interface MetaInsightRaw {
  campaign_id: string
  campaign_name: string
  adset_id: string
  adset_name: string
  ad_id: string
  ad_name: string
  spend: string
  impressions: string
  clicks: string
  reach: string
  date_start: string
}

export async function fetchMetaInsights(
  accessToken: string,
  adAccountId: string,
  since: string,
  until: string
): Promise<MetaInsightRaw[]> {
  const params = new URLSearchParams({
    fields: 'campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,clicks,reach',
    level: 'ad',
    time_range: JSON.stringify({ since, until }),
    time_increment: '1',
    limit: '500',
    access_token: accessToken,
  })

  const results: MetaInsightRaw[] = []
  let url: string | null = `${BASE_URL}/${adAccountId}/insights?${params}`

  while (url) {
    const res = await fetch(url)
    if (!res.ok) {
      const error = await res.json()
      throw new Error(`Meta API error: ${JSON.stringify(error)}`)
    }
    const json = await res.json()
    results.push(...(json.data ?? []))
    url = json.paging?.next ?? null
  }

  return results
}
```

- [ ] **Step 2: Create `lib/meta/sync.ts`**

```typescript
import { SupabaseClient } from '@supabase/supabase-js'
import { fetchMetaInsights, MetaInsightRaw } from './client'
import { format, subDays } from 'date-fns'

function getSyncWindow(isFirstSync: boolean): { since: string; until: string } {
  const today = new Date()
  const since = format(subDays(today, isFirstSync ? 90 : 30), 'yyyy-MM-dd')
  const until = format(subDays(today, 1), 'yyyy-MM-dd')
  return { since, until }
}

function toInsightRow(raw: MetaInsightRaw) {
  return {
    date: raw.date_start,
    campaign_id: raw.campaign_id,
    campaign_name: raw.campaign_name,
    adset_id: raw.adset_id,
    adset_name: raw.adset_name,
    ad_id: raw.ad_id,
    ad_name: raw.ad_name,
    spend: parseFloat(raw.spend) || 0,
    impressions: parseInt(raw.impressions) || 0,
    clicks: parseInt(raw.clicks) || 0,
    reach: parseInt(raw.reach) || 0,
  }
}

export async function syncMetaInsights(supabase: SupabaseClient): Promise<number> {
  const accessToken = process.env.META_ACCESS_TOKEN!
  const adAccountId = process.env.META_AD_ACCOUNT_ID!

  // Detect first sync by checking if any rows exist
  const { count } = await supabase
    .from('meta_insights')
    .select('*', { count: 'exact', head: true })
  const isFirstSync = count === 0

  const { since, until } = getSyncWindow(isFirstSync)
  const raw = await fetchMetaInsights(accessToken, adAccountId, since, until)
  const rows = raw.map(toInsightRow)

  if (rows.length === 0) return 0

  const { error } = await supabase
    .from('meta_insights')
    .upsert(rows, { onConflict: 'date,campaign_id,adset_id,ad_id' })

  if (error) throw new Error(`Supabase upsert error: ${error.message}`)

  return rows.length
}
```

- [ ] **Step 3: Install date-fns**

```bash
npm install date-fns
```

- [ ] **Step 4: Write failing tests — create `lib/__tests__/meta-sync.test.ts`**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { syncMetaInsights } from '../meta/sync'

const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockResolvedValue({ count: 5, error: null }),
  upsert: vi.fn().mockResolvedValue({ error: null }),
}

vi.mock('../meta/client', () => ({
  fetchMetaInsights: vi.fn().mockResolvedValue([
    {
      campaign_id: 'c1',
      campaign_name: 'Campaign 1',
      adset_id: 'as1',
      adset_name: 'Adset 1',
      ad_id: 'a1',
      ad_name: 'Ad 1',
      spend: '120.50',
      impressions: '5000',
      clicks: '250',
      reach: '4500',
      date_start: '2026-04-25',
    },
  ]),
}))

describe('syncMetaInsights', () => {
  it('returns count of synced records', async () => {
    const count = await syncMetaInsights(mockSupabase as any)
    expect(count).toBe(1)
  })

  it('calls upsert with correct shape', async () => {
    await syncMetaInsights(mockSupabase as any)
    const upsertCall = mockSupabase.upsert.mock.calls[0][0]
    expect(upsertCall[0]).toMatchObject({
      campaign_id: 'c1',
      spend: 120.50,
      impressions: 5000,
    })
  })
})
```

- [ ] **Step 5: Run tests**

```bash
npm run test:run
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/meta/ lib/__tests__/meta-sync.test.ts
git commit -m "feat: add Meta Ads API client and sync logic with tests"
```

---

## Task 6: Meta Sync API Route

**Files:**
- Create: `app/api/meta/sync/route.ts`

- [ ] **Step 1: Create `app/api/meta/sync/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { syncMetaInsights } from '@/lib/meta/sync'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()

  try {
    const count = await syncMetaInsights(supabase)

    await supabase.from('sync_logs').insert({
      type: 'meta',
      status: 'success',
      records_synced: count,
      message: `Synced ${count} records`,
    })

    return NextResponse.json({ synced: count })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'

    await supabase.from('sync_logs').insert({
      type: 'meta',
      status: 'error',
      records_synced: 0,
      message,
    })

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/meta/
git commit -m "feat: add Meta sync API route with CRON_SECRET auth"
```

---

## Task 7: HubSpot Client & Enrich Route

**Files:**
- Create: `lib/hubspot/client.ts`
- Create: `lib/hubspot/enrich.ts`
- Create: `app/api/hubspot/enrich/route.ts`

- [ ] **Step 1: Create `lib/hubspot/client.ts`**

```typescript
const BASE_URL = 'https://api.hubapi.com'

export interface HubSpotContactResult {
  hs_contact_id: string
  phone: string
  lifecycle_stage: string | null
}

export interface HubSpotDeal {
  deal_value: number | null
  deal_stage: string | null
}

async function hubspotFetch(path: string, options: RequestInit, apiKey: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (!res.ok) throw new Error(`HubSpot API error ${res.status}: ${await res.text()}`)
  return res.json()
}

export async function searchContactByPhone(
  phone: string,
  apiKey: string
): Promise<HubSpotContactResult | null> {
  const body = {
    filterGroups: [{
      filters: [{ propertyName: 'phone', operator: 'EQ', value: phone }]
    }],
    properties: ['phone', 'lifecyclestage'],
    limit: 1,
  }

  const data = await hubspotFetch(
    '/crm/v3/objects/contacts/search',
    { method: 'POST', body: JSON.stringify(body) },
    apiKey
  )

  if (!data.results?.length) return null

  const contact = data.results[0]
  return {
    hs_contact_id: contact.id,
    phone,
    lifecycle_stage: contact.properties?.lifecyclestage ?? null,
  }
}

export async function getMostRecentDeal(
  contactId: string,
  apiKey: string
): Promise<HubSpotDeal> {
  const data = await hubspotFetch(
    `/crm/v3/objects/contacts/${contactId}/associations/deals`,
    { method: 'GET' },
    apiKey
  )

  if (!data.results?.length) return { deal_value: null, deal_stage: null }

  // Get the most recent deal
  const dealId = data.results[data.results.length - 1].id
  const deal = await hubspotFetch(
    `/crm/v3/objects/deals/${dealId}?properties=amount,dealstage`,
    { method: 'GET' },
    apiKey
  )

  return {
    deal_value: deal.properties?.amount ? parseFloat(deal.properties.amount) : null,
    deal_stage: deal.properties?.dealstage ?? null,
  }
}
```

- [ ] **Step 2: Create `lib/hubspot/enrich.ts`**

```typescript
import { SupabaseClient } from '@supabase/supabase-js'
import { searchContactByPhone, getMostRecentDeal } from './client'

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt === maxAttempts) throw err
      await sleep(Math.pow(2, attempt) * 500)
    }
  }
  throw new Error('Max retries exceeded')
}

export async function enrichLeads(supabase: SupabaseClient): Promise<number> {
  const apiKey = process.env.HUBSPOT_API_KEY!

  // Get unique phones not yet enriched or enriched > 24h ago
  const { data: conversions } = await supabase
    .from('[FH]Meta Ads')
    .select('phone_client')
    .not('phone_client', 'is', null)

  if (!conversions?.length) return 0

  const phones = [...new Set(conversions.map(c => c.phone_client as string))]
  let enriched = 0

  for (const phone of phones) {
    try {
      const contact = await withRetry(() => searchContactByPhone(phone, apiKey))
      if (!contact) continue

      const deal = await withRetry(() => getMostRecentDeal(contact.hs_contact_id, apiKey))

      await supabase.from('hubspot_contacts').upsert(
        { phone, ...contact, ...deal, updated_at: new Date().toISOString() },
        { onConflict: 'phone' }
      )
      enriched++
    } catch {
      // Skip individual phone failures, continue batch
      continue
    }
  }

  return enriched
}
```

- [ ] **Step 3: Create `app/api/hubspot/enrich/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { enrichLeads } from '@/lib/hubspot/enrich'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()

  try {
    const count = await enrichLeads(supabase)

    await supabase.from('sync_logs').insert({
      type: 'hubspot',
      status: 'success',
      records_synced: count,
      message: `Enriched ${count} contacts`,
    })

    return NextResponse.json({ enriched: count })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'

    await supabase.from('sync_logs').insert({
      type: 'hubspot',
      status: 'error',
      records_synced: 0,
      message,
    })

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/hubspot/ app/api/hubspot/
git commit -m "feat: add HubSpot client, enrich logic, and API route"
```

---

## Task 8: Campaign Insights Aggregation Route

**Files:**
- Create: `app/api/insights/campaigns/route.ts`

- [ ] **Step 1: Create `app/api/insights/campaigns/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calcCPL, calcCTR, calcROAS } from '@/lib/metrics'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const since = searchParams.get('since') ?? new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  const until = searchParams.get('until') ?? new Date().toISOString().split('T')[0]
  const level = (searchParams.get('level') ?? 'campaign') as 'campaign' | 'adset' | 'ad'

  // Aggregate Meta insights
  const { data: insights, error: insightsError } = await supabase
    .from('meta_insights')
    .select('campaign_id, campaign_name, adset_id, adset_name, ad_id, ad_name, spend, impressions, clicks')
    .gte('date', since)
    .lte('date', until)

  if (insightsError) return NextResponse.json({ error: insightsError.message }, { status: 500 })

  // Count leads from [FH]Meta Ads
  const { data: conversions } = await supabase
    .from('[FH]Meta Ads')
    .select('campaign_id, adset_id, ad_name, phone_client')
    .gte('created_at', since)
    .lte('created_at', until)

  // Count leads per group key
  const leadCounts: Record<string, number> = {}
  for (const c of conversions ?? []) {
    const key = level === 'campaign' ? c.campaign_id
      : level === 'adset' ? `${c.campaign_id}__${c.adset_id}`
      : `${c.campaign_id}__${c.adset_id}__${c.ad_name}`
    if (key) leadCounts[key] = (leadCounts[key] ?? 0) + 1
  }

  // Aggregate insights by level
  const grouped: Record<string, {
    id: string; name: string; spend: number
    impressions: number; clicks: number; leads: number
  }> = {}

  for (const row of insights ?? []) {
    const key = level === 'campaign' ? row.campaign_id
      : level === 'adset' ? `${row.campaign_id}__${row.adset_id}`
      : `${row.campaign_id}__${row.adset_id}__${row.ad_id}`
    const name = level === 'campaign' ? row.campaign_name
      : level === 'adset' ? row.adset_name
      : row.ad_name

    if (!grouped[key]) {
      grouped[key] = { id: key, name: name ?? key, spend: 0, impressions: 0, clicks: 0, leads: 0 }
    }
    grouped[key].spend += row.spend ?? 0
    grouped[key].impressions += row.impressions ?? 0
    grouped[key].clicks += row.clicks ?? 0
    grouped[key].leads = leadCounts[key] ?? 0
  }

  const result = Object.values(grouped).map(g => ({
    ...g,
    cpl: calcCPL(g.spend, g.leads),
    ctr: calcCTR(g.clicks, g.impressions),
  }))

  return NextResponse.json({ data: result, since, until, level })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/insights/
git commit -m "feat: add campaign insights aggregation API route"
```

---

## Task 9: Auth & Layout

**Files:**
- Create: `middleware.ts`
- Create: `app/(auth)/login/page.tsx`
- Modify: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `components/nav.tsx`

- [ ] **Step 1: Create `middleware.ts`**

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  if (!user && !pathname.startsWith('/login') && !pathname.startsWith('/api')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

- [ ] **Step 2: Create `app/(auth)/login/page.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>ADS Manager</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Create `components/nav.tsx`**

```typescript
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
    <nav className="w-56 min-h-screen bg-slate-900 text-white flex flex-col p-4">
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
```

- [ ] **Step 4: Update `app/layout.tsx`**

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'ADS Manager',
  description: 'Gestão de anúncios Meta Ads',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
```

- [ ] **Step 5: Create `app/page.tsx`**

```typescript
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/dashboard')
}
```

- [ ] **Step 6: Commit**

```bash
git add middleware.ts app/ components/nav.tsx
git commit -m "feat: add auth middleware, login page, and navigation"
```

---

## Task 10: Dashboard Page

**Files:**
- Create: `components/dashboard/kpi-card.tsx`
- Create: `components/dashboard/performance-chart.tsx`
- Create: `app/dashboard/page.tsx`

- [ ] **Step 1: Create `components/dashboard/kpi-card.tsx`**

```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface KpiCardProps {
  title: string
  value: string
  subtitle?: string
}

export function KpiCard({ title, value, subtitle }: KpiCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-500">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Create `components/dashboard/performance-chart.tsx`**

```typescript
'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface ChartPoint {
  date: string
  leads: number
  spend: number
}

export function PerformanceChart({ data }: { data: ChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
        <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
        <Tooltip />
        <Legend />
        <Line yAxisId="left" type="monotone" dataKey="leads" stroke="#6366f1" name="Leads" dot={false} />
        <Line yAxisId="right" type="monotone" dataKey="spend" stroke="#f59e0b" name="Spend (R$)" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 3: Create `app/dashboard/page.tsx`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { Nav } from '@/components/nav'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { PerformanceChart } from '@/components/dashboard/performance-chart'
import { calcCPL, formatCurrency } from '@/lib/metrics'
import { format, subDays } from 'date-fns'

export default async function DashboardPage() {
  const supabase = await createClient()
  const since = format(subDays(new Date(), 30), 'yyyy-MM-dd')
  const until = format(new Date(), 'yyyy-MM-dd')

  const [{ data: insights }, { count: totalLeads }, { data: deals }] = await Promise.all([
    supabase.from('meta_insights').select('spend, date').gte('date', since).lte('date', until),
    supabase.from('[FH]Meta Ads').select('*', { count: 'exact', head: true }).gte('created_at', since),
    supabase.from('hubspot_contacts').select('deal_value').not('deal_value', 'is', null),
  ])

  const totalSpend = (insights ?? []).reduce((sum, r) => sum + (r.spend ?? 0), 0)
  const totalDealValue = (deals ?? []).reduce((sum, r) => sum + (r.deal_value ?? 0), 0)
  const cpl = calcCPL(totalSpend, totalLeads ?? 0)
  const roas = totalSpend > 0 ? totalDealValue / totalSpend : null

  // Build daily chart data
  const byDate: Record<string, { spend: number }> = {}
  for (const row of insights ?? []) {
    if (!byDate[row.date]) byDate[row.date] = { spend: 0 }
    byDate[row.date].spend += row.spend ?? 0
  }

  const { data: dailyLeads } = await supabase
    .from('[FH]Meta Ads')
    .select('created_at')
    .gte('created_at', since)

  const leadsByDate: Record<string, number> = {}
  for (const row of dailyLeads ?? []) {
    const d = row.created_at.split('T')[0]
    leadsByDate[d] = (leadsByDate[d] ?? 0) + 1
  }

  const chartData = Object.keys(byDate).sort().map(date => ({
    date,
    spend: Math.round(byDate[date].spend),
    leads: leadsByDate[date] ?? 0,
  }))

  return (
    <div className="flex">
      <Nav />
      <main className="flex-1 p-8">
        <h2 className="text-2xl font-bold mb-6">Dashboard</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KpiCard title="Total Spend" value={formatCurrency(totalSpend)} subtitle="últimos 30 dias" />
          <KpiCard title="Leads" value={String(totalLeads ?? 0)} subtitle="últimos 30 dias" />
          <KpiCard title="CPL" value={formatCurrency(cpl)} />
          <KpiCard title="ROAS" value={roas !== null ? `${roas.toFixed(2)}x` : '—'} />
        </div>
        <div className="bg-white rounded-xl border p-6">
          <h3 className="text-sm font-semibold mb-4 text-slate-600">Leads + Spend (30 dias)</h3>
          <PerformanceChart data={chartData} />
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/ app/dashboard/
git commit -m "feat: add dashboard page with KPIs and performance chart"
```

---

## Task 11: Campaigns Page

**Files:**
- Create: `components/campaigns/campaigns-table.tsx`
- Create: `app/campaigns/page.tsx`

- [ ] **Step 1: Create `components/campaigns/campaigns-table.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatPercent } from '@/lib/metrics'

interface CampaignRow {
  id: string
  name: string
  spend: number
  leads: number
  cpl: number | null
  ctr: number | null
  impressions: number
  clicks: number
}

interface Props {
  campaigns: CampaignRow[]
  avgCpl: number | null
}

export function CampaignsTable({ campaigns, avgCpl }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-slate-500 text-left">
            <th className="pb-3 pr-4 font-medium">Campanha</th>
            <th className="pb-3 pr-4 font-medium text-right">Spend</th>
            <th className="pb-3 pr-4 font-medium text-right">Leads</th>
            <th className="pb-3 pr-4 font-medium text-right">CPL</th>
            <th className="pb-3 pr-4 font-medium text-right">CTR</th>
            <th className="pb-3 pr-4 font-medium text-right">Impressões</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map(row => {
            const highCpl = avgCpl !== null && row.cpl !== null && row.cpl > avgCpl * 1.2
            const lowCtr = row.ctr !== null && row.ctr < 0.005
            return (
              <tr
                key={row.id}
                className="border-b hover:bg-slate-50 cursor-pointer"
                onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
              >
                <td className="py-3 pr-4 font-medium">
                  {row.name}
                  {highCpl && <Badge variant="destructive" className="ml-2 text-xs">CPL alto</Badge>}
                  {lowCtr && <Badge variant="outline" className="ml-2 text-xs">CTR baixo</Badge>}
                </td>
                <td className="py-3 pr-4 text-right">{formatCurrency(row.spend)}</td>
                <td className="py-3 pr-4 text-right">{row.leads}</td>
                <td className="py-3 pr-4 text-right">{formatCurrency(row.cpl)}</td>
                <td className="py-3 pr-4 text-right">{formatPercent(row.ctr)}</td>
                <td className="py-3 pr-4 text-right">{row.impressions.toLocaleString('pt-BR')}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/campaigns/page.tsx`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { Nav } from '@/components/nav'
import { CampaignsTable } from '@/components/campaigns/campaigns-table'
import { calcCPL, calcCTR } from '@/lib/metrics'
import { format, subDays } from 'date-fns'

export default async function CampaignsPage() {
  const supabase = await createClient()
  const since = format(subDays(new Date(), 30), 'yyyy-MM-dd')
  const until = format(new Date(), 'yyyy-MM-dd')

  const [{ data: insights }, { data: conversions }] = await Promise.all([
    supabase.from('meta_insights').select('campaign_id, campaign_name, spend, impressions, clicks').gte('date', since).lte('date', until),
    supabase.from('[FH]Meta Ads').select('campaign_id').gte('created_at', since),
  ])

  const leadsByCampaign: Record<string, number> = {}
  for (const c of conversions ?? []) {
    if (c.campaign_id) leadsByCampaign[c.campaign_id] = (leadsByCampaign[c.campaign_id] ?? 0) + 1
  }

  const grouped: Record<string, { name: string; spend: number; impressions: number; clicks: number }> = {}
  for (const row of insights ?? []) {
    if (!grouped[row.campaign_id]) {
      grouped[row.campaign_id] = { name: row.campaign_name ?? row.campaign_id, spend: 0, impressions: 0, clicks: 0 }
    }
    grouped[row.campaign_id].spend += row.spend ?? 0
    grouped[row.campaign_id].impressions += row.impressions ?? 0
    grouped[row.campaign_id].clicks += row.clicks ?? 0
  }

  const campaigns = Object.entries(grouped).map(([id, g]) => ({
    id,
    name: g.name,
    spend: g.spend,
    leads: leadsByCampaign[id] ?? 0,
    cpl: calcCPL(g.spend, leadsByCampaign[id] ?? 0),
    ctr: calcCTR(g.clicks, g.impressions),
    impressions: g.impressions,
    clicks: g.clicks,
  })).sort((a, b) => b.spend - a.spend)

  const totalLeads = campaigns.reduce((s, c) => s + c.leads, 0)
  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0)
  const avgCpl = calcCPL(totalSpend, totalLeads)

  return (
    <div className="flex">
      <Nav />
      <main className="flex-1 p-8">
        <h2 className="text-2xl font-bold mb-6">Campanhas</h2>
        <div className="bg-white rounded-xl border p-6">
          <CampaignsTable campaigns={campaigns} avgCpl={avgCpl} />
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/campaigns/ app/campaigns/
git commit -m "feat: add campaigns page with drill-down table and CPL/CTR alerts"
```

---

## Task 12: Leads Page

**Files:**
- Create: `components/leads/leads-table.tsx`
- Create: `app/leads/page.tsx`

- [ ] **Step 1: Create `components/leads/leads-table.tsx`**

```typescript
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/metrics'

interface LeadRow {
  id: number
  phone_client: string | null
  campaign_name: string | null
  adset_name: string | null
  ad_name: string | null
  created_at: string
  lifecycle_stage: string | null
  deal_value: number | null
  deal_stage: string | null
}

export function LeadsTable({ leads }: { leads: LeadRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-slate-500 text-left">
            <th className="pb-3 pr-4 font-medium">Telefone</th>
            <th className="pb-3 pr-4 font-medium">Campanha</th>
            <th className="pb-3 pr-4 font-medium">Adset</th>
            <th className="pb-3 pr-4 font-medium">Ad</th>
            <th className="pb-3 pr-4 font-medium">Data</th>
            <th className="pb-3 pr-4 font-medium">HubSpot</th>
            <th className="pb-3 pr-4 font-medium text-right">Deal</th>
          </tr>
        </thead>
        <tbody>
          {leads.map(lead => (
            <tr key={lead.id} className="border-b hover:bg-slate-50">
              <td className="py-3 pr-4 font-mono text-xs">{lead.phone_client ?? '—'}</td>
              <td className="py-3 pr-4">{lead.campaign_name ?? '—'}</td>
              <td className="py-3 pr-4 text-slate-500">{lead.adset_name ?? '—'}</td>
              <td className="py-3 pr-4 text-slate-500">{lead.ad_name ?? '—'}</td>
              <td className="py-3 pr-4 text-slate-400">{new Date(lead.created_at).toLocaleDateString('pt-BR')}</td>
              <td className="py-3 pr-4">
                {lead.lifecycle_stage
                  ? <Badge variant="outline" className="text-xs">{lead.lifecycle_stage}</Badge>
                  : <span className="text-slate-300 text-xs">não encontrado</span>
                }
              </td>
              <td className="py-3 pr-4 text-right">{formatCurrency(lead.deal_value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/leads/page.tsx`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { Nav } from '@/components/nav'
import { LeadsTable } from '@/components/leads/leads-table'
import { format, subDays } from 'date-fns'

export default async function LeadsPage() {
  const supabase = await createClient()
  const since = format(subDays(new Date(), 30), 'yyyy-MM-dd')

  const { data: conversions } = await supabase
    .from('[FH]Meta Ads')
    .select('id, phone_client, campaign_name, adset_name, ad_name, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(500)

  const phones = [...new Set((conversions ?? []).map(c => c.phone_client).filter(Boolean))]
  const { data: contacts } = await supabase
    .from('hubspot_contacts')
    .select('phone, lifecycle_stage, deal_value, deal_stage')
    .in('phone', phones)

  const contactByPhone = Object.fromEntries(
    (contacts ?? []).map(c => [c.phone, c])
  )

  const leads = (conversions ?? []).map(c => ({
    ...c,
    lifecycle_stage: contactByPhone[c.phone_client ?? '']?.lifecycle_stage ?? null,
    deal_value: contactByPhone[c.phone_client ?? '']?.deal_value ?? null,
    deal_stage: contactByPhone[c.phone_client ?? '']?.deal_stage ?? null,
  }))

  return (
    <div className="flex">
      <Nav />
      <main className="flex-1 p-8">
        <h2 className="text-2xl font-bold mb-2">Leads</h2>
        <p className="text-sm text-slate-500 mb-6">Últimos 30 dias · {leads.length} leads</p>
        <div className="bg-white rounded-xl border p-6">
          <LeadsTable leads={leads} />
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/leads/ app/leads/
git commit -m "feat: add leads page with HubSpot enrichment display"
```

---

## Task 13: Settings Page

**Files:**
- Create: `app/settings/page.tsx`

- [ ] **Step 1: Create `app/settings/page.tsx`**

```typescript
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { Nav } from '@/components/nav'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SyncButton } from './sync-button'

export default async function SettingsPage() {
  const supabase = await createClient()

  const { data: logs } = await supabase
    .from('sync_logs')
    .select('type, status, records_synced, message, created_at')
    .order('created_at', { ascending: false })
    .limit(10)

  const lastMeta = logs?.find(l => l.type === 'meta')
  const lastHubspot = logs?.find(l => l.type === 'hubspot')

  const metaTokenSet = !!process.env.META_ACCESS_TOKEN
  const hubspotKeySet = !!process.env.HUBSPOT_API_KEY

  return (
    <div className="flex">
      <Nav />
      <main className="flex-1 p-8 max-w-2xl">
        <h2 className="text-2xl font-bold mb-6">Configurações</h2>

        <Card className="mb-6">
          <CardHeader><CardTitle className="text-base">Integrações</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Meta Ads</p>
                <p className="text-xs text-slate-400">META_ACCESS_TOKEN + META_AD_ACCOUNT_ID</p>
              </div>
              <Badge variant={metaTokenSet ? 'default' : 'destructive'}>
                {metaTokenSet ? 'Configurado' : 'Não configurado'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">HubSpot</p>
                <p className="text-xs text-slate-400">HUBSPOT_API_KEY</p>
              </div>
              <Badge variant={hubspotKeySet ? 'default' : 'destructive'}>
                {hubspotKeySet ? 'Configurado' : 'Não configurado'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader><CardTitle className="text-base">Sincronização Manual</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Meta Ads</p>
                {lastMeta && (
                  <p className="text-xs text-slate-400">
                    Último: {new Date(lastMeta.created_at).toLocaleString('pt-BR')} ·{' '}
                    <span className={lastMeta.status === 'success' ? 'text-green-500' : 'text-red-500'}>
                      {lastMeta.status === 'success' ? `${lastMeta.records_synced} registros` : lastMeta.message}
                    </span>
                  </p>
                )}
              </div>
              <SyncButton endpoint="/api/meta/sync" label="Sync Meta" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">HubSpot</p>
                {lastHubspot && (
                  <p className="text-xs text-slate-400">
                    Último: {new Date(lastHubspot.created_at).toLocaleString('pt-BR')} ·{' '}
                    <span className={lastHubspot.status === 'success' ? 'text-green-500' : 'text-red-500'}>
                      {lastHubspot.status === 'success' ? `${lastHubspot.records_synced} contatos` : lastHubspot.message}
                    </span>
                  </p>
                )}
              </div>
              <SyncButton endpoint="/api/hubspot/enrich" label="Sync HubSpot" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Histórico de Syncs</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 border-b">
                  <th className="pb-2 text-left">Tipo</th>
                  <th className="pb-2 text-left">Status</th>
                  <th className="pb-2 text-left">Registros</th>
                  <th className="pb-2 text-left">Data</th>
                </tr>
              </thead>
              <tbody>
                {(logs ?? []).map(log => (
                  <tr key={log.created_at} className="border-b">
                    <td className="py-2 pr-4 capitalize">{log.type}</td>
                    <td className="py-2 pr-4">
                      <Badge variant={log.status === 'success' ? 'default' : 'destructive'} className="text-xs">
                        {log.status}
                      </Badge>
                    </td>
                    <td className="py-2 pr-4">{log.records_synced ?? '—'}</td>
                    <td className="py-2 text-slate-400">{new Date(log.created_at).toLocaleString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/settings/sync-button.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export function SyncButton({ endpoint, label }: { endpoint: string; label: string }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function handleSync() {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET ?? ''}` },
      })
      const json = await res.json()
      setResult(res.ok ? `OK` : `Erro: ${json.error}`)
    } catch {
      setResult('Erro de rede')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {result && <span className="text-xs text-slate-500">{result}</span>}
      <Button size="sm" variant="outline" onClick={handleSync} disabled={loading}>
        {loading ? 'Sincronizando...' : label}
      </Button>
    </div>
  )
}
```

Note: add `NEXT_PUBLIC_CRON_SECRET` to `.env.local` with same value as `CRON_SECRET` so the settings page can trigger syncs from the browser.

- [ ] **Step 3: Commit**

```bash
git add app/settings/
git commit -m "feat: add settings page with sync status and manual trigger"
```

---

## Task 14: E2E Tests

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/dashboard.spec.ts`

- [ ] **Step 1: Create `playwright.config.ts`**

```typescript
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:3000',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
```

- [ ] **Step 2: Install Playwright browsers**

```bash
npx playwright install chromium
```

- [ ] **Step 3: Create `e2e/dashboard.spec.ts`**

```typescript
import { test, expect } from '@playwright/test'

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Use Supabase test credentials from env
    await page.goto('/login')
    await page.fill('#email', process.env.TEST_EMAIL ?? '')
    await page.fill('#password', process.env.TEST_PASSWORD ?? '')
    await page.click('button[type=submit]')
    await page.waitForURL('/dashboard')
  })

  test('shows KPI cards', async ({ page }) => {
    await expect(page.getByText('Total Spend')).toBeVisible()
    await expect(page.getByText('Leads')).toBeVisible()
    await expect(page.getByText('CPL')).toBeVisible()
    await expect(page.getByText('ROAS')).toBeVisible()
  })

  test('navigates to campaigns', async ({ page }) => {
    await page.click('text=Campanhas')
    await page.waitForURL('/campaigns')
    await expect(page.getByText('Campanhas')).toBeVisible()
  })

  test('navigates to leads', async ({ page }) => {
    await page.click('text=Leads')
    await page.waitForURL('/leads')
    await expect(page.getByText('Leads')).toBeVisible()
  })
})
```

- [ ] **Step 4: Add TEST_EMAIL and TEST_PASSWORD to `.env.local`**

```bash
TEST_EMAIL=seu-email@dominio.com
TEST_PASSWORD=sua-senha
```

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts e2e/
git commit -m "feat: add Playwright E2E tests for dashboard navigation"
```

---

## Task 15: Vercel Deploy & Domain

- [ ] **Step 1: Push to GitHub**

```bash
git remote add origin https://github.com/SEU_USER/ads-manage.git
git branch -M main
git push -u origin main
```

- [ ] **Step 2: Connect Vercel**

1. Go to vercel.com → New Project → Import from GitHub
2. Select repo `ads-manage`
3. Framework: Next.js (auto-detected)

- [ ] **Step 3: Add environment variables in Vercel dashboard**

Add all variables from `.env.local.example`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `META_ACCESS_TOKEN`
- `META_AD_ACCOUNT_ID`
- `HUBSPOT_API_KEY`
- `CRON_SECRET`
- `NEXT_PUBLIC_CRON_SECRET`

- [ ] **Step 4: Add custom domain in Vercel**

Vercel dashboard → Project → Settings → Domains → Add domain → follow DNS instructions.

- [ ] **Step 5: Verify Cron job**

Vercel dashboard → Project → Cron Jobs → confirm `/api/meta/sync` scheduled at `0 6 * * *`.

- [ ] **Step 6: Trigger initial sync manually**

From `/settings` page, click "Sync Meta" — this runs the 90-day initial sync. Then "Sync HubSpot".

---

## Spec Coverage Check

| Spec requirement | Task |
|---|---|
| Next.js 15 + Supabase + Auth | Tasks 1, 2, 9 |
| Tabelas meta_insights, hubspot_contacts, sync_logs | Task 3 |
| Meta Ads sync (cron diário, janela 90d/30d) | Tasks 5, 6 |
| HubSpot enrich por telefone + deal value | Tasks 7 |
| Dashboard KPIs + gráfico | Task 10 |
| Campanhas drill-down + badges CPL/CTR | Task 11 |
| Leads table + HubSpot enrichment | Task 12 |
| Settings + status sync + trigger manual | Task 13 |
| CPL, CTR, ROAS calculations (TDD) | Task 4 |
| RLS em todas as novas tabelas | Task 3 |
| Vercel Cron + domínio próprio | Tasks 1, 15 |
| CRON_SECRET auth em API routes | Tasks 6, 7 |
| sync_logs para histórico | Tasks 6, 7, 13 |
| Error handling + retry HubSpot | Task 7 |
| E2E tests | Task 14 |
