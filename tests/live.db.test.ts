// @live: talks to the real Neon database using DATABASE_URL from .env.local. Uses a throwaway sender and cleans up.
import { loadEnvFile } from 'node:process'
import { generatePrivateKey, privateKeyToAddress } from 'viem/accounts'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

try {
  loadEnvFile('.env.local')
} catch {
  // no file: the test below fails loudly if DATABASE_URL is missing
}

describe('live: payee registry in Neon', () => {
  const sender = privateKeyToAddress(generatePrivateKey()) // already checksummed, as cleanPayee stores it
  let db: typeof import('../lib/upkeep/db')
  let payee: typeof import('../lib/upkeep/payee')

  beforeAll(async () => {
    expect(process.env.DATABASE_URL, 'DATABASE_URL must be set in .env.local').toBeTruthy()
    db = await import('../lib/upkeep/db')
    payee = await import('../lib/upkeep/payee')
  })
  afterAll(async () => {
    await db.deletePayeesFor(sender)
  })

  it('creates the table, inserts payees with increasing ids, and lists them by sender', async () => {
    const a = await db.insertPayee(payee.cleanPayee({ sender, label: 'Mummy', bank: 'GTBank', accountName: 'Ngozi Okafor', last4: '4821' }))
    const b = await db.insertPayee(payee.cleanPayee({ sender, label: 'School', bank: 'Access', accountName: 'Corona School', last4: '1177' }))
    expect(b.id).toBeGreaterThan(a.id)
    const list = await db.listPayees(sender)
    expect(list.map((p) => p.label)).toEqual(['Mummy', 'School'])
    expect(list[0]).toMatchObject({ bank: 'GTBank', last4: '4821' })
    const byIds = await db.payeesByIds([b.id, a.id])
    expect(byIds.map((p) => p.id).sort()).toEqual([a.id, b.id].sort())
  })

  it('stops a sender at 20 payees', async () => {
    const have = (await db.listPayees(sender)).length
    for (let i = have; i < payee.MAX_PAYEES_PER_SENDER; i++) {
      await db.insertPayee(payee.cleanPayee({ sender, label: `P${i}`, bank: 'B', accountName: 'N', last4: '0000' }))
    }
    await expect(db.insertPayee(payee.cleanPayee({ sender, label: 'One too many', bank: 'B', accountName: 'N', last4: '0000' }))).rejects.toBeInstanceOf(db.LimitError)
  })
})
