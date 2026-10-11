import { getAddress, isAddress, type Address, type Hex } from 'viem'
import { Account } from 'viem/tempo'
import { plausibleRate, type Rate } from './rate'

/** Server-only desk configuration and the live dollar-to-naira rate. */
export class DeskNotReady extends Error {}

/**
 * The server needs only the desk master's id and public address to derive deposit addresses and read the ledger.
 * The master's private key is used once, by scripts/setup-server-keys.mjs, and is not required at runtime.
 * (DESK_MASTER_PRIVATE_KEY is still accepted as a fallback source for the address.)
 */
export function deskConfig(): { masterId: Hex; master: Address } {
  const masterId = process.env.DESK_MASTER_ID as Hex | undefined
  const addr = process.env.DESK_MASTER_ADDRESS
  const key = process.env.DESK_MASTER_PRIVATE_KEY as Hex | undefined
  const master = addr && isAddress(addr, { strict: false }) ? getAddress(addr) : key ? Account.fromSecp256k1(key).address : null
  if (!masterId || !/^0x[0-9a-fA-F]{8}$/.test(masterId) || !master) {
    throw new DeskNotReady('The payout desk is not set up yet (DESK_MASTER_ID and DESK_MASTER_ADDRESS are needed).')
  }
  return { masterId, master }
}

let cached: { rate: Rate; at: number } | null = null
const TTL_MS = 10 * 60 * 1000

/**
 * USD to NGN from a public rates feed. If the feed is down or returns something implausible this returns null and
 * the desk shows "rate unavailable". It never falls back to a made-up number.
 */
export async function currentRate(now: number = Date.now()): Promise<Rate | null> {
  if (cached && now - cached.at < TTL_MS) return cached.rate
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(4000), cache: 'no-store' })
    if (!res.ok) return cached?.rate ?? null
    const json = (await res.json()) as { rates?: Record<string, unknown>; time_last_update_utc?: string }
    const n = json.rates?.NGN
    if (!plausibleRate(n)) return cached?.rate ?? null
    const rate: Rate = { ngnPerUsd: n, source: 'open.er-api.com', asOf: json.time_last_update_utc ?? new Date(now).toUTCString() }
    cached = { rate, at: now }
    return rate
  } catch {
    return cached?.rate ?? null
  }
}
