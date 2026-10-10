import { describe, expect, it } from 'vitest'
import { decodeFeed } from '../lib/upkeep/feed'

// Real logs from Moderato tx 0x968d1d6d8c187703aac571b7cb90b50bc2999cff011063be56a881986c6ee6a8 (2026-10-10).
const KEYCHAIN = '0xaaaaaaaa00000000000000000000000000000000'
const TOKEN = '0x20c0000000000000000000000000000000000001'
const SPEND = '0xe0815e3aaadddf4dd75bde97fc060f0c38afe18e87a169be86a3f5c28247f192'
const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
const ACCOUNT = '0xa231eee840a316116fec11cca47c2059ca7d6793'
const KEY = '0xab9574c02f00101506af242e4ec156963273d201'
const PAYEE = '0x99a0d56c4c031c9e19b9bfaf2bb656e0b95e1882'
const pad = (a: string) => '0x' + a.slice(2).padStart(64, '0')
const word = (n: number) => n.toString(16).padStart(64, '0')
const tx = '0x968d1d6d8c187703aac571b7cb90b50bc2999cff011063be56a881986c6ee6a8'
const base = { transactionHash: tx, blockNumber: 100n }

const logs = [
  { ...base, logIndex: 0, address: KEYCHAIN, topics: [SPEND, pad(ACCOUNT), pad(KEY), pad(TOKEN)], data: '0x' + word(0xc1) + word(0x9895bf) },
  { ...base, logIndex: 1, address: KEYCHAIN, topics: [SPEND, pad(ACCOUNT), pad(KEY), pad(TOKEN)], data: '0x' + word(0x3d0900) + word(0x5b8cbf) },
  { ...base, logIndex: 2, address: TOKEN, topics: [TRANSFER, pad(ACCOUNT), pad(PAYEE)], data: '0x' + word(0x3d0900) },
  { ...base, logIndex: 3, address: TOKEN, topics: [TRANSFER, pad(ACCOUNT), pad('0xfeec000000000000000000000000000000000000')], data: '0x' + word(0xb7) },
] as never

describe('decodeFeed', () => {
  it('turns the real spend and transfer logs into one payment with fee and remaining budget', () => {
    const items = decodeFeed(logs, ACCOUNT)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ txHash: tx, amount: 4_000_000n, fee: 183n, remaining: 5_999_807n })
    // viem returns checksummed addresses, so compare case-insensitively
    expect(items[0].keyId.toLowerCase()).toBe(KEY)
    expect(items[0].to.toLowerCase()).toBe(PAYEE)
  })
  it('ignores other accounts and other keys', () => {
    expect(decodeFeed(logs, '0x0000000000000000000000000000000000000001')).toHaveLength(0)
    expect(decodeFeed(logs, ACCOUNT, '0x0000000000000000000000000000000000000002')).toHaveLength(0)
  })
  it('skips transactions with no spend event, because a root-key transfer is not an Upkeep payment', () => {
    const rootOnly = (logs as unknown as unknown[]).slice(2) as never
    expect(decodeFeed(rootOnly, ACCOUNT)).toHaveLength(0)
  })
})
