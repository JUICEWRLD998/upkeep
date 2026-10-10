import { describe, expect, it } from 'vitest'
import { DeskError, deskAddress, decodeDeskPayments, userTagForIndex } from '../lib/upkeep/desk'

// Real logs from Moderato tx 0xbdc5ccbb68ff156672799bc00b8609f9625662b6865dd1d68e0822e2c07a9e74 (2026-10-10).
const TOKEN = '0x20c0000000000000000000000000000000000001'
const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
const SENDER = '0x8e601f6f31e1c3f3c202edbc469ad4657acf6165'
const VIRTUAL = '0x374de0d9fdfdfdfdfdfdfdfdfdfd000000000001'
const MASTER = '0xff36218068faa9a5656ecf21eb06d4eeaf4fd35d'
const pad = (a: string) => '0x' + a.slice(2).padStart(64, '0')
const tx = '0xbdc5ccbb68ff156672799bc00b8609f9625662b6865dd1d68e0822e2c07a9e74'
const three = '0x' + (0x2dc6c0).toString(16).padStart(64, '0')
const logs = [
  { address: TOKEN, topics: [TRANSFER, pad(SENDER), pad(VIRTUAL)], data: three, transactionHash: tx, blockNumber: 7n },
  { address: TOKEN, topics: [TRANSFER, pad(VIRTUAL), pad(MASTER)], data: three, transactionHash: tx, blockNumber: 7n },
] as never

describe('desk', () => {
  it('derives the same virtual address the chain forwarded for', () => {
    expect(deskAddress('0x374de0d9', userTagForIndex(1)).toLowerCase()).toBe(VIRTUAL)
  })
  it('finds the payment into the payee address, and only that one', () => {
    const rows = decodeDeskPayments(logs, '0x374de0d9')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ txHash: tx, userTag: '0x000000000001', amount: 3_000_000n })
    expect(rows[0].from.toLowerCase()).toBe(SENDER)
  })
  it('ignores another desk master id', () => {
    expect(decodeDeskPayments(logs, '0xdeadbeef')).toHaveLength(0)
  })
  it('rejects out-of-range payee indexes', () => {
    expect(() => userTagForIndex(-1)).toThrow(DeskError)
    expect(() => userTagForIndex(2 ** 48)).toThrow(DeskError)
  })
})
