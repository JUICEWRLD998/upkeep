'use client'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { getAddress, isAddress, type Address } from 'viem'
import { Button } from '@/components/Button'
import { Envelope } from '@/components/Envelope'
import { Mark } from '@/components/Mark'
import { Field, Input, Select } from '@/components/Field'
import { Money } from '@/components/Money'
import { Slip } from '@/components/Slip'
import { explorerTx, publicClient } from '@/lib/upkeep/chain'
import { AmountError, formatAmount, parseAmount } from '@/lib/upkeep/amounts'
import { readKeyState, type KeyState } from '@/lib/upkeep/keys'
import { decodePayeeHint } from '@/lib/upkeep/links'
import { pay, type PayResult } from '@/lib/upkeep/pay'
import { untilText } from '@/lib/upkeep/period'
import { loadParentKey } from '@/lib/upkeep/parentKey'
import { limitHint, payeeLabels } from '@/lib/upkeep/store'
import styles from './home.module.css'

type Parent = NonNullable<Awaited<ReturnType<typeof loadParentKey>>>
type Attempt = { id: number; to: Address; amount: bigint; result: PayResult }

function Home() {
  const params = useSearchParams()
  const nonce = params.get('k')
  const hint = params.get('p')
  const limitParam = params.get('l')
  const [parent, setParent] = useState<Parent | null>(null)
  const [missing, setMissing] = useState(false)
  const [state, setState] = useState<KeyState | null>(null)
  const [waiting, setWaiting] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [payee, setPayee] = useState('')
  const [amount, setAmount] = useState('')
  const [other, setOther] = useState('')
  const [busy, setBusy] = useState<'' | 'pay' | 'other'>('')
  const [formError, setFormError] = useState('')
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [limit, setLimit] = useState<bigint | null>(null)
  const [peakUnits, setPeakUnits] = useState<bigint>(0n)
  const counter = useRef(0)
  // React state updates after a render, so two taps in the same instant both see busy === ''. A ref flips at once.
  const inFlight = useRef(false)
  const pub = useMemo(() => publicClient(), [])

  useEffect(() => {
    if (hint) payeeLabels.merge(decodePayeeHint(hint))
  }, [hint])

  // The limit only sizes the envelope level. It comes from the sender's link; the dollars left always come from the network.
  useEffect(() => {
    if (!nonce) return
    const t = setTimeout(() => {
      if (limitParam && /^\d{1,18}$/.test(limitParam)) limitHint.set(nonce, limitParam)
      const saved = limitHint.get(nonce)
      if (saved && /^\d{1,18}$/.test(saved)) setLimit(BigInt(saved))
    }, 0)
    return () => clearTimeout(t)
  }, [nonce, limitParam])

  useEffect(() => {
    // Resolve in a callback so the page renders first and never sets state synchronously in the effect body.
    const run = nonce ? loadParentKey(nonce) : Promise.resolve(null)
    run.then((p) => (p ? setParent(p) : setMissing(true)))
  }, [nonce])

  const refresh = useCallback(async () => {
    if (!parent) return
    try {
      const s = await readKeyState(pub, parent.sender, parent.keyId)
      setPeakUnits((p) => (s.remaining > p ? s.remaining : p))
      setState(s)
      setWaiting(s.status === 'pending') // the network has no record of the key until the sender approves it
    } catch {
      // a network hiccup: keep showing the last known state and try again on the next poll
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

  async function submit(to: Address, amountText: string, which: 'pay' | 'other') {
    if (!parent || inFlight.current) return
    setFormError('')
    let units: bigint
    try {
      units = parseAmount(amountText)
    } catch (e) {
      setFormError(e instanceof AmountError ? e.message : 'Invalid amount')
      return
    }
    inFlight.current = true
    setBusy(which)
    let result: PayResult
    try {
      result = await pay(parent.account, { kind: 'relay', url: `${location.origin}/api/relay` }, to, units, { pub, sender: parent.sender })
    } finally {
      inFlight.current = false
    }
    setAttempts((a) => [{ id: ++counter.current, to, amount: units, result }, ...a])
    setBusy('')
    if (result.ok) setAmount('')
    refresh()
  }

  if (missing)
    return (
      <main className={styles.page}>
        <div className={styles.center}>
          <h1>No key on this phone</h1>
          <p className={styles.muted}>This phone has no key for that invite. Open the invite link you were sent.</p>
        </div>
      </main>
    )
  if (!parent)
    return (
      <main className={styles.page}>
        <p className={styles.muted}>Loading...</p>
      </main>
    )
  if (waiting || !state)
    return (
      <main className={styles.page}>
        <div className={styles.center}>
          <div className={styles.art} aria-hidden="true">
            <Mark size={56} />
          </div>
          <h1>Hello {parent.name}</h1>
          <p>Waiting for the sender to approve your key. Keep this page open.</p>
          <p className={styles.muted}>
            Your key <code>{parent.keyId}</code>
          </p>
        </div>
      </main>
    )

  const turnedOff = state.status === 'revoked' || state.expiry * 1000 < now
  const level = limit ?? (peakUnits > 0n ? peakUnits : 1n)
  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <h1>Hello {parent.name}</h1>
      </header>

      <section className={styles.hero} aria-label="Your upkeep">
        <div className={styles.art}>
          <Envelope remaining={state.remaining} limit={level} label="Your budget" />
        </div>
        <div className={styles.heroText}>
          <h2 className={styles.kicker}>Your upkeep left</h2>
          <div className={styles.remaining} data-testid="remaining">
            <Money units={state.remaining} fit="4rem" />
          </div>
          <p className={styles.muted}>
            {state.periodEnd ? `Refills ${untilText(state.periodEnd, now)}` : 'One-time budget, does not refill'}
            {limit ? ` · of $${formatAmount(limit)}` : ''}
          </p>
        </div>
      </section>

      {turnedOff && (
        <p role="alert" className={styles.off}>
          This key was turned off by the sender.
        </p>
      )}

      <section className={styles.card}>
        <h2>Pay</h2>
        <Field label="Who to pay">
          <Select value={payee} onChange={(e) => setPayee(e.target.value)}>
            <option value="">Choose who to pay</option>
            {state.payees.map((a) => (
              <option key={a} value={a}>
                {labelFor(a) ?? short(a)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Amount" error={formError}>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount in dollars" inputMode="decimal" autoComplete="off" />
        </Field>
        <Button loading={busy === 'pay'} disabled={!payee || !amount || busy !== ''} onClick={() => submit(payee as Address, amount, 'pay')}>
          {busy === 'pay' ? 'Paying...' : 'Pay'}
        </Button>
      </section>

      <section className={styles.card}>
        <h2>Pay someone new</h2>
        <p className={styles.muted}>Not on your list. The network checks it, and it should say no.</p>
        <Field label="Other address">
          <Input value={other} onChange={(e) => setOther(e.target.value)} placeholder="0x..." autoComplete="off" />
        </Field>
        <Button variant="secondary" loading={busy === 'other'} disabled={!isAddress(other, { strict: false }) || !amount || busy !== ''} onClick={() => submit(getAddress(other), amount, 'other')}>
          Try to pay
        </Button>
      </section>

      <section aria-label="This session" className={styles.session}>
        <h2>This session</h2>
        <div aria-live="polite">
          {attempts.length === 0 ? (
            <p className={styles.muted}>Nothing yet. Each payment you make shows here with the network&apos;s answer.</p>
          ) : (
            <ul className={styles.slips}>
              {attempts.map((a, i) => (
                <Slip
                  key={a.id}
                  tone={a.result.ok ? 'paid' : 'refused'}
                  who={a.result.ok ? 'You paid' : 'You tried to pay'}
                  to={labelFor(a.to) ?? short(a.to)}
                  amount={`$${formatAmount(a.amount)}`}
                  stamp={a.result.ok ? 'PAID' : 'REFUSED'}
                  fresh={i === 0}
                >
                  {a.result.ok ? (
                    <a href={explorerTx(a.result.txHash)} target="_blank" rel="noreferrer">
                      See on the network
                    </a>
                  ) : (
                    <span className={styles.refusal}>
                      <span>{a.result.refusal.title}</span>
                      <code>{a.result.refusal.code}</code>
                      <small>{a.result.refusal.raw}</small>
                    </span>
                  )}
                </Slip>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  )
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className={styles.page}>
          <p className={styles.muted}>Loading...</p>
        </main>
      }
    >
      <Home />
    </Suspense>
  )
}






