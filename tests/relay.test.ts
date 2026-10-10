import { describe, expect, it } from 'vitest'
import { overLimit, shouldSponsor } from '../lib/upkeep/relay'

const TOKEN = '0x20c0000000000000000000000000000000000001'
const transfer = '0xa9059cbb' + '0'.repeat(128)

describe('shouldSponsor', () => {
  it('sponsors a single AlphaUSD transfer', () => {
    expect(shouldSponsor({ calls: [{ to: TOKEN, data: transfer }] })).toBe(true)
    expect(shouldSponsor({ to: TOKEN, data: transfer, chainId: 42431 })).toBe(true)
  })
  it('refuses other tokens, other methods, value, batches and other chains', () => {
    expect(shouldSponsor({ calls: [{ to: '0x20c0000000000000000000000000000000000000', data: transfer }] })).toBe(false)
    expect(shouldSponsor({ calls: [{ to: TOKEN, data: '0x095ea7b3' + '0'.repeat(128) }] })).toBe(false)
    expect(shouldSponsor({ calls: [{ to: TOKEN, data: transfer, value: 1n }] })).toBe(false)
    expect(shouldSponsor({ calls: [{ to: TOKEN, data: transfer }, { to: TOKEN, data: transfer }] })).toBe(false)
    expect(shouldSponsor({ calls: [{ to: TOKEN, data: transfer }], chainId: 1 })).toBe(false)
    expect(shouldSponsor({})).toBe(false)
  })
})

describe('overLimit', () => {
  it('allows bursts up to the cap, then blocks, then recovers after the window', () => {
    const t = 1_000_000
    for (let i = 0; i < 3; i++) expect(overLimit('a', 3, 1000, t + i)).toBe(false)
    expect(overLimit('a', 3, 1000, t + 10)).toBe(true)
    expect(overLimit('a', 3, 1000, t + 5000)).toBe(false)
  })
})
