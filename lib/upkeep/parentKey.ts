'use client'
import type { Address } from 'viem'
import { Account, WebCryptoP256 } from 'viem/tempo'
import { accessKeyAccount } from './keys'

/**
 * The relative's key lives only on her device: a non-extractable WebCrypto P256 key stored in IndexedDB. The page can
 * use it to sign but can never read the private bytes, and the sender only ever receives the key's address.
 */
const DB = 'upkeep'
const STORE = 'parent-keys'

type Stored = {
  id: string
  privateKey: CryptoKey
  publicKey: unknown
  /** Set once the sender's address is known, i.e. after the invite is opened. */
  sender: Address
  name: string
  createdAt: number
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

/** Make a new key for one invite and keep it on this device. `id` is the invite nonce. */
export async function createParentKey(id: string, sender: Address, name: string) {
  const keyPair = await WebCryptoP256.createKeyPair()
  const record: Stored = { id, privateKey: keyPair.privateKey, publicKey: keyPair.publicKey, sender, name, createdAt: Date.now() }
  await tx('readwrite', (s) => s.put(record))
  return describe(record)
}

export async function loadParentKey(id: string) {
  const rec = await tx<Stored | undefined>('readonly', (s) => s.get(id) as IDBRequest<Stored | undefined>)
  return rec ? describe(rec) : null
}

export async function listParentKeys() {
  const all = await tx<Stored[]>('readonly', (s) => s.getAll() as IDBRequest<Stored[]>)
  return all.sort((a, b) => b.createdAt - a.createdAt).map(describe)
}

export async function forgetParentKey(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id))
}

function describe(rec: Stored) {
  const account = accessKeyAccount({ privateKey: rec.privateKey, publicKey: rec.publicKey } as never, rec.sender)
  return { id: rec.id, sender: rec.sender, name: rec.name, account, keyId: account.accessKeyAddress as Address }
}

// Re-exported so pages need only this module for the relative's side.
export { Account }
