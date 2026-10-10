import { createClient, http, type Hex } from 'viem'
import { Account, Relay } from 'viem/tempo'
import { chain, RPC_URL, TOKEN } from './chain'

const TRANSFER_SELECTOR = '0xa9059cbb'

type Call = { to?: string | null; data?: string | null; input?: string | null; value?: string | number | bigint | null }
type Request = { to?: string | null; data?: string | null; input?: string | null; value?: unknown; calls?: readonly Call[]; chainId?: number | string }

/**
 * Sponsor only what Upkeep needs: plain AlphaUSD `transfer` calls on Moderato, no value attached. The sponsor pays the
 * network fee only; it never moves anyone's money. Anything else falls back to sender-paid.
 */
export function shouldSponsor(req: Request): boolean {
  if (req.chainId !== undefined && Number(req.chainId) !== chain.id) return false
  const calls: Call[] = req.calls && req.calls.length > 0 ? [...req.calls] : [req as Call]
  if (calls.length !== 1) return false
  const c = calls[0]
  const data = (c.data ?? c.input ?? '') as string
  const noValue = c.value === undefined || c.value === null || BigInt(c.value as never) === 0n
  return (c.to ?? '').toLowerCase() === TOKEN.toLowerCase() && data.toLowerCase().startsWith(TRANSFER_SELECTOR) && noValue
}

const hits = new Map<string, number[]>()
/** Best-effort per-IP limiter (per server instance). Returns true when the caller is over the limit. */
export function overLimit(key: string, max = 40, windowMs = 60_000, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
  recent.push(now)
  hits.set(key, recent)
  return recent.length > max
}

let relay: ReturnType<typeof Relay.create> | null = null
export function getRelay() {
  if (relay) return relay
  const key = process.env.FEE_PAYER_PRIVATE_KEY as Hex | undefined
  if (!key) throw new Error('FEE_PAYER_PRIVATE_KEY is not set')
  const account = Account.fromSecp256k1(key)
  relay = Relay.create({
    client: createClient({ chain, transport: http(RPC_URL) }),
    plugins: [Relay.feePayer({ account, feeToken: TOKEN, validate: (r) => { if (process.env.DEBUG_RELAY) console.log('relay validate', JSON.stringify(r, (_, v) => (typeof v === 'bigint' ? v.toString() : v))); const v = shouldSponsor(r as Request); if (process.env.DEBUG_RELAY) console.log('relay verdict', v); return v } })],
  } as never)
  return relay
}
