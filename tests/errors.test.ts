import { describe, expect, it } from 'vitest'
import { toRefusal } from '../lib/upkeep/errors'

// Strings below are the chain's real answers captured from Moderato on 2026-10-10 (see DECISIONS.md).
const real = {
  limit: 'The contract function "transfer" reverted with the following signature: | execution reverted: Account keychain error: SpendingLimitExceeded(SpendingLimitExceeded)',
  scope: 'The contract function "transfer" reverted with the following signature: | execution reverted: Account keychain error: CallNotAllowed(CallNotAllowed)',
  revoked: 'The contract function "transfer" reverted with the following reason: | Revm error: keychain validation failed: AccountKeychainError(KeyAlreadyRevoked(KeyAlreadyRevoked))',
}

describe('toRefusal', () => {
  it('names each real refusal and keeps the raw text', () => {
    expect(toRefusal(new Error(real.limit))).toMatchObject({ code: 'SpendingLimitExceeded' })
    expect(toRefusal(new Error(real.scope))).toMatchObject({ code: 'CallNotAllowed' })
    expect(toRefusal(new Error(real.revoked))).toMatchObject({ code: 'KeyAlreadyRevoked' })
    expect(toRefusal(new Error(real.scope)).raw).toContain('CallNotAllowed')
  })
  it('walks nested causes like viem errors', () => {
    const inner = Object.assign(new Error('x'), { details: real.limit })
    const outer = Object.assign(new Error('outer'), { shortMessage: 'ContractFunctionExecutionError', cause: inner })
    expect(toRefusal(outer).code).toBe('SpendingLimitExceeded')
  })
  it('does not invent a reason for unknown errors', () => {
    const r = toRefusal(new Error('network unreachable'))
    expect(r.code).toBe('Unknown')
    expect(r.raw).toContain('network unreachable')
  })
})
