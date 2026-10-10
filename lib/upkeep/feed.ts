import { decodeEventLog, getAbiItem, parseAbiItem, type Address, type Hex, type Log } from 'viem'
import { Abis } from 'viem/tempo'
import { FEE_MANAGER, KEYCHAIN, TOKEN, chunkedLogs, type PublicClient } from './chain'

const spendEvent = getAbiItem({ abi: Abis.accountKeychain, name: 'AccessKeySpend' })
const transferEvent = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)')

export type FeedItem = {
  txHash: Hex
  blockNumber: bigint | null
  /** The access key that signed. The UI maps it to a relative's name. */
  keyId: Address
  /** Where the money went (a payee address, possibly a virtual address). */
  to: Address
  amount: bigint
  /** Network fee taken in the same transaction (0n when sponsored). */
  fee: bigint
  /** The key's remaining budget after this transaction, from the chain event. */
  remaining: bigint
}

type RawLog = Pick<Log, 'address' | 'topics' | 'data' | 'transactionHash' | 'blockNumber' | 'logIndex'>

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

/** Pure: turn a log list ordered by block and log index into payments for one sender account (and optionally one key). */
export function decodeFeed(logs: readonly RawLog[], account: Address, keyId?: Address): FeedItem[] {
  const byTx = new Map<string, RawLog[]>()
  for (const l of logs) {
    if (!l.transactionHash) continue
    const arr = byTx.get(l.transactionHash) ?? []
    arr.push(l)
    byTx.set(l.transactionHash, arr)
  }
  const items: FeedItem[] = []
  for (const [txHash, txLogs] of byTx) {
    const spends: { keyId: Address; amount: bigint; remaining: bigint }[] = []
    const transfers: { to: Address; value: bigint }[] = []
    for (const l of txLogs) {
      if (same(l.address, KEYCHAIN)) {
        try {
          const d = decodeEventLog({ abi: [spendEvent], data: l.data, topics: l.topics as [Hex, ...Hex[]] })
          const a = d.args as unknown as { account: Address; publicKey: Address; token: Address; amount: bigint; remainingLimit: bigint }
          if (same(a.account, account) && same(a.token, TOKEN) && (!keyId || same(a.publicKey, keyId))) {
            spends.push({ keyId: a.publicKey, amount: a.amount, remaining: a.remainingLimit })
          }
        } catch {
          // not a spend event
        }
      } else if (same(l.address, TOKEN)) {
        try {
          const d = decodeEventLog({ abi: [transferEvent], data: l.data, topics: l.topics as [Hex, ...Hex[]] })
          const a = d.args as unknown as { from: Address; to: Address; value: bigint }
          if (same(a.from, account)) transfers.push({ to: a.to, value: a.value })
        } catch {
          // not a transfer
        }
      }
    }
    if (spends.length === 0) continue
    const payment = transfers.find((t) => !same(t.to, FEE_MANAGER))
    if (!payment) continue
    const fee = transfers.filter((t) => same(t.to, FEE_MANAGER)).reduce((s, t) => s + t.value, 0n)
    const last = spends[spends.length - 1]
    items.push({
      txHash: txHash as Hex,
      blockNumber: txLogs[0].blockNumber ?? null,
      keyId: last.keyId,
      to: payment.to,
      amount: payment.value,
      fee,
      remaining: last.remaining,
    })
  }
  return items
}

/** Live: read spend and transfer logs for one sender account from the chain. */
export async function fetchFeed(client: PublicClient, account: Address, opts: { keyId?: Address; fromBlock: bigint }): Promise<FeedItem[]> {
  const head = await client.getBlockNumber()
  const [spendLogs, transferLogs] = await Promise.all([
    chunkedLogs(opts.fromBlock, head, (a, b) =>
      client.getLogs({ address: KEYCHAIN, event: spendEvent as never, args: { account } as never, fromBlock: a, toBlock: b }),
    ),
    chunkedLogs(opts.fromBlock, head, (a, b) =>
      client.getLogs({ address: TOKEN, event: transferEvent, args: { from: account }, fromBlock: a, toBlock: b }),
    ),
  ])
  const all = [...spendLogs, ...transferLogs].sort((a, b) =>
    a.blockNumber === b.blockNumber ? (a.logIndex ?? 0) - (b.logIndex ?? 0) : Number((a.blockNumber ?? 0n) - (b.blockNumber ?? 0n)),
  )
  return decodeFeed(all as RawLog[], account, opts.keyId)
}
