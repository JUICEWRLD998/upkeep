import { getAddress, isAddress, type Address } from 'viem'

/**
 * A payee at the payout desk: who the money is for, in a Nigerian bank. We keep the bank, the account name and only
 * the last four digits of the account number. The naira credit itself is SIMULATED in this product, so a full
 * account number would be personal data we have no reason to hold.
 */
export type PayeeInput = { sender: string; label: string; bank: string; accountName: string; last4: string }
export type PayeeClean = { sender: Address; label: string; bank: string; accountName: string; last4: string }

export class PayeeError extends Error {}

// Control characters and angle brackets are stripped, not escaped, because these strings are shown as plain text.
function text(v: unknown, field: string, max: number): string {
  if (typeof v !== 'string') throw new PayeeError(`${field} is required.`)
  const s = v.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim()
  if (!s) throw new PayeeError(`${field} is required.`)
  return s.slice(0, max)
}

export function cleanPayee(input: Partial<PayeeInput>): PayeeClean {
  const sender = input.sender
  if (typeof sender !== 'string' || !isAddress(sender, { strict: false })) throw new PayeeError('Sender address is invalid.')
  const last4 = typeof input.last4 === 'string' ? input.last4.trim() : ''
  if (!/^\d{4}$/.test(last4)) throw new PayeeError('Enter the last 4 digits of the account number.')
  return {
    sender: getAddress(sender),
    label: text(input.label, 'Name', 40),
    bank: text(input.bank, 'Bank', 40),
    accountName: text(input.accountName, 'Account name', 60),
    last4,
  }
}

export const MAX_PAYEES_PER_SENDER = 20
