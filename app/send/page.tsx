'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Address } from 'viem'
import { explorerAddress, explorerTx, publicClient } from '@/lib/upkeep/chain'
import { formatAmount } from '@/lib/upkeep/amounts'
import { fetchFeed, type FeedItem } from '@/lib/upkeep/feed'
import { readKeyState, revokeKey, type KeyState } from '@/lib/upkeep/keys'
import { LinkError, cleanName, encodeInvite, newNonce } from '@/lib/upkeep/links'
import { untilText } from '@/lib/upkeep/period'
import { addTestDollars, createSender, restoreSender, senderBalance, senderClient } from '@/lib/upkeep/sender'
import { payeeLabels, relatives, since, type Relative } from '@/lib/upkeep/store'

type Sender = NonNullable<ReturnType<typeof restoreSender>>

export default function Send() {
  const router = useRouter()
  const pub = useMemo(() => publicClient(), [])
  const [sender, setSender] = useState<Sender | null>(null)
  const [ready, setReady] = useState(false)
  const [balance, setBalance] = useState<bigint | null>(null)
  const [list, setList] = useState<Relative[]>([])
  const [states, setStates] = useState<Record<string, KeyState | 'pending'>>({})
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [name, setName] = useState('')
  const [invite, setInvite] = useState('')
  const [pasted, setPasted] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    // Browser-only storage cannot be read during server render, so load it right after mount.
    const t = setTimeout(() => {
      setSender(restoreSender())
      setList(relatives.all())
      setReady(true)
    }, 0)
    return () => clearTimeout(t)
  }, [])

  const refresh = useCallback(async () => {
    if (!sender) return
    const addr = sender.address
    try {
      setBalance(await senderBalance(pub, addr))
    } catch {
      // keep the last balance; the next poll retries
    }
    const rel = relatives.all()
    setList(rel)
    const next: Record<string, KeyState | 'pending'> = {}
    await Promise.all(
      rel.map(async (r) => {
        if (!r.keyId) return
        try {
          next[r.nonce] = await readKeyState(pub, addr, r.keyId)
        } catch {
          next[r.nonce] = 'pending'
        }
      }),
    )
    setStates(next)
    const from = since.get()
    if (from) {
      try {
        setFeed((await fetchFeed(pub, addr, { fromBlock: BigInt(from) })).reverse())
      } catch {
        // transient RPC error; the next poll retries
      }
    }
    setNow(Date.now())
  }, [sender, pub])

  useEffect(() => {
    if (!sender) return
    const first = setTimeout(refresh, 0)
    const t = setInterval(refresh, 2000)
    return () => {
      clearTimeout(first)
      clearInterval(t)
    }
  }, [sender, refresh])

  async function create() {
    setBusy(true)
    setMsg('')
    try {
      const block = await pub.getBlockNumber()
      const s = await createSender('Upkeep sender')
      since.set(block)
      setSender(s)
    } catch (e) {
      setMsg(`Could not create the passkey account: ${(e as Error).message}`.slice(0, 300))
    } finally {
      setBusy(false)
    }
  }

  async function faucet() {
    if (!sender) return
    setBusy(true)
    setMsg('')
    try {
      await addTestDollars(pub, sender.address)
      setMsg('Test dollars added.')
      refresh()
    } catch (e) {
      setMsg(`The test faucet said no: ${(e as { shortMessage?: string }).shortMessage ?? (e as Error).message}`.slice(0, 300))
    } finally {
      setBusy(false)
    }
  }

  function makeInvite() {
    if (!sender) return
    setMsg('')
    try {
      const nonce = newNonce()
      const clean = cleanName(name)
      relatives.upsert({ nonce, name: clean, invitedAt: Date.now() })
      setInvite(`${location.origin}/join/${encodeInvite({ sender: sender.address, name: clean, nonce })}`)
      setName('')
      setList(relatives.all())
    } catch (e) {
      setMsg(e instanceof LinkError ? e.message : 'Could not make the invite.')
    }
  }

  function openPasted() {
    const m = pasted.trim().match(/\/approve\/([A-Za-z0-9_-]+)/) ?? pasted.trim().match(/^([A-Za-z0-9_-]{20,})$/)
    if (!m) {
      setMsg('Paste the link your relative sent back.')
      return
    }
    router.push(`/approve/${m[1]}`)
  }

  async function revoke(r: Relative) {
    if (!sender || !r.keyId) return
    setBusy(true)
    setMsg('')
    try {
      await revokeKey(senderClient(sender.account), { address: r.keyId, type: 'p256' })
      setMsg(`${r.name}'s key is turned off.`)
      refresh()
    } catch (e) {
      setMsg(`Could not turn the key off: ${(e as { shortMessage?: string }).shortMessage ?? (e as Error).message}`.slice(0, 300))
    } finally {
      setBusy(false)
    }
  }

  const nameOf = (keyId: Address) => list.find((r) => r.keyId?.toLowerCase() === keyId.toLowerCase())?.name ?? 'A key'
  const labelOf = (a: Address) => payeeLabels.all().find((l) => l.address.toLowerCase() === a.toLowerCase())?.label ?? `${a.slice(0, 6)}...${a.slice(-4)}`

  if (!ready)
    return (
      <main>
        <p>Loading...</p>
      </main>
    )

  if (!sender)
    return (
      <main>
        <h1>Upkeep</h1>
        <p>Keep your dollars. Give your family a key.</p>
        <button disabled={busy} onClick={create}>
          {busy ? 'Waiting for your passkey...' : 'Create my account with a passkey'}
        </button>
        {msg && <p role="alert">{msg}</p>}
      </main>
    )

  return (
    <main>
      <h1>Your upkeep</h1>
      <p>
        Account{' '}
        <a href={explorerAddress(sender.address)} target="_blank" rel="noreferrer">
          <code>{sender.address}</code>
        </a>
      </p>
      <p>
        Balance: <strong data-testid="balance">{balance === null ? '...' : `$${formatAmount(balance)}`}</strong>{' '}
        <button disabled={busy} onClick={faucet}>
          Add test dollars
        </button>
      </p>
      {msg && <p role="status">{msg}</p>}

      <h2>Give someone a key</h2>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (Mummy)" aria-label="Relative name" />{' '}
      <button disabled={!name.trim()} onClick={makeInvite}>
        Make invite link
      </button>
      {invite && (
        <>
          <p>Send this link to them. Their key is made on their phone.</p>
          <textarea readOnly value={invite} rows={4} style={{ width: '100%' }} aria-label="Invite link" />
        </>
      )}

      <h2>They sent a link back?</h2>
      <input value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="Paste their link" aria-label="Link from your relative" size={44} />{' '}
      <button onClick={openPasted}>Review key</button>

      <h2>Keys</h2>
      {list.length === 0 && <p>No keys yet.</p>}
      <ul>
        {list.map((r) => {
          const s = states[r.nonce]
          return (
            <li key={r.nonce}>
              <strong>{r.name}</strong>:{' '}
              {!r.keyId ? (
                'invited, waiting for their link'
              ) : s === 'pending' || !s ? (
                'checking...'
              ) : s.revoked ? (
                'turned off'
              ) : (
                <>
                  ${formatAmount(s.remaining)} left, {s.periodEnd ? `refills ${untilText(s.periodEnd, now)}` : 'one-time'}, {s.payees.length} payee
                  {s.payees.length === 1 ? '' : 's'}{' '}
                  <button disabled={busy} onClick={() => revoke(r)}>
                    Turn off
                  </button>
                </>
              )}
            </li>
          )
        })}
      </ul>

      <h2>Live payments</h2>
      {feed.length === 0 && <p>Nothing yet. Payments appear here the moment the network confirms them.</p>}
      <ul>
        {feed.map((f) => (
          <li key={f.txHash}>
            {nameOf(f.keyId)} paid ${formatAmount(f.amount)} to {labelOf(f.to)}; ${formatAmount(f.remaining)} left.{' '}
            <a href={explorerTx(f.txHash)} target="_blank" rel="noreferrer">
              See on the network
            </a>
          </li>
        ))}
      </ul>
    </main>
  )
}
