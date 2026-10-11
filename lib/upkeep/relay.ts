import { createClient, http, type Hex } from 'viem'
import { Account, Relay } from 'viem/tempo'
import { chain, RPC_URL, TOKEN } from './chain'

const TRANSFER_SELECTOR = '0xa9059cbb'
/** transfer(address,uint256): 4-byte selector + two 32-byte words, as a 0x string. Anything longer is padding the sponsor would pay gas for. */
const TRANSFER_DATA_LENGTH = 2 + 8 + 64 + 64
/** A plain token transfer needs well under this. A request asking for more is not one of ours. */
const MAX_GAS = 400_000n

type Call = { to?: string | null; data?: string | null; input?: string | null; value?: string | number | bigint | null }
type Request = {
  to?: string | null
  data?: string | null
  input?: string | null
  value?: unknown
  calls?: readonly Call[]
  chainId?: number | string
  gas?: string | number | bigint | null
  from?: string | null
}

const isZero = (v: unknown) => v === undefined || v === null || BigInt(v as never) === 0n

/**
 * Sponsor only what Upkeep needs: one plain AlphaUSD `transfer` call on Moderato, exact calldata length, no value,
 * a sane gas limit. The sponsor pays the network fee only; it never moves anyone's money. Anything else falls back to
 * sender-paid. Malformed input (a value that is not a number) is a refusal, never an exception.
 */
export function shouldSponsor(req: Request): boolean {
  try {
    if (req.chainId !== undefined && Number(req.chainId) !== chain.id) return false
    if (req.gas !== undefined && req.gas !== null && BigInt(req.gas as never) > MAX_GAS) return false
    const calls: Call[] = req.calls && req.calls.length > 0 ? [...req.calls] : [req as Call]
    if (calls.length !== 1) return false
    const c = calls[0]
    const data = String(c.data ?? c.input ?? '').toLowerCase()
    return (
      (c.to ?? '').toLowerCase() === TOKEN.toLowerCase() &&
      data.startsWith(TRANSFER_SELECTOR) &&
      data.length === TRANSFER_DATA_LENGTH &&
      isZero(c.value)
    )
  } catch {
    return false
  }
}

const hits = new Map<string, number[]>()
const MAX_KEYS = 5000
/**
 * Best-effort sliding-window limiter, per server instance. Returns true when the caller is over the limit. The map is
 * pruned so spoofed keys cannot grow it without bound.
 */
export function overLimit(key: string, max = 40, windowMs = 60_000, now = Date.now()): boolean {
  if (hits.size > MAX_KEYS) {
    for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k)
    if (hits.size > MAX_KEYS) hits.clear()
  }
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
  recent.push(now)
  hits.set(key, recent)
  return recent.length > max
}

/**
 * The full sponsorship decision: the request must look like ours, and neither the sending account nor the whole
 * service may be over its limit. The per-account limit uses the transaction's own `from`, which a caller cannot
 * spoof the way an IP header can, so one account cannot drain the sponsor.
 */
export function sponsorDecision(req: Request, now = Date.now(), limits = { perAccount: 20, global: 300 }): boolean {
  if (!shouldSponsor(req)) return false
  if (req.from && overLimit(`from:${String(req.from).toLowerCase()}`, limits.perAccount, 60_000, now)) return false
  if (overLimit('global', limits.global, 60_000, now)) return false
  return true
}

let relay: ReturnType<typeof Relay.create> | null = null
export function getRelay() {
  if (relay) return relay
  const key = process.env.FEE_PAYER_PRIVATE_KEY as Hex | undefined
  if (!key) throw new Error('FEE_PAYER_PRIVATE_KEY is not set')
  const account = Account.fromSecp256k1(key)
  relay = Relay.create({
    client: createClient({ chain, transport: http(RPC_URL) }),
    plugins: [Relay.feePayer({ account, feeToken: TOKEN, validate: (r) => sponsorDecision(r as Request) })],
  } as never)
  return relay
}
