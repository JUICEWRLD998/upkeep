import { decodeEventLog, parseAbiItem, type Address, type Hex, type Log } from 'viem'
import { VirtualAddress } from 'viem/tempo'
import { TOKEN, chunkedLogs, type PublicClient } from './chain'

/**
 * The payout desk gives each payee (pharmacy, school, Mummy's bank account) its own deposit address derived from one
 * registered master. Money sent to that address forwards to the master on chain; the desk then owes the payee naira.
 * The naira leg is SIMULATED in this product and labelled so wherever it appears.
 */
const transferEvent = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)')

export class DeskError extends Error {}

/** 6-byte user tag for the nth payee. Counter-based so tags never collide inside one desk. */
export function userTagForIndex(n: number): Hex {
  if (!Number.isInteger(n) || n < 0 || n >= 2 ** 48) throw new DeskError('Payee index out of range.')
  return `0x${n.toString(16).padStart(12, '0')}` as Hex
}

export function deskAddress(masterId: Hex, userTag: Hex): Address {
  return VirtualAddress.from({ masterId, userTag })
}

export type DeskPayment = {
  txHash: Hex
  blockNumber: bigint | null
  /** The account that paid the payee's deposit address. */
  from: Address
  userTag: Hex
  amount: bigint
}

type RawLog = Pick<Log, 'address' | 'topics' | 'data' | 'transactionHash' | 'blockNumber'>

/** Pure: find payments into this desk's virtual addresses inside the given logs. */
export function decodeDeskPayments(logs: readonly RawLog[], masterId: Hex): DeskPayment[] {
  const out: DeskPayment[] = []
  for (const l of logs) {
    if (l.address.toLowerCase() !== TOKEN.toLowerCase() || !l.transactionHash) continue
    let args: { from: Address; to: Address; value: bigint }
    try {
      args = decodeEventLog({ abi: [transferEvent], data: l.data, topics: l.topics as [Hex, ...Hex[]] }).args as never
    } catch {
      continue
    }
    if (!VirtualAddress.validate(args.to)) continue
    const parsed = VirtualAddress.parse(args.to)
    if (parsed.masterId.toLowerCase() !== masterId.toLowerCase()) continue
    out.push({ txHash: l.transactionHash, blockNumber: l.blockNumber ?? null, from: args.from, userTag: parsed.userTag, amount: args.value })
  }
  return out
}

/** Live: payments the desk received, found through the forwarding transfers into the master account. */
export async function fetchDeskPayments(client: PublicClient, master: Address, masterId: Hex, fromBlock: bigint): Promise<DeskPayment[]> {
  const head = await client.getBlockNumber()
  const forwards = await chunkedLogs(fromBlock, head, (a, b) =>
    client.getLogs({ address: TOKEN, event: transferEvent, args: { to: master }, fromBlock: a, toBlock: b }),
  )
  const hashes = [...new Set(forwards.map((l) => l.transactionHash).filter((h): h is Hex => !!h))]
  const receipts = await Promise.all(hashes.map((h) => client.getTransactionReceipt({ hash: h })))
  return receipts.flatMap((r) => decodeDeskPayments(r.logs as RawLog[], masterId))
}
