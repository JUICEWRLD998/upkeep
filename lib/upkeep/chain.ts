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

export const explorerTx = (hash: string) => `${EXPLORER_URL}/tx/${hash}`
export const explorerAddress = (address: string) => `${EXPLORER_URL}/address/${address}`
