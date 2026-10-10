import { getAddress, type Account as ViemAccount, type Address, type Chain, type Client, type Transport } from 'viem'
import { Abis, Account, Actions } from 'viem/tempo'
import { KEYCHAIN, TOKEN, type PublicClient } from './chain'

/** A viem client that signs as the sender's root account. */
export type RootClient = Client<Transport, Chain, ViemAccount>

/** What a key looks like to the person who must approve it: just an address and a signature type. No secret. */
export type KeyRef = { address: Address; type: 'p256' | 'secp256k1' | 'webAuthn' }

export type KeyPolicy = {
  /** Monthly (or test-month) budget in token base units. */
  limit: bigint
  /** Renewal interval in seconds. 0 means a one-time budget that never renews. */
  periodSeconds: number
  /** Addresses the key may pay. Required: an unscoped key would be able to pay anyone. */
  payees: readonly Address[]
  /** Unix seconds when the key expires. */
  expiry: number
}

const TRANSFER_SELECTOR = 'transfer(address,uint256)'
const TRANSFER_SELECTOR_ID = '0xa9059cbb'

export class PolicyError extends Error {}

export function assertPolicy(p: KeyPolicy, nowSeconds: number = Math.floor(Date.now() / 1000)): void {
  if (p.limit <= 0n) throw new PolicyError('The budget must be more than zero.')
  if (!Number.isInteger(p.periodSeconds) || p.periodSeconds < 0) throw new PolicyError('Invalid renewal period.')
  if (p.payees.length === 0) throw new PolicyError('Choose at least one payee. A key with no payee list could pay anyone.')
  if (p.expiry <= nowSeconds) throw new PolicyError('The expiry is in the past.')
}

/** The sender's root account approves a relative's key. Only the key's address and type are needed. */
export async function authorizeKey(
  rootClient: RootClient,
  key: KeyRef,
  policy: KeyPolicy,
) {
  assertPolicy(policy)
  return Actions.accessKey.authorizeSync(rootClient, {
    accessKey: { address: getAddress(key.address), type: key.type },
    expiry: policy.expiry,
    limits: [{ token: TOKEN, limit: policy.limit, period: policy.periodSeconds }],
    scopes: [{ address: TOKEN, selector: TRANSFER_SELECTOR, recipients: [...policy.payees] }],
  })
}

export async function revokeKey(rootClient: RootClient, key: KeyRef) {
  return Actions.accessKey.revokeSync(rootClient, { accessKey: getAddress(key.address) })
}

export type KeyState = {
  keyId: Address
  revoked: boolean
  expiry: number
  /** Budget left in this period, straight from the chain. */
  remaining: bigint
  /** When the budget refills (unix seconds), or null for a one-time budget. */
  periodEnd: number | null
  /** Payees this key may pay, straight from the keychain precompile. */
  payees: Address[]
  /** True when the key is limited to listed calls; false means unscoped (should never happen for Upkeep keys). */
  scoped: boolean
}

/** Everything the parent screen and the sender console show about a key. Nothing is cached; every field is a chain read. */
export async function readKeyState(client: PublicClient, accountIn: Address, keyIdIn: Address): Promise<KeyState> {
  // viem encodes addresses strictly, so normalise lower-case ids (accessKeyAddress is lower-case) to checksum form
  const account = getAddress(accountIn)
  const keyId = getAddress(keyIdIn)
  const arg = { account, accessKey: keyId }
  const [meta, lim, calls] = await Promise.all([
    Actions.accessKey.getMetadata(client as never, arg as never),
    Actions.accessKey.getRemainingLimit(client as never, { ...arg, token: TOKEN } as never),
    client.readContract({ address: KEYCHAIN, abi: Abis.accountKeychain, functionName: 'getAllowedCalls', args: [account, keyId] }),
  ])
  const [scoped, scopes] = calls as unknown as readonly [boolean, readonly { target: Address; selectorRules: readonly { selector: string; recipients: readonly Address[] }[] }[]]
  const payees = scopes
    .filter((s) => s.target.toLowerCase() === TOKEN.toLowerCase())
    .flatMap((s) => s.selectorRules.filter((r) => r.selector.toLowerCase() === TRANSFER_SELECTOR_ID).flatMap((r) => [...r.recipients]))
  const m = meta as unknown as { isRevoked: boolean; expiry: bigint | number | string }
  const l = lim as unknown as { remaining: bigint; periodEnd?: bigint | number }
  return {
    keyId,
    revoked: m.isRevoked,
    expiry: Number(m.expiry),
    remaining: l.remaining,
    periodEnd: l.periodEnd === undefined || Number(l.periodEnd) === 0 ? null : Number(l.periodEnd),
    payees,
    scoped,
  }
}

/** A viem access-key account for the relative, bound to the sender's address. The private half never leaves this call. */
export function accessKeyAccount(keyPair: Parameters<typeof Account.fromWebCryptoP256>[0], sender: Address) {
  return Account.fromWebCryptoP256(keyPair, { access: sender })
}
