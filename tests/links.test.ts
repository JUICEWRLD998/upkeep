import { getAddress } from 'viem'
import { describe, expect, it } from 'vitest'
import { LinkError, decodeInvite, decodeKeyReturn, decodePayeeHint, encodeInvite, encodeKeyReturn, encodePayeeHint, newNonce } from '../lib/upkeep/links'

const SENDER = getAddress('0xa231eee840a316116fec11cca47c2059ca7d6793')
const KEY = '0xab9574c02f00101506af242e4ec156963273d201'

describe('invite links', () => {
  it('round-trips and checksums the address', () => {
    const nonce = newNonce()
    const token = encodeInvite({ sender: SENDER, name: 'Mummy', nonce })
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(decodeInvite(token)).toMatchObject({ sender: SENDER, name: 'Mummy', nonce })
  })
  it('keeps non-ASCII names such as Yoruba diacritics', () => {
    const token = encodeInvite({ sender: SENDER, name: 'Ìyá Àgbà', nonce: newNonce() })
    expect(decodeInvite(token).name).toBe('Ìyá Àgbà')
  })
  it('strips control characters and angle brackets from names, and caps length', () => {
    const token = encodeInvite({ sender: SENDER, name: '<b>Mum\u0000</b>' + 'x'.repeat(100), nonce: newNonce() })
    const name = decodeInvite(token).name
    expect(name).not.toMatch(/[<>\u0000]/)
    expect(name.length).toBeLessThanOrEqual(40)
  })
  it('rejects garbage, wrong types, bad addresses and oversize links', () => {
    expect(() => decodeInvite('not base64!!')).toThrow(LinkError)
    expect(() => decodeInvite('e30')).toThrow(LinkError) // "{}"
    expect(() => decodeInvite('a'.repeat(2500))).toThrow(LinkError)
    const keyToken = encodeKeyReturn({ key: { address: KEY, type: 'p256' }, name: 'Mummy', nonce: newNonce() })
    expect(() => decodeInvite(keyToken)).toThrow(LinkError)
    const badAddr = btoa(JSON.stringify({ v: 1, t: 'invite', sender: '0x123', name: 'a', nonce: newNonce() })).replace(/=/g, '')
    expect(() => decodeInvite(badAddr)).toThrow(LinkError)
  })
})

describe('payee hints', () => {
  const A = getAddress('0x99a0d56c4c031c9e19b9bfaf2bb656e0b95e1882')
  it('round-trips labels for valid addresses', () => {
    const token = encodePayeeHint([{ address: A, label: 'Pharmacy' }])
    expect(decodePayeeHint(token)).toEqual([{ address: A, label: 'Pharmacy' }])
  })
  it('drops bad entries instead of failing, and returns nothing for garbage', () => {
    const mixed = btoa(JSON.stringify([{ address: 'nope', label: 'x' }, { address: A, label: 'Ok' }])).replace(/=/g, '')
    expect(decodePayeeHint(mixed)).toEqual([{ address: A, label: 'Ok' }])
    expect(decodePayeeHint('%%%')).toEqual([])
    expect(decodePayeeHint('e30')).toEqual([])
  })
})

describe('key return links', () => {
  it('round-trips only the public key address and type', () => {
    const nonce = newNonce()
    const token = encodeKeyReturn({ key: { address: KEY, type: 'p256' }, name: 'Mummy', nonce })
    const back = decodeKeyReturn(token)
    expect(back.key.type).toBe('p256')
    expect(back.key.address.toLowerCase()).toBe(KEY)
    expect(back.nonce).toBe(nonce)
    expect(JSON.stringify(back)).not.toMatch(/private|secret/i)
  })
  it('rejects unknown key types', () => {
    const bad = btoa(JSON.stringify({ v: 1, t: 'key', key: { address: KEY, type: 'rsa' }, name: 'a', nonce: newNonce() })).replace(/=/g, '')
    expect(() => decodeKeyReturn(bad)).toThrow(LinkError)
  })
})
