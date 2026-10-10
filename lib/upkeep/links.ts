import { getAddress, isAddress, type Address } from 'viem'
import type { KeyRef } from './keys'

/**
 * Links carry no secrets. The invite holds the sender's public address and a label; the return link holds only the
 * relative's key address and type. A forged invite is harmless: the key it produces is useless until the real sender
 * approves it on chain, and the approval screen shows the key address and the relative's name before signing.
 */
export type Invite = { v: 1; t: 'invite'; sender: Address; name: string; nonce: string }
export type KeyReturn = { v: 1; t: 'key'; key: KeyRef; name: string; nonce: string }

export class LinkError extends Error {}

const MAX_LEN = 2000
const KEY_TYPES = ['p256', 'secp256k1', 'webAuthn'] as const

function b64urlEncode(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(s: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) throw new LinkError('This link is damaged.')
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}

export function cleanName(raw: string): string {
  // eslint-disable-next-line no-control-regex
  const name = raw.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 40)
  if (!name) throw new LinkError('A name is required.')
  return name
}

function parse(token: string): Record<string, unknown> {
  if (token.length > MAX_LEN) throw new LinkError('This link is too long to be valid.')
  let obj: unknown
  try {
    obj = JSON.parse(b64urlDecode(token))
  } catch (e) {
    if (e instanceof LinkError) throw e
    throw new LinkError('This link is damaged.')
  }
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw new LinkError('This link is damaged.')
  return obj as Record<string, unknown>
}

function addr(v: unknown): Address {
  if (typeof v !== 'string' || !isAddress(v, { strict: false })) throw new LinkError('This link has an invalid address.')
  return getAddress(v)
}

function nonce(v: unknown): string {
  if (typeof v !== 'string' || !/^[0-9a-f]{16,64}$/.test(v)) throw new LinkError('This link has an invalid code.')
  return v
}

export function newNonce(): string {
  const b = new Uint8Array(16)
  crypto.getRandomValues(b)
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
}

export function encodeInvite(i: Omit<Invite, 'v' | 't'>): string {
  return b64urlEncode(JSON.stringify({ v: 1, t: 'invite', sender: addr(i.sender), name: cleanName(i.name), nonce: nonce(i.nonce) }))
}

export function decodeInvite(token: string): Invite {
  const o = parse(token)
  if (o.v !== 1 || o.t !== 'invite') throw new LinkError('This is not an Upkeep invite.')
  return { v: 1, t: 'invite', sender: addr(o.sender), name: cleanName(String(o.name ?? '')), nonce: nonce(o.nonce) }
}

export function encodeKeyReturn(r: Omit<KeyReturn, 'v' | 't'>): string {
  return b64urlEncode(JSON.stringify({ v: 1, t: 'key', key: { address: addr(r.key.address), type: r.key.type }, name: cleanName(r.name), nonce: nonce(r.nonce) }))
}

export function decodeKeyReturn(token: string): KeyReturn {
  const o = parse(token)
  if (o.v !== 1 || o.t !== 'key') throw new LinkError('This is not an Upkeep key link.')
  const k = o.key as Record<string, unknown> | undefined
  if (!k || typeof k !== 'object') throw new LinkError('This link has no key.')
  const type = (KEY_TYPES as readonly unknown[]).includes(k.type) ? (k.type as KeyRef['type']) : null
  if (!type) throw new LinkError('This link has an unknown key type.')
  return { v: 1, t: 'key', key: { address: addr(k.address), type }, name: cleanName(String(o.name ?? '')), nonce: nonce(o.nonce) }
}
