/** Maps keychain and chain errors to plain copy, always keeping the raw code for the "show the chain's answer" UI. */
export type ChainRefusalCode =
  | 'SpendingLimitExceeded'
  | 'CallNotAllowed'
  | 'KeyAlreadyRevoked'
  | 'KeyExpired'
  | 'KeyNotFound'
  | 'InsufficientBalance'
  | 'TransactionExpired'
  | 'Unknown'

export type Refusal = {
  code: ChainRefusalCode
  /** Plain words for the person using the app. */
  title: string
  /** The chain's own text, shown verbatim on the refusal screen. */
  raw: string
}

const COPY: Record<Exclude<ChainRefusalCode, 'Unknown'>, string> = {
  SpendingLimitExceeded: "This is more than your upkeep has left this month.",
  CallNotAllowed: "This key can't pay that account. It only pays the payees the sender approved.",
  KeyAlreadyRevoked: 'This key was turned off by the sender.',
  KeyExpired: 'This key has expired. Ask the sender for a new one.',
  KeyNotFound: "The sender hasn't approved this key yet.",
  InsufficientBalance: "The sender's account doesn't have enough dollars right now.",
  TransactionExpired: 'The network was slow and the payment timed out. Nothing was paid. Try again.',
}

function flatten(error: unknown): string {
  const parts: string[] = []
  let e: unknown = error
  for (let i = 0; i < 6 && e; i++) {
    if (typeof e === 'string') { parts.push(e); break }
    const o = e as { shortMessage?: string; message?: string; details?: string; cause?: unknown }
    if (o.shortMessage) parts.push(o.shortMessage)
    if (o.details) parts.push(o.details)
    if (o.message) parts.push(o.message)
    e = o.cause
  }
  return parts.join(' | ')
}

export function toRefusal(error: unknown): Refusal {
  const raw = flatten(error)
  const order: Exclude<ChainRefusalCode, 'Unknown'>[] = [
    'SpendingLimitExceeded', 'CallNotAllowed', 'KeyAlreadyRevoked', 'KeyExpired', 'KeyNotFound',
  ]
  for (const code of order) {
    if (raw.includes(code)) return { code, title: COPY[code], raw: firstLine(raw) }
  }
  if (/transaction expired/i.test(raw)) {
    return { code: 'TransactionExpired', title: COPY.TransactionExpired, raw: firstLine(raw) }
  }
  if (/insufficient (funds|balance)|InsufficientBalance/i.test(raw)) {
    return { code: 'InsufficientBalance', title: COPY.InsufficientBalance, raw: firstLine(raw) }
  }
  return { code: 'Unknown', title: 'The network could not complete this payment.', raw: firstLine(raw) }
}

/** The chain's words without the noisy tail: first three non-empty lines, one line of text. */
function firstLine(s: string): string {
  return s.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 3).join(' ').slice(0, 400)
}
