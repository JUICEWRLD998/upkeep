import { publicClient } from '@/lib/upkeep/chain'
import { fetchDeskPayments } from '@/lib/upkeep/desk'
import { DeskNotReady, currentRate, deskConfig } from '@/lib/upkeep/deskServer'
import { payeesByIds } from '@/lib/upkeep/db'
import { koboFor } from '@/lib/upkeep/rate'
import { overLimit } from '@/lib/upkeep/relay'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Blocks to look back. Moderato produces blocks quickly, so this covers the recent past without a huge scan. */
const LOOKBACK = 200_000n

export async function GET(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
  if (overLimit(`ledger:${ip}`, 60)) return Response.json({ error: 'Too many requests. Try again in a minute.' }, { status: 429 })
  try {
    const { masterId, master } = deskConfig()
    const pub = publicClient()
    const head = await pub.getBlockNumber()
    const from = head > LOOKBACK ? head - LOOKBACK : 0n
    const payments = await fetchDeskPayments(pub, master, masterId, from)
    const ids = [...new Set(payments.map((p) => parseInt(p.userTag, 16)))].filter((n) => Number.isSafeInteger(n) && n > 0)
    const [payees, rate] = await Promise.all([payeesByIds(ids), currentRate()])
    const byId = new Map(payees.map((p) => [p.id, p]))
    const rows = payments
      .map((p) => {
        const payee = byId.get(parseInt(p.userTag, 16))
        return {
          txHash: p.txHash,
          blockNumber: p.blockNumber?.toString() ?? null,
          from: p.from,
          amount: p.amount.toString(),
          // A payment to a desk address with no registry row (should not happen) is shown unlabelled, never guessed.
          payee: payee ? { label: payee.label, bank: payee.bank, accountName: payee.accountName, last4: payee.last4 } : null,
          nairaKobo: rate ? koboFor(p.amount, rate.ngnPerUsd).toString() : null,
        }
      })
      .sort((a, b) => Number(BigInt(b.blockNumber ?? 0) - BigInt(a.blockNumber ?? 0)))
    return Response.json({ rows, rate, fromBlock: from.toString(), headBlock: head.toString() })
  } catch (e) {
    if (e instanceof DeskNotReady) return Response.json({ error: e.message }, { status: 503 })
    console.error('desk ledger failed:', e instanceof Error ? `${e.name}: ${e.message}`.slice(0, 600) : e)
    return Response.json({ error: 'The payout desk ledger could not be read.' }, { status: 500 })
  }
}
