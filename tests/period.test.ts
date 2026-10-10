import { describe, expect, it } from 'vitest'
import { PERIODS, untilText } from '../lib/upkeep/period'

describe('untilText', () => {
  const now = 1_000_000_000
  it('formats days, hours, minutes and seconds', () => {
    expect(untilText(now / 1000 + 2 * 86400 + 4 * 3600, now)).toBe('in 2 d 4 h')
    expect(untilText(now / 1000 + 3 * 3600 + 5 * 60, now)).toBe('in 3 h 5 min')
    expect(untilText(now / 1000 + 190, now)).toBe('in 3 min 10 s')
    expect(untilText(now / 1000 + 42, now)).toBe('in 42 s')
  })
  it('says now once the time has passed', () => {
    expect(untilText(now / 1000 - 5, now)).toBe('now')
  })
  it('keeps the test month short and labelled', () => {
    expect(PERIODS.test.seconds).toBe(120)
    expect(PERIODS.test.label).toMatch(/test/i)
  })
})
