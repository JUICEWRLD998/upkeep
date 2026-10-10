// @live: reads a real desk payment made on Moderato on 2026-10-10 (tx 0xbdc5ccbb...). Needs only a public RPC.
import { describe, expect, it } from 'vitest'
import { publicClient } from '../lib/upkeep/chain'
import { fetchDeskPayments } from '../lib/upkeep/desk'

const MASTER = '0xFf36218068Faa9A5656ecF21Eb06D4eEaf4Fd35d'
const MASTER_ID = '0x374de0d9'
const TX = '0xbdc5ccbb68ff156672799bc00b8609f9625662b6865dd1d68e0822e2c07a9e74'

describe('live: desk ledger decoding on the real chain', () => {
  it('finds the earlier $3 payment into the payee address within the ledger lookback window', async () => {
    const pub = publicClient()
    const head = await pub.getBlockNumber()
    const rows = await fetchDeskPayments(pub, MASTER, MASTER_ID, head > 200_000n ? head - 200_000n : 0n)
    const hit = rows.find((r) => r.txHash.toLowerCase() === TX)
    expect(hit, `payment ${TX} not found in ${rows.length} rows`).toBeTruthy()
    expect(hit).toMatchObject({ amount: 3_000_000n, userTag: '0x000000000001' })
  })
})
