'use client'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { getAddress, isAddress, type Address } from 'viem'
import { generatePrivateKey, privateKeyToAddress } from 'viem/accounts'
import { AmountError, parseAmount } from '@/lib/upkeep/amounts'
import { authorizeKey, PolicyError } from '@/lib/upkeep/keys'
import { LinkError, decodeKeyReturn, encodePayeeHint, type KeyReturn } from '@/lib/upkeep/links'
import { PERIODS, type PeriodChoice } from '@/lib/upkeep/period'
import { restoreSender, senderClient } from '@/lib/upkeep/sender'
import { payeeLabels, relatives } from '@/lib/upkeep/store'

type Row = { label: string; address: string }

export default function Approve() {
  const { token } = useParams<{ token: string }>()
  const [ret, setRet] = useState<KeyReturn | null>(null)
  const [error, setError] = useState('')
  const [limit, setLimit] = useState('150')
  const [period, setPeriod] = useState<PeriodChoice>('month')
  const [rows, setRows] = useState<Row[]>([{ label: '', address: '' }])
  const [busy, setBusy] = useState(false)
  const [readyLink, setReadyLink] = useState('')
  const [copied, setCopied] = useState(false)
  const sender = useMemo(() => (typeof window === 'undefined' ? null : restoreSender()), [])

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
    if (!ret || !sender) return
    setError('')
    try {
      const limitUnits = parseAmount(limit)
      const payees = rows.map((r) => {
        if (!isAddress(r.address, { strict: false })) throw new PolicyError(`"${r.label || r.address}" is not a valid address.`)
        return { label: r.label.trim() || 'Payee', address: getAddress(r.address) as Address }
      })
      setBusy(true)
      await authorizeKey(senderClient(sender.account), ret.key, {
        limit: limitUnits,
        periodSeconds: PERIODS[period].seconds,
        payees: payees.map((p) => p.address),
        expiry: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
      })
      payeeLabels.merge(payees.map((p) => ({ address: p.address, label: p.label })))
      relatives.upsert({ nonce: ret.nonce, name: ret.name, invitedAt: Date.now(), keyId: ret.key.address })
      const hint = encodePayeeHint(payees.map((p) => ({ address: p.address, label: p.label })))
      setReadyLink(`${location.origin}/home?k=${ret.nonce}&p=${hint}`)
    } catch (e) {
      if (e instanceof AmountError || e instanceof PolicyError) setError(e.message)
      else setError(`The network did not accept the approval: ${(e as { shortMessage?: string }).shortMessage ?? (e as Error).message}`.slice(0, 400))
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(readyLink)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  if (error && !ret)
    return (
      <main>
        <h1>Upkeep</h1>
        <p role="alert">{error}</p>
      </main>
    )
  if (!ret)
    return (
      <main>
        <p>Reading link...</p>
      </main>
    )
  if (!sender)
    return (
      <main>
        <h1>Approve {ret.name}&apos;s key</h1>
        <p>
          This browser has no sender account. Open <a href="/send">the sender page</a> on the device where you made your account, then open this link
          there.
        </p>
      </main>
    )

  if (readyLink)
    return (
      <main>
        <h1>{ret.name}&apos;s key is active</h1>
        <p>The network now lets this key pay only the payees you listed, up to your limit.</p>
        <p>Send {ret.name} this link to open the upkeep:</p>
        <textarea readOnly value={readyLink} rows={4} style={{ width: '100%' }} aria-label="Link to send to the relative" />
        <p>
          <button onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button> <a href="/send">Back to your console</a>
        </p>
      </main>
    )

  return (
    <main>
      <h1>Approve {ret.name}&apos;s key</h1>
      <p>
        Key address: <code>{ret.key.address}</code>
      </p>
      <p>Check that this is the key {ret.name} sent you. You can turn it off at any time.</p>

      <h2>Budget</h2>
      <label>
        Dollars{' '}
        <input value={limit} onChange={(e) => setLimit(e.target.value)} inputMode="decimal" aria-label="Budget in dollars" />
      </label>{' '}
      <select value={period} onChange={(e) => setPeriod(e.target.value as PeriodChoice)} aria-label="Refill period">
        {Object.entries(PERIODS).map(([k, v]) => (
          <option key={k} value={k}>
            {v.label}
          </option>
        ))}
      </select>

      <h2>Who {ret.name} may pay</h2>
      <p>Only these accounts. Anything else is refused by the network.</p>
      {rows.map((r, i) => (
        <p key={i}>
          <input value={r.label} onChange={(e) => setRow(i, { label: e.target.value })} placeholder="Name (Pharmacy)" aria-label={`Payee ${i + 1} name`} />{' '}
          <input value={r.address} onChange={(e) => setRow(i, { address: e.target.value })} placeholder="0x... address" aria-label={`Payee ${i + 1} address`} size={44} />{' '}
          <button type="button" onClick={() => setRow(i, { address: privateKeyToAddress(generatePrivateKey()) })}>
            Make a test address
          </button>
        </p>
      ))}
      <p>
        <button type="button" onClick={() => setRows((r) => [...r, { label: '', address: '' }])}>
          Add another payee
        </button>
      </p>
      <p>A test address is a fresh account that nobody holds the key to. It is only for trying the product on the test network.</p>

      {error && <p role="alert">{error}</p>}
      <button disabled={busy} onClick={approve}>
        {busy ? 'Waiting for your passkey and the network...' : 'Approve with my passkey'}
      </button>
    </main>
  )
}
