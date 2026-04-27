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
  it('returns clicks divided by impressions', () => {
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
    // normalize non-breaking space ( ) that jsdom uses in toLocaleString
    expect(formatCurrency(1234.56).replace(/ /g, ' ')).toBe('R$ 1.234,56')
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
