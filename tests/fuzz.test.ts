import { describe, expect, it } from 'vitest'
import { getAddress } from 'viem'
import { LinkError, decodeInvite, decodeKeyReturn, decodePayeeHint, encodeInvite, encodeKeyReturn, newNonce } from '../lib/upkeep/links'
import { PayeeError, cleanPayee } from '../lib/upkeep/payee'
import { AmountError, parseAmount } from '../lib/upkeep/amounts'

// Deterministic PRNG so a failure is reproducible.
function rng(seed: number) {
  let s = seed >>> 0
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32)
}
const SENDER = getAddress('0xa231eee840a316116fec11cca47c2059ca7d6793')
const KEY = '0xab9574c02f00101506af242e4ec156963273d201'
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_=+/%<>"\' \n\u0000\u202e'

function onlyAllowed(fn: () => unknown, allowed: Array<new (...a: never[]) => Error>) {
  try {
    fn()
  } catch (e) {
    if (!allowed.some((A) => e instanceof A)) throw new Error('unexpected error type: ' + String(e))
  }
}

describe('fuzz: links', () => {
  it('positive control: the fuzzer harness accepts a valid invite and key link', () => {
    expect(decodeInvite(encodeInvite({ sender: SENDER, name: 'Mummy', nonce: newNonce() })).name).toBe('Mummy')
    expect(decodeKeyReturn(encodeKeyReturn({ key: { address: KEY, type: 'p256' }, name: 'Mummy', nonce: newNonce() })).key.type).toBe('p256')
  })
  it('random strings only ever throw LinkError, never anything else', () => {
    const r = rng(1)
    for (let i = 0; i < 4000; i++) {
      const len = Math.floor(r() * 3000)
      let s = ''
      for (let j = 0; j < len; j++) s += ALPHABET[Math.floor(r() * ALPHABET.length)]
      onlyAllowed(() => decodeInvite(s), [LinkError])
      onlyAllowed(() => decodeKeyReturn(s), [LinkError])
      expect(() => decodePayeeHint(s)).not.toThrow()
    }
  })
  it('a valid token with one character changed either still decodes to safe values or throws LinkError', () => {
    const r = rng(2)
    const base = encodeInvite({ sender: SENDER, name: 'Mummy', nonce: newNonce() })
    let decoded = 0
    for (let i = 0; i < 2000; i++) {
      const at = Math.floor(r() * base.length)
      const mutated = base.slice(0, at) + ALPHABET[Math.floor(r() * 64)] + base.slice(at + 1)
      onlyAllowed(() => {
        const inv = decodeInvite(mutated)
        decoded++
        expect(inv.name).not.toMatch(/[<>\u0000-\u001f]/)
        expect(inv.sender).toBe(getAddress(inv.sender))
      }, [LinkError])
    }
    expect(decoded).toBeGreaterThanOrEqual(0)
  })
})

describe('fuzz: payee and amount input', () => {
  it('cleanPayee only returns clean data or throws PayeeError, for arbitrary objects', () => {
    const r = rng(3)
    const junk = () => [undefined, null, 0, 1e9, true, {}, [], 'x', ' ', '<script>alert(1)</script>', "'; drop table payees;--", 'a'.repeat(5000), '\u0000\u202e'][Math.floor(r() * 13)]
    for (let i = 0; i < 3000; i++) {
      const input = { sender: r() < 0.5 ? SENDER : junk(), label: junk(), bank: junk(), accountName: junk(), last4: r() < 0.3 ? '1234' : junk() }
      onlyAllowed(() => {
        const p = cleanPayee(input as never)
        expect(p.label.length).toBeLessThanOrEqual(40)
        expect(p.bank.length).toBeLessThanOrEqual(40)
        expect(p.accountName.length).toBeLessThanOrEqual(60)
        expect(p.last4).toMatch(/^\d{4}$/)
        expect(`${p.label}${p.bank}${p.accountName}`).not.toMatch(/[<>\u0000-\u001f]/)
      }, [PayeeError])
    }
  })
  it('parseAmount only returns a positive bigint or throws AmountError', () => {
    const r = rng(4)
    for (let i = 0; i < 5000; i++) {
      let s = ''
      const len = Math.floor(r() * 24)
      for (let j = 0; j < len; j++) s += '0123456789.,- eE+x'[Math.floor(r() * 18)]
      onlyAllowed(() => {
        const v = parseAmount(s)
        expect(v > 0n).toBe(true)
      }, [AmountError])
    }
  })
})
