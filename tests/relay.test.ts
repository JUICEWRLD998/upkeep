import { describe, expect, it } from 'vitest'
import { overLimit, shouldSponsor, sponsorDecision } from '../lib/upkeep/relay'

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

describe('shouldSponsor hardening', () => {
  it('refuses padded calldata, a huge gas limit, and values that are not numbers, without throwing', () => {
    expect(shouldSponsor({ calls: [{ to: TOKEN, data: transfer + '00'.repeat(500) }] })).toBe(false)
    expect(shouldSponsor({ calls: [{ to: TOKEN, data: transfer }], gas: 5_000_000 })).toBe(false)
    expect(shouldSponsor({ calls: [{ to: TOKEN, data: transfer }], gas: 200_000 })).toBe(true)
    expect(shouldSponsor({ calls: [{ to: TOKEN, data: transfer, value: 'not-a-number' }] })).toBe(false)
    expect(shouldSponsor({ calls: [{ to: TOKEN, data: transfer }], gas: 'zzz' })).toBe(false)
  })
})

describe('sponsorDecision', () => {
  it('stops one account at its own limit even when every request looks valid, and leaves other accounts alone', () => {
    const t = 5_000_000
    const req = (from: string) => ({ from, calls: [{ to: TOKEN, data: transfer }] })
    for (let i = 0; i < 3; i++) expect(sponsorDecision(req('0xaaaa'), t + i, { perAccount: 3, global: 1000 })).toBe(true)
    expect(sponsorDecision(req('0xaaaa'), t + 5, { perAccount: 3, global: 1000 })).toBe(false)
    expect(sponsorDecision(req('0xbbbb'), t + 6, { perAccount: 3, global: 1000 })).toBe(true)
  })
  it('stops the whole service at the global limit', () => {
    const t = 9_000_000
    const req = (n: number) => ({ from: '0xc' + n, calls: [{ to: TOKEN, data: transfer }] })
    for (let i = 0; i < 4; i++) expect(sponsorDecision(req(i), t + i, { perAccount: 100, global: 4 })).toBe(true)
    expect(sponsorDecision(req(99), t + 10, { perAccount: 100, global: 4 })).toBe(false)
  })
  it('never counts a refused request against anyone', () => {
    const t = 12_000_000
    const bad = { from: '0xdddd', calls: [{ to: '0x20c0000000000000000000000000000000000000', data: transfer }] }
    for (let i = 0; i < 10; i++) expect(sponsorDecision(bad, t + i, { perAccount: 2, global: 2 })).toBe(false)
    expect(sponsorDecision({ from: '0xdddd', calls: [{ to: TOKEN, data: transfer }] }, t + 20, { perAccount: 2, global: 2 })).toBe(true)
  })
})
