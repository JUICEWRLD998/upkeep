import { neon } from '@neondatabase/serverless'
import type { PayeeClean } from './payee'
import { MAX_PAYEES_PER_SENDER } from './payee'

/**
 * Server-only. The database holds the payout desk's payee registry (names and bank labels), nothing about balances,
 * limits or payments: those are always read from the network.
 */
type Sql = ReturnType<typeof neon>
let client: Sql | null = null
let ready: Promise<void> | null = null

function sql(): Sql {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  return (client ??= neon(url))
}

export function ensureSchema(): Promise<void> {
  return (ready ??= (async () => {
    const q = sql()
    await q`create table if not exists payees (
      id serial primary key,
      sender text not null,
      label text not null,
      bank text not null,
      account_name text not null,
      last4 char(4) not null,
      created_at timestamptz not null default now()
    )`
    await q`create index if not exists payees_sender_idx on payees (sender)`
  })().catch((e) => {
    ready = null
    throw e
  }))
}

export type PayeeRow = { id: number; sender: string; label: string; bank: string; accountName: string; last4: string; createdAt: string }

const row = (r: Record<string, unknown>): PayeeRow => ({
  id: Number(r.id),
  sender: String(r.sender),
  label: String(r.label),
  bank: String(r.bank),
  accountName: String(r.account_name),
  last4: String(r.last4),
  createdAt: new Date(r.created_at as string).toISOString(),
})

export class LimitError extends Error {}

export async function insertPayee(p: PayeeClean): Promise<PayeeRow> {
  await ensureSchema()
  const q = sql()
  const count = (await q`select count(*)::int as n from payees where sender = ${p.sender}`) as { n: number }[]
  if (count[0].n >= MAX_PAYEES_PER_SENDER) throw new LimitError(`A sender can have at most ${MAX_PAYEES_PER_SENDER} desk payees.`)
  const rows = (await q`insert into payees (sender, label, bank, account_name, last4)
    values (${p.sender}, ${p.label}, ${p.bank}, ${p.accountName}, ${p.last4}) returning *`) as Record<string, unknown>[]
  return row(rows[0])
}

export async function listPayees(sender: string): Promise<PayeeRow[]> {
  await ensureSchema()
  const rows = (await sql()`select * from payees where sender = ${sender} order by id`) as Record<string, unknown>[]
  return rows.map(row)
}

export async function payeesByIds(ids: number[]): Promise<PayeeRow[]> {
  if (ids.length === 0) return []
  await ensureSchema()
  const rows = (await sql()`select * from payees where id = any(${ids})`) as Record<string, unknown>[]
  return rows.map(row)
}
