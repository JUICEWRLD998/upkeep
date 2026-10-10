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

export type Relative = { nonce: string; name: string; invitedAt: number; keyId?: Address }
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
