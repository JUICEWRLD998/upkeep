import { describe, expect, it } from 'vitest'
import { MAX_LOG_RANGE, blockRanges, chunkedLogs } from '../lib/upkeep/chain'

describe('blockRanges', () => {
  it('covers [from, to] inclusively with no gap and no overlap, each piece under the RPC cap', () => {
    const r = blockRanges(1000n, 250_000n)
    expect(r[0][0]).toBe(1000n)
    expect(r[r.length - 1][1]).toBe(250_000n)
    for (let i = 0; i < r.length; i++) {
      expect(r[i][1] - r[i][0] + 1n).toBeLessThanOrEqual(MAX_LOG_RANGE)
      if (i > 0) expect(r[i][0]).toBe(r[i - 1][1] + 1n)
    }
    // the Moderato RPC rejects anything over 100,000 blocks
    expect(MAX_LOG_RANGE).toBeLessThan(100_000n)
  })
  it('handles a single block and an empty range', () => {
    expect(blockRanges(5n, 5n)).toEqual([[5n, 5n]])
    expect(blockRanges(6n, 5n)).toEqual([])
  })
})

describe('chunkedLogs', () => {
  it('joins results from every piece in order', async () => {
    const seen: [bigint, bigint][] = []
    const out = await chunkedLogs(0n, 200_000n, async (a, b) => {
      seen.push([a, b])
      return [Number(a)]
    })
    expect(out).toEqual(seen.map(([a]) => Number(a)))
    expect(seen.length).toBe(3)
  })
})
