'use client'
import type { Address } from 'viem'

/** Small, typed browser storage for labels and bookmarks. Chain data is never stored here; only human names. */
function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage unavailable (private mode): the app still works from the chain, only names are lost
  }
}

export type Relative = { nonce: string; name: string; invitedAt: number; keyId?: Address; /** The limit the sender set, in token base units. A display hint for the envelope level; the dollars left always come from the network. */ limit?: string }
export type PayeeLabel = { address: Address; label: string }

export const relatives = {
  all: () => read<Relative[]>('upkeep:relatives', []),
  save: (list: Relative[]) => write('upkeep:relatives', list),
  upsert(r: Relative) {
    const list = relatives.all().filter((x) => x.nonce !== r.nonce)
    relatives.save([r, ...list])
  },
}

/** First block seen for this sender, so the feed never scans from genesis. */
export const since = {
  get: () => read<string | null>('upkeep:since', null),
  set: (block: bigint) => write('upkeep:since', block.toString()),
}

/** Labels the sender typed for payees. Display hints only; the chain holds the real payee list. */
export const payeeLabels = {
  all: () => read<PayeeLabel[]>('upkeep:payees', []),
  merge(items: PayeeLabel[]) {
    const map = new Map(payeeLabels.all().map((p) => [p.address.toLowerCase(), p]))
    for (const p of items) map.set(p.address.toLowerCase(), p)
    write('upkeep:payees', [...map.values()])
  },
}

/**
 * The relative's copy of the limit hint, from the ready link. It only sizes the envelope level; the amount left is
 * read from the network. When no hint exists the level falls back to the largest amount seen this visit.
 */
export const limitHint = {
  get: (nonce: string) => read<string | null>(`upkeep:limit:${nonce}`, null),
  set: (nonce: string, units: string) => write(`upkeep:limit:${nonce}`, units),
}
