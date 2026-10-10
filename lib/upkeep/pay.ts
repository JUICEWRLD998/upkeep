import { createClient, http, publicActions, type Account as ViemAccount, type Address, type Hex, type Transport } from 'viem'
import { Actions, Transport as TempoTransport } from 'viem/tempo'
import { chain, RPC_URL, TOKEN } from './chain'
import { toRefusal, type Refusal } from './errors'

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
): Promise<PayResult> {
  const client = createClient({ account: keyAccount, chain, transport: parentTransport(sponsor) }).extend(publicActions)
  try {
    const { receipt } = await Actions.token.transferSync(client as never, { token: TOKEN, to, amount, feePayer: true } as never)
    return { ok: true, txHash: receipt.transactionHash, blockNumber: receipt.blockNumber }
  } catch (error) {
    return { ok: false, refusal: toRefusal(error) }
  }
}
