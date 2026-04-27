import { describe, it, expect, vi, beforeEach } from 'vitest'

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

const mockUpsert = vi.fn().mockResolvedValue({ error: null })
const mockSelect = vi.fn().mockResolvedValue({ count: 5, error: null })
const mockFrom = vi.fn().mockReturnValue({
  select: mockSelect,
  upsert: mockUpsert,
})

const mockSupabase = { from: mockFrom }

describe('syncMetaInsights', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReturnValue({ select: mockSelect, upsert: mockUpsert })
    mockSelect.mockResolvedValue({ count: 5, error: null })
    mockUpsert.mockResolvedValue({ error: null })
  })

  it('returns count of synced records', async () => {
    const { syncMetaInsights } = await import('../meta/sync')
    const count = await syncMetaInsights(mockSupabase as any)
    expect(count).toBe(1)
  })

  it('calls upsert with correct shape', async () => {
    const { syncMetaInsights } = await import('../meta/sync')
    await syncMetaInsights(mockSupabase as any)
    expect(mockUpsert).toHaveBeenCalled()
    const rows = mockUpsert.mock.calls[0][0]
    expect(rows[0]).toMatchObject({
      campaign_id: 'c1',
      spend: 120.50,
      impressions: 5000,
    })
  })
})
