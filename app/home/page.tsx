'use client'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { getAddress, isAddress, type Address } from 'viem'
import { explorerTx, publicClient } from '@/lib/upkeep/chain'
import { AmountError, formatAmount, parseAmount } from '@/lib/upkeep/amounts'
import { readKeyState, type KeyState } from '@/lib/upkeep/keys'
import { decodePayeeHint } from '@/lib/upkeep/links'
import { pay, type PayResult } from '@/lib/upkeep/pay'
import { untilText } from '@/lib/upkeep/period'
import { loadParentKey } from '@/lib/upkeep/parentKey'
import { payeeLabels } from '@/lib/upkeep/store'

type Parent = NonNullable<Awaited<ReturnType<typeof loadParentKey>>>
type Attempt = { at: number; to: Address; amount: bigint; result: PayResult }

function Home() {
  const params = useSearchParams()
  const nonce = params.get('k')
  const hint = params.get('p')
  const [parent, setParent] = useState<Parent | null>(null)
  const [missing, setMissing] = useState(false)
  const [state, setState] = useState<KeyState | null>(null)
  const [waiting, setWaiting] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [payee, setPayee] = useState('')
  const [amount, setAmount] = useState('')
  const [other, setOther] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const pub = useMemo(() => publicClient(), [])

  useEffect(() => {
    if (hint) payeeLabels.merge(decodePayeeHint(hint))
  }, [hint])

  useEffect(() => {
    // Resolve in a callback so the page renders first and never sets state synchronously in the effect body.
    const run = nonce ? loadParentKey(nonce) : Promise.resolve(null)
    run.then((p) => (p ? setParent(p) : setMissing(true)))
  }, [nonce])

  const refresh = useCallback(async () => {
    if (!parent) return
    try {
      setState(await readKeyState(pub, parent.sender, parent.keyId))
      setWaiting(false)
    } catch {
      setState(null)
      setWaiting(true) // the key is not on the network until the sender approves it
    }
    setNow(Date.now())
  }, [parent, pub])

  useEffect(() => {
    if (!parent) return
    const first = setTimeout(refresh, 0)
    const t = setInterval(refresh, 2000)
    return () => {
      clearTimeout(first)
      clearInterval(t)
    }
  }, [parent, refresh])

  const labelFor = (a: Address) => payeeLabels.all().find((l) => l.address.toLowerCase() === a.toLowerCase())?.label
  const short = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`

  async function submit(to: Address, amountText: string) {
    if (!parent) return
    setFormError('')
    let units: bigint
    try {
      units = parseAmount(amountText)
    } catch (e) {
      setFormError(e instanceof AmountError ? e.message : 'Invalid amount')
      return
    }
    setBusy(true)
    const result = await pay(parent.account, { kind: 'relay', url: `${location.origin}/api/relay` }, to, units)
    setAttempts((a) => [{ at: Date.now(), to, amount: units, result }, ...a])
    setBusy(false)
    refresh()
  }

  if (missing)
    return (
      <main>
        <h1>Upkeep</h1>
        <p>This phone has no key for that invite. Open the invite link you were sent.</p>
      </main>
    )
  if (!parent)
    return (
      <main>
        <p>Loading...</p>
      </main>
    )
  if (waiting || !state)
    return (
      <main>
        <h1>Hello {parent.name}</h1>
        <p>Waiting for the sender to approve your key. Keep this page open.</p>
        <p>
          Key: <code>{parent.keyId}</code>
        </p>
      </main>
    )

  const turnedOff = state.revoked || state.expiry * 1000 < now
  return (
    <main>
      <h1>Hello {parent.name}</h1>
      <h2>Your upkeep left</h2>
      <p style={{ fontSize: '2rem' }} data-testid="remaining">
        ${formatAmount(state.remaining)}
      </p>
      <p>{state.periodEnd ? `Refills ${untilText(state.periodEnd, now)}` : 'One-time budget, does not refill'}</p>
      {turnedOff && <p role="alert">This key was turned off by the sender.</p>}

      <h2>Pay</h2>
      <select value={payee} onChange={(e) => setPayee(e.target.value)} aria-label="Who to pay">
        <option value="">Choose who to pay</option>
        {state.payees.map((a) => (
          <option key={a} value={a}>
            {labelFor(a) ?? short(a)}
          </option>
        ))}
      </select>{' '}
      <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount in dollars" inputMode="decimal" aria-label="Amount" />{' '}
      <button disabled={busy || !payee || !amount} onClick={() => submit(payee as Address, amount)}>
        {busy ? 'Paying...' : 'Pay'}
      </button>
      {formError && <p role="alert">{formError}</p>}

      <h2>Pay someone new</h2>
      <p>Not on your list. The network checks it, and it should say no.</p>
      <input value={other} onChange={(e) => setOther(e.target.value)} placeholder="0x... address" aria-label="Other address" size={44} />{' '}
      <button disabled={busy || !isAddress(other, { strict: false }) || !amount} onClick={() => submit(getAddress(other), amount)}>
        Try to pay
      </button>

      <h2>This session</h2>
      <ul>
        {attempts.map((a) => (
          <li key={a.at}>
            ${formatAmount(a.amount)} to {labelFor(a.to) ?? short(a.to)}:{' '}
            {a.result.ok ? (
              <>
                paid.{' '}
                <a href={explorerTx(a.result.txHash)} target="_blank" rel="noreferrer">
                  See on the network
                </a>
              </>
            ) : (
              <span role="alert">
                <strong>Refused.</strong> {a.result.refusal.title} <code>{a.result.refusal.code}</code> <small>{a.result.refusal.raw}</small>
              </span>
            )}
          </li>
        ))}
      </ul>
    </main>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<main><p>Loading...</p></main>}>
      <Home />
    </Suspense>
  )
}
