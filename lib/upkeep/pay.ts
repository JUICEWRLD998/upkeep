import { createClient, http, publicActions, type Account as ViemAccount, type Address, type Hex, type Transport } from 'viem'
import { Actions, Transport as TempoTransport } from 'viem/tempo'
import { chain, RPC_URL, TOKEN, type PublicClient } from './chain'
import { toRefusal, type Refusal } from './errors'
import { readKeyState } from './keys'

const COPY_REVOKED = 'This key was turned off by the sender.'
const COPY_EXPIRED = 'This key has expired. Ask the sender for a new one.'

/** How a payment's network fee is covered. Sponsored fees keep the relative's budget exact. */
export type FeeSponsor =
  | { kind: 'relay'; url: string }
  | { kind: 'local'; plugins: Parameters<typeof TempoTransport.withRelay>[1] }

export function parentTransport(sponsor: FeeSponsor): Transport {
  const base = http(RPC_URL)
  return sponsor.kind === 'relay'
    ? TempoTransport.withRelay(base, http(sponsor.url), { policy: 'sign-only' })
    : (TempoTransport.withRelay(base, sponsor.plugins as never) as unknown as Transport)
}

export type PayResult =
  | { ok: true; txHash: Hex; blockNumber: bigint }
  | { ok: false; refusal: Refusal }

/**
 * The relative pays one payee. The chain decides: a refusal comes back as `ok: false` with the chain's own words,
 * because the call is simulated by the node before anything is mined, so a refused payment moves no money.
 */
export async function pay(
  keyAccount: ViemAccount,
  sponsor: FeeSponsor,
  to: Address,
  amount: bigint,
  /**
   * When given, a key that is already revoked or expired is refused from its on-chain record at once. Measured on
   * Moderato: simulating a payment with a revoked key takes 5 s directly and about 25 s through the relay before
   * the network answers, so waiting for that answer would leave the relative staring at a spinner.
   */
  precheck?: { pub: PublicClient; sender: Address; nowSeconds?: number },
): Promise<PayResult> {
  if (precheck) {
    try {
      const s = await readKeyState(precheck.pub, precheck.sender, (keyAccount as unknown as { accessKeyAddress: Address }).accessKeyAddress)
      const now = precheck.nowSeconds ?? Math.floor(Date.now() / 1000)
      if (s.status === 'revoked') {
        return { ok: false, refusal: { code: 'KeyAlreadyRevoked', title: COPY_REVOKED, raw: 'KeyAlreadyRevoked: this key is marked revoked in the network\'s key record.' } }
      }
      if (s.status === 'active' && s.expiry <= now) {
        return { ok: false, refusal: { code: 'KeyExpired', title: COPY_EXPIRED, raw: 'KeyExpired: this key is past its expiry in the network\'s key record.' } }
      }
    } catch {
      // The record could not be read right now. Fall through and let the network decide.
    }
  }
  const client = createClient({ account: keyAccount, chain, transport: parentTransport(sponsor) }).extend(publicActions)
  let last: Refusal | null = null
  // A timed-out transaction never moved money, so building a fresh one is safe. Every other refusal is final.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { receipt } = await Actions.token.transferSync(client as never, { token: TOKEN, to, amount, feePayer: true } as never)
      return { ok: true, txHash: receipt.transactionHash, blockNumber: receipt.blockNumber }
    } catch (error) {
      last = toRefusal(error)
      if (last.code !== 'TransactionExpired') break
    }
  }
  return { ok: false, refusal: last! }
}
