import { describe, expect, it } from 'vitest'
import { AmountError, formatAmount, parseAmount } from '../lib/upkeep/amounts'

describe('parseAmount', () => {
  it('parses whole and fractional dollars into 6-decimal base units', () => {
    expect(parseAmount('40')).toBe(40_000_000n)
    expect(parseAmount('40.5')).toBe(40_500_000n)
    expect(parseAmount('0.000001')).toBe(1n)
    expect(parseAmount('1,250.25')).toBe(1_250_250_000n)
  })
  it('rejects zero, negatives, junk and too many decimals', () => {
    for (const bad of ['0', '0.0', '-5', '', 'abc', '1e3', '1.0000001', '4 0']) {
      expect(() => parseAmount(bad), bad).toThrow(AmountError)
    }
  })
})

describe('formatAmount', () => {
  it('shows two decimals minimum and more only when needed', () => {
    expect(formatAmount(40_000_000n)).toBe('40.00')
    expect(formatAmount(5_999_807n)).toBe('5.999807')
    expect(formatAmount(1_250_250_000n)).toBe('1,250.25')
    expect(formatAmount(0n)).toBe('0.00')
  })
  it('round-trips with parseAmount', () => {
    for (const v of ['0.01', '150', '9.999999', '1234567.89']) {
      expect(parseAmount(formatAmount(parseAmount(v)))).toBe(parseAmount(v))
    }
  })
})
