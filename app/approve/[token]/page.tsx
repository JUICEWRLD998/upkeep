'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getAddress, isAddress, type Address } from 'viem'
import { generatePrivateKey, privateKeyToAddress } from 'viem/accounts'
import { Button } from '@/components/Button'
import { CopyField } from '@/components/CopyField'
import { Envelope } from '@/components/Envelope'
import { Field, Input, Select } from '@/components/Field'
import { Money } from '@/components/Money'
import { AmountError, parseAmount } from '@/lib/upkeep/amounts'
import { authorizeKey, PolicyError } from '@/lib/upkeep/keys'
import { LinkError, decodeKeyReturn, encodePayeeHint, type KeyReturn } from '@/lib/upkeep/links'
import { PERIODS, type PeriodChoice } from '@/lib/upkeep/period'
import { restoreSender, senderClient } from '@/lib/upkeep/sender'
import { payeeLabels, relatives } from '@/lib/upkeep/store'
import styles from './approve.module.css'

type Row = { label: string; address: string }

function previewOf(text: string): bigint {
  try {
    return parseAmount(text)
  } catch {
    return 0n
  }
}
type DeskPayee = { id: number; label: string; bank: string; accountName: string; last4: string; address: Address }

export default function Approve() {
  const { token } = useParams<{ token: string }>()
  const [ret, setRet] = useState<KeyReturn | null>(null)
  const [error, setError] = useState('')
  const [limit, setLimit] = useState('150')
  const [period, setPeriod] = useState<PeriodChoice>('month')
  const [rows, setRows] = useState<Row[]>([{ label: '', address: '' }])
  const [busy, setBusy] = useState(false)
  // a ref flips at once, so a double tap cannot authorize the same key twice before React re-renders
  const inFlight = useRef(false)
  const [readyLink, setReadyLink] = useState('')
  const sender = useMemo(() => (typeof window === 'undefined' ? null : restoreSender()), [])
  const [desk, setDesk] = useState<DeskPayee[]>([])
  const [deskMsg, setDeskMsg] = useState('')
  const [deskBusy, setDeskBusy] = useState(false)
  const [form, setForm] = useState({ label: '', bank: '', accountName: '', last4: '' })

  useEffect(() => {
    if (!sender) return
    let cancelled = false
    fetch(`/api/desk/payees?sender=${sender.address}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!cancelled && j?.payees) setDesk(j.payees)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [sender])

  // Put a desk payee into the first empty row, or add a row. The key is limited to exactly the addresses in these rows.
  function pickDeskPayee(p: DeskPayee) {
    setRows((rs) => {
      if (rs.some((r) => r.address.toLowerCase() === p.address.toLowerCase())) return rs
      const label = `${p.label} (${p.bank} ••••${p.last4})`
      const empty = rs.findIndex((r) => !r.address.trim())
      return empty >= 0 ? rs.map((r, i) => (i === empty ? { label, address: p.address } : r)) : [...rs, { label, address: p.address }]
    })
  }

  async function addDeskPayee() {
    if (!sender) return
    setDeskMsg('')
    setDeskBusy(true)
    try {
      const res = await fetch('/api/desk/payees', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sender: sender.address, ...form }),
      })
      const j = await res.json()
      if (!res.ok) {
        setDeskMsg(j.error ?? 'The payout desk said no.')
        return
      }
      setDesk((d) => [...d, j])
      pickDeskPayee(j)
      setForm({ label: '', bank: '', accountName: '', last4: '' })
      setDeskMsg(`${j.label} added at the payout desk.`)
    } catch {
      setDeskMsg('Could not reach the payout desk. Try again.')
    } finally {
      setDeskBusy(false)
    }
  }

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        setRet(decodeKeyReturn(token))
      } catch (e) {
        setError(e instanceof LinkError ? e.message : 'This link could not be read.')
      }
    }, 0)
    return () => clearTimeout(t)
  }, [token])

  const setRow = (i: number, patch: Partial<Row>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)))

  async function approve() {
    if (!ret || !sender || inFlight.current) return
    setError('')
    try {
      const limitUnits = parseAmount(limit)
      const payees = rows.map((r) => {
        if (!isAddress(r.address, { strict: false })) throw new PolicyError(`"${r.label || r.address}" is not a valid address.`)
        return { label: r.label.trim() || 'Payee', address: getAddress(r.address) as Address }
      })
      inFlight.current = true
      setBusy(true)
      await authorizeKey(senderClient(sender.account), ret.key, {
        limit: limitUnits,
        periodSeconds: PERIODS[period].seconds,
        payees: payees.map((p) => p.address),
        expiry: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
      })
      payeeLabels.merge(payees.map((p) => ({ address: p.address, label: p.label })))
      relatives.upsert({ nonce: ret.nonce, name: ret.name, invitedAt: Date.now(), keyId: ret.key.address, limit: limitUnits.toString() })
      const hint = encodePayeeHint(payees.map((p) => ({ address: p.address, label: p.label })))
      setReadyLink(`${location.origin}/home?k=${ret.nonce}&p=${hint}&l=${limitUnits.toString()}`)
    } catch (e) {
      if (e instanceof AmountError || e instanceof PolicyError) setError(e.message)
      else setError(`The network did not accept the approval: ${(e as { shortMessage?: string }).shortMessage ?? (e as Error).message}`.slice(0, 400))
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  // The preview envelope shows the budget being set. An invalid or empty amount shows an empty envelope, never an error.
  const previewUnits = previewOf(limit)

  if (error && !ret)
    return (
      <main className={styles.page}>
        <h1>This link did not work</h1>
        <p role="alert" className={styles.error}>
          {error}
        </p>
        <Link href="/send">Back to your console</Link>
      </main>
    )
  if (!ret)
    return (
      <main className={styles.page}>
        <p className={styles.muted}>Reading link...</p>
      </main>
    )
  if (!sender)
    return (
      <main className={styles.page}>
        <h1>Approve {ret.name}&apos;s key</h1>
        <p>
          This browser has no sender account. Open <Link href="/send">the sender page</Link> on the device where you made your account, then open this link
          there.
        </p>
      </main>
    )

  if (readyLink)
    return (
      <main className={styles.page}>
        <section className={styles.done}>
          <div className={styles.doneArt} aria-hidden="true">
            <Envelope remaining={previewUnits} limit={previewUnits} label={`${ret.name}'s envelope`} />
          </div>
          <div className={styles.doneText}>
            <h1>{ret.name}&apos;s key is active</h1>
            <p>The network now lets this key pay only the payees you listed, up to your limit.</p>
            <p>Send {ret.name} this link to open the upkeep:</p>
            <CopyField value={readyLink} label="Link to send to the relative" />
            <Link href="/send" className={styles.back}>
              Back to your console
            </Link>
          </div>
        </section>
      </main>
    )

  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <h1>Approve {ret.name}&apos;s key</h1>
        <p className={styles.muted}>
          Key address <code>{ret.key.address}</code>. Check that this is the key {ret.name} sent you. You can turn it off at any time.
        </p>
      </header>

      <div className={styles.layout}>
        <div className={styles.form}>
          <section className={styles.card}>
            <h2>Budget</h2>
            <div className={styles.pair}>
              <Field label="Budget in dollars">
                <Input value={limit} onChange={(e) => setLimit(e.target.value)} inputMode="decimal" autoComplete="off" />
              </Field>
              <Field label="Refills">
                <Select value={period} onChange={(e) => setPeriod(e.target.value as PeriodChoice)}>
                  {Object.entries(PERIODS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </section>

          <section className={styles.card}>
            <h2>Who {ret.name} may pay</h2>
            <p className={styles.muted}>Only these accounts. Anything else is refused by the network.</p>
            <ul className={styles.rows}>
              {rows.map((r, i) => (
                <li key={i} className={styles.row}>
                  <Field label="Name">
                    <Input value={r.label} onChange={(e) => setRow(i, { label: e.target.value })} placeholder="Pharmacy" aria-label={`Payee ${i + 1} name`} autoComplete="off" />
                  </Field>
                  <Field label="Address">
                    <Input value={r.address} onChange={(e) => setRow(i, { address: e.target.value })} placeholder="0x..." aria-label={`Payee ${i + 1} address`} autoComplete="off" />
                  </Field>
                  <div className={styles.rowActions}>
                    <Button variant="quiet" onClick={() => setRow(i, { address: privateKeyToAddress(generatePrivateKey()) })}>
                      Make a test address
                    </Button>
                    {rows.length > 1 && (
                      <Button variant="quiet" aria-label={`Remove payee ${i + 1}`} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>
                        Remove
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <div>
              <Button variant="secondary" onClick={() => setRows((r) => [...r, { label: '', address: '' }])}>
                Add another payee
              </Button>
            </div>
            <p className={styles.muted}>A test address is a fresh account that nobody holds the key to. It is only for trying the product on the test network.</p>
          </section>

          <section className={styles.card}>
            <h2>Pay into a Nigerian bank account</h2>
            <p className={styles.muted}>
              The payout desk gives each bank payee its own deposit address on the network. The dollar payment is real on the test network. The naira
              credit is <strong>simulated</strong> in this product.
            </p>
            {desk.length > 0 && (
              <div className={styles.chips}>
                {desk.map((p) => (
                  <Button key={p.id} variant="secondary" onClick={() => pickDeskPayee(p)}>
                    Use {p.label} ({p.bank} ••••{p.last4})
                  </Button>
                ))}
              </div>
            )}
            <div className={styles.deskForm}>
              <Field label="Name">
                <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Mummy" aria-label="Desk payee name" autoComplete="off" />
              </Field>
              <Field label="Bank">
                <Input value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })} placeholder="GTBank" aria-label="Desk payee bank" autoComplete="off" />
              </Field>
              <Field label="Account name">
                <Input value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value })} aria-label="Desk payee account name" autoComplete="off" />
              </Field>
              <Field label="Last 4 digits" hint="We keep only these four digits.">
                <Input value={form.last4} onChange={(e) => setForm({ ...form, last4: e.target.value })} inputMode="numeric" maxLength={4} aria-label="Desk payee last 4 digits" autoComplete="off" />
              </Field>
            </div>
            <div>
              <Button variant="secondary" loading={deskBusy} onClick={addDeskPayee}>
                Add through the payout desk
              </Button>
            </div>
            {deskMsg && <p role="status">{deskMsg}</p>}
          </section>

          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
          <div>
            <Button loading={busy} onClick={approve}>
              {busy ? 'Waiting for your passkey and the network...' : 'Approve with my passkey'}
            </Button>
          </div>
        </div>

        <aside className={styles.preview} aria-label="Preview of the envelope">
          <Envelope remaining={previewUnits} limit={previewUnits} tone="compact" label={`${ret.name}'s envelope`} />
          <div className={styles.previewNum}>
            <Money units={previewUnits} fit="2.25rem" />
          </div>
          <p className={styles.muted}>
            {ret.name} will be able to spend this much {PERIODS[period].label.toLowerCase()}, at {rows.filter((r) => r.address.trim()).length || 'no'} payee
            {rows.filter((r) => r.address.trim()).length === 1 ? '' : 's'}.
          </p>
        </aside>
      </div>
    </main>
  )
}



