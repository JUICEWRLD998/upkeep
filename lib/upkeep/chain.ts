import { createClient, http, publicActions, type Address } from 'viem'
import { tempoModerato } from 'viem/chains'
import { Addresses } from 'viem/tempo'

/** AlphaUSD on Moderato. Protocol constant, not an app secret. */
export const TOKEN: Address = '0x20c0000000000000000000000000000000000001'
export const KEYCHAIN: Address = Addresses.accountKeychain
export const FEE_MANAGER: Address = Addresses.feeManager

export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.moderato.tempo.xyz'
export const EXPLORER_URL = process.env.NEXT_PUBLIC_EXPLORER_URL || 'https://explore.moderato.tempo.xyz'

export const chain = tempoModerato.extend({ feeToken: TOKEN })

export function publicClient() {
  return createClient({ chain, transport: http(RPC_URL) }).extend(publicActions)
}
export type PublicClient = ReturnType<typeof publicClient>

/** The Moderato RPC rejects eth_getLogs ranges above 100,000 blocks ("query exceeds max block range 100000"). */
export const MAX_LOG_RANGE = 90_000n

/** Inclusive block ranges of at most `step` blocks covering [from, to]. Pure, so it can be tested. */
export function blockRanges(from: bigint, to: bigint, step: bigint = MAX_LOG_RANGE): [bigint, bigint][] {
  const out: [bigint, bigint][] = []
  for (let start = from; start <= to; start += step) {
    const end = start + step - 1n
    out.push([start, end > to ? to : end])
  }
  return out
}

/** Run a log query over [from, to] in RPC-sized pieces, in order, and join the results. */
export async function chunkedLogs<T>(from: bigint, to: bigint, run: (fromBlock: bigint, toBlock: bigint) => Promise<T[]>): Promise<T[]> {
  // One retry per piece: the public RPC occasionally fails a single request, and the pieces run in parallel.
  const once = async (a: bigint, b: bigint) => {
    try {
      return await run(a, b)
    } catch {
      await new Promise((r) => setTimeout(r, 400))
      return run(a, b)
    }
  }
  const parts = await Promise.all(blockRanges(from, to).map(([a, b]) => once(a, b)))
  return parts.flat()
}

export const explorerTx = (hash: string) => `${EXPLORER_URL}/tx/${hash}`
export const explorerAddress = (address: string) => `${EXPLORER_URL}/address/${address}`
