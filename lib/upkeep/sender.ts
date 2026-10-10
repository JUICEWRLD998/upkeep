'use client'
import { createClient, http, publicActions, type Address } from 'viem'
import { Account, Actions, WebAuthnP256 } from 'viem/tempo'
import { chain, RPC_URL, TOKEN, type PublicClient } from './chain'
import type { RootClient } from './keys'

/**
 * The sender's root account is a passkey (WebAuthn P256). The private key stays in the device's authenticator; we keep
 * only the credential id and public key, which are not secret, so the account can be rebuilt on the next visit.
 */
const STORAGE_KEY = 'upkeep:sender'

type Saved = { id: string; publicKey: `0x${string}`; label: string }

export function loadSavedSender(): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Saved) : null
  } catch {
    return null
  }
}

export async function createSender(label: string) {
  const credential = await WebAuthnP256.createCredential({ label })
  const saved: Saved = { id: credential.id, publicKey: credential.publicKey, label }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
  return accountFrom(saved)
}

export function restoreSender() {
  const saved = loadSavedSender()
  return saved ? accountFrom(saved) : null
}

function accountFrom(saved: Saved) {
  const account = Account.fromWebAuthnP256({ id: saved.id, publicKey: saved.publicKey })
  return { account, address: account.address as Address, label: saved.label }
}

export function senderClient(account: ReturnType<typeof accountFrom>['account']): RootClient {
  return createClient({ account, chain, transport: http(RPC_URL) }).extend(publicActions) as unknown as RootClient
}

/** Testnet dollars from the public faucet, so a new sender can try the product with no money. */
export async function addTestDollars(client: PublicClient, address: Address) {
  return Actions.faucet.fundSync(client as never, { account: address })
}

export async function senderBalance(client: PublicClient, address: Address): Promise<bigint> {
  const b = await Actions.token.getBalance(client as never, { account: address, token: TOKEN })
  return (b as unknown as { amount: bigint }).amount
}
