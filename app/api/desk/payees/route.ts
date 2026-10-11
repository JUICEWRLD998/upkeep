import { getAddress, isAddress } from 'viem'
import { deskAddress, userTagForIndex } from '@/lib/upkeep/desk'
import { DeskNotReady, deskConfig } from '@/lib/upkeep/deskServer'
import { LimitError, insertPayee, listPayees, type PayeeRow } from '@/lib/upkeep/db'
import { PayeeError, cleanPayee } from '@/lib/upkeep/payee'
import { overLimit } from '@/lib/upkeep/relay'

export const runtime = 'nodejs'

function view(p: PayeeRow, masterId: `0x${string}`) {
  return {
    id: p.id,
    label: p.label,
    bank: p.bank,
    accountName: p.accountName,
    last4: p.last4,
    // The deposit address is derived, never stored: masterId + a 6-byte tag made from the payee id.
    address: deskAddress(masterId, userTagForIndex(p.id)),
  }
}

const ip = (r: Request) => r.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'

export async function POST(request: Request) {
  if (overLimit(`desk:${ip(request)}`, 20)) return Response.json({ error: 'Too many requests. Try again in a minute.' }, { status: 429 })
  try {
    const { masterId } = deskConfig()
    // A payee is four short fields. Anything bigger is not a payee, so refuse it before parsing.
    const text = await request.text()
    if (text.length > 8_000) return Response.json({ error: 'That request is too large.' }, { status: 413 })
    let body: unknown = null
    try {
      body = JSON.parse(text)
    } catch {
      body = null
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return Response.json({ error: 'Send JSON.' }, { status: 400 })
    const saved = await insertPayee(cleanPayee(body as Record<string, unknown>))
    return Response.json(view(saved, masterId), { status: 201 })
  } catch (e) {
    if (e instanceof PayeeError) return Response.json({ error: e.message }, { status: 400 })
    if (e instanceof LimitError) return Response.json({ error: e.message }, { status: 409 })
    if (e instanceof DeskNotReady) return Response.json({ error: e.message }, { status: 503 })
    return Response.json({ error: 'The payout desk could not save this payee.' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  if (overLimit(`desk:${ip(request)}`, 60)) return Response.json({ error: 'Too many requests. Try again in a minute.' }, { status: 429 })
  try {
    const { masterId } = deskConfig()
    const sender = new URL(request.url).searchParams.get('sender') ?? ''
    if (!isAddress(sender, { strict: false })) return Response.json({ error: 'sender must be an address.' }, { status: 400 })
    const rows = await listPayees(getAddress(sender))
    return Response.json({ payees: rows.map((r) => view(r, masterId)) })
  } catch (e) {
    if (e instanceof DeskNotReady) return Response.json({ error: e.message }, { status: 503 })
    return Response.json({ error: 'The payout desk could not list payees.' }, { status: 500 })
  }
}

