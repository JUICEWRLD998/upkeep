'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, m } from 'motion/react'
import type { Address } from 'viem'
import { Button } from '@/components/Button'
import { CopyField } from '@/components/CopyField'
import { Envelope } from '@/components/Envelope'
import { Field, Input } from '@/components/Field'
import { Money } from '@/components/Money'
import { Slip } from '@/components/Slip'
import { explorerAddress, explorerTx, publicClient } from '@/lib/upkeep/chain'
import { formatAmount } from '@/lib/upkeep/amounts'
import { fetchFeed, type FeedItem } from '@/lib/upkeep/feed'
import { readKeyState, revokeKey, type KeyState } from '@/lib/upkeep/keys'
import { LinkError, cleanName, encodeInvite, newNonce } from '@/lib/upkeep/links'
import { dur, ease } from '@/lib/motion'
import { untilText } from '@/lib/upkeep/period'
import { addTestDollars, createSender, restoreSender, senderBalance, senderClient } from '@/lib/upkeep/sender'
import { payeeLabels, relatives, since, type Relative } from '@/lib/upkeep/store'
import styles from './send.module.css'

type Sender = NonNullable<ReturnType<typeof restoreSender>>

export default function Send() {
  const router = useRouter()
  const pub = useMemo(() => publicClient(), [])
  const [sender, setSender] = useState<Sender | null>(null)
  const [ready, setReady] = useState(false)
  const [balance, setBalance] = useState<bigint | null>(null)
  const [list, setList] = useState<Relative[]>([])
  const [states, setStates] = useState<Record<string, KeyState>>({})
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [fresh, setFresh] = useState<Set<string>>(new Set())
  const seen = useRef<Set<string> | null>(null)
  const [peaks, setPeaks] = useState<Record<string, bigint>>({})
  const [name, setName] = useState('')
  const [invite, setInvite] = useState('')
  const [pasted, setPasted] = useState('')
  const [msg, setMsg] = useState('')
  const [msgTone, setMsgTone] = useState<'ok' | 'error'>('ok')
  const [busy, setBusy] = useState<'' | 'create' | 'faucet' | 'revoke'>('')
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
    const next: Record<string, KeyState> = {}
    await Promise.all(
      rel.map(async (r) => {
        if (!r.keyId) return
        try {
          const st = await readKeyState(pub, addr, r.keyId)
          next[r.nonce] = st
          setPeaks((p) => (st.remaining > (p[r.nonce] ?? 0n) ? { ...p, [r.nonce]: st.remaining } : p))
        } catch {
          // a network hiccup: this key shows "checking..." until the next poll
        }
      }),
    )
    setStates(next)
    const from = since.get()
    if (from) {
      try {
        const items = (await fetchFeed(pub, addr, { fromBlock: BigInt(from) })).reverse()
        // The first load only marks what is already there as seen. Anything that arrives later plays the signature moment.
        if (seen.current === null) {
          seen.current = new Set(items.map((i) => i.txHash))
        } else {
          const arrived = items.filter((i) => !seen.current!.has(i.txHash)).map((i) => i.txHash)
          if (arrived.length) {
            arrived.forEach((h) => seen.current!.add(h))
            setFresh((f) => new Set([...f, ...arrived]))
          }
        }
        setFeed(items)
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

  function say(text: string, tone: 'ok' | 'error' = 'ok') {
    setMsg(text)
    setMsgTone(tone)
  }

  async function create() {
    setBusy('create')
    say('')
    try {
      const block = await pub.getBlockNumber()
      const s = await createSender('Upkeep sender')
      since.set(block)
      setSender(s)
    } catch (e) {
      say(`Could not create the passkey account: ${(e as Error).message}`.slice(0, 300), 'error')
    } finally {
      setBusy('')
    }
  }

  async function faucet() {
    if (!sender) return
    setBusy('faucet')
    say('')
    try {
      await addTestDollars(pub, sender.address)
      say('Test dollars added.')
      refresh()
    } catch (e) {
      say(`The test faucet said no: ${(e as { shortMessage?: string }).shortMessage ?? (e as Error).message}`.slice(0, 300), 'error')
    } finally {
      setBusy('')
    }
  }

  function linkFor(r: { name: string; nonce: string }) {
    return `${location.origin}/join/${encodeInvite({ sender: sender!.address, name: r.name, nonce: r.nonce })}`
  }

  function makeInvite() {
    if (!sender) return
    say('')
    try {
      const nonce = newNonce()
      const clean = cleanName(name)
      relatives.upsert({ nonce, name: clean, invitedAt: Date.now() })
      setInvite(linkFor({ name: clean, nonce }))
      setName('')
      setList(relatives.all())
    } catch (e) {
      say(e instanceof LinkError ? e.message : 'Could not make the invite.', 'error')
    }
  }

  function openPasted() {
    const mt = pasted.trim().match(/\/approve\/([A-Za-z0-9_-]+)/) ?? pasted.trim().match(/^([A-Za-z0-9_-]{20,})$/)
    if (!mt) {
      say('Paste the link your relative sent back.', 'error')
      return
    }
    router.push(`/approve/${mt[1]}`)
  }

  async function revoke(r: Relative) {
    if (!sender || !r.keyId) return
    setBusy('revoke')
    say('')
    try {
      await revokeKey(senderClient(sender.account), { address: r.keyId, type: 'p256' })
      say(`${r.name}'s key is turned off.`)
      refresh()
    } catch (e) {
      say(`Could not turn the key off: ${(e as { shortMessage?: string }).shortMessage ?? (e as Error).message}`.slice(0, 300), 'error')
    } finally {
      setBusy('')
    }
  }

  const nameOf = (keyId: Address) => list.find((r) => r.keyId?.toLowerCase() === keyId.toLowerCase())?.name ?? 'A key'
  const labelOf = (a: Address) => payeeLabels.all().find((l) => l.address.toLowerCase() === a.toLowerCase())?.label ?? `${a.slice(0, 6)}...${a.slice(-4)}`

  /** The envelope level needs a limit. Use the sender's own record; fall back to the largest amount seen this visit. */
  function limitFor(r: Relative, s: KeyState): bigint {
    return r.limit ? BigInt(r.limit) : (peaks[r.nonce] ?? s.remaining)
  }

  if (!ready)
    return (
      <main className={styles.page}>
        <p className={styles.muted}>Loading...</p>
      </main>
    )

  if (!sender)
    return (
      <main className={styles.page}>
        <section className={styles.welcome}>
          <div className={styles.welcomeArt} aria-hidden="true">
            <Envelope remaining={0n} limit={150_000_000n} label="Empty envelope" />
          </div>
          <div className={styles.welcomeText}>
            <h1>Keep your dollars. Give your family a key.</h1>
            <p>
              Your account is protected by a passkey on this device. Nobody, including us, can move your money. You decide how much each person may
              spend, and who they may pay.
            </p>
            <Button loading={busy === 'create'} onClick={create}>
              {busy === 'create' ? 'Waiting for your passkey...' : 'Create my account with a passkey'}
            </Button>
            {msg && (
              <p role="alert" className={styles.error}>
                {msg}
              </p>
            )}
          </div>
        </section>
      </main>
    )

  return (
    <main className={styles.page}>
      <div className={styles.console}>
        <aside className={styles.rail} aria-label="Your account">
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Your account</h2>
            <a href={explorerAddress(sender.address)} target="_blank" rel="noreferrer" className={`${styles.address} num`}>
              {sender.address.slice(0, 8)}...{sender.address.slice(-6)}
            </a>
            <div className={styles.balanceLabel}>Balance</div>
            <div className={styles.balance} data-testid="balance">
              {balance === null ? <span className={styles.muted}>...</span> : <Money units={balance} />}
            </div>
            <Button variant="secondary" loading={busy === 'faucet'} onClick={faucet}>
              Add test dollars
            </Button>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Give someone a key</h2>
            <Field label="Relative name">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Mummy" autoComplete="off" />
            </Field>
            <Button disabled={!name.trim()} onClick={makeInvite}>
              Make invite link
            </Button>
            {invite && (
              <div className={styles.stack}>
                <p className={styles.muted}>Send this link to them. Their key is made on their phone.</p>
                <CopyField value={invite} label="Invite link" />
              </div>
            )}
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>They sent a link back?</h2>
            <Field label="Link from your relative">
              <Input value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="Paste their link" autoComplete="off" />
            </Field>
            <Button variant="secondary" onClick={openPasted}>
              Review key
            </Button>
          </section>
        </aside>

        <div className={styles.stage}>
          <header className={styles.head}>
            <h1>Your upkeep</h1>
            <p className={styles.muted}>Each envelope is what that person can still spend this period. The network enforces it.</p>
          </header>
          {msg && (
            <p role={msgTone === 'error' ? 'alert' : 'status'} className={msgTone === 'error' ? styles.error : styles.ok}>
              {msg}
            </p>
          )}

          <section aria-label="Keys">
            {list.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyArt} aria-hidden="true">
                  <Envelope remaining={0n} limit={150_000_000n} tone="compact" label="Empty envelope" />
                </div>
                <div>
                  <h2>No keys yet</h2>
                  <p className={styles.muted}>Make an invite link for Mummy and her envelope appears here the moment you approve her key.</p>
                </div>
              </div>
            ) : (
              <ul className={styles.keys}>
                <AnimatePresence initial={false}>
                  {list.map((r) => {
                    const s = states[r.nonce]
                    const live = s && s.status === 'active'
                    return (
                      <m.li
                        key={r.nonce}
                        layout
                        className={`${styles.keyCard} ${s?.status === 'revoked' ? styles.off : ''}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: dur.short, ease: ease.out }}
                      >
                        <div className={styles.keyHead}>
                          <h3>{r.name}</h3>
                          <span className={`${styles.chip} ${live ? styles.chipOn : ''}`}>
                            {!r.keyId ? 'Invited' : !s ? 'Checking' : s.status === 'pending' ? 'Needs approval' : s.status === 'revoked' ? 'Turned off' : 'Active'}
                          </span>
                        </div>
                        {live ? (
                          <>
                            <Envelope remaining={s.remaining} limit={limitFor(r, s)} tone="compact" label={`${r.name}'s envelope`} />
                            <div className={styles.left}>
                              <Money units={s.remaining} className={styles.leftNum} />
                              <span className={styles.muted}>
                                left{r.limit ? ` of $${formatAmount(BigInt(r.limit))}` : ''}
                              </span>
                            </div>
                            <p className={styles.muted}>
                              {s.periodEnd ? `Refills ${untilText(s.periodEnd, now)}` : 'One-time budget'} · {s.payees.length} payee{s.payees.length === 1 ? '' : 's'}
                            </p>
                            <Button variant="danger" loading={busy === 'revoke'} onClick={() => revoke(r)}>
                              Turn off
                            </Button>
                          </>
                        ) : !r.keyId ? (
                          <>
                            <p className={styles.muted}>Invite sent. Waiting for {r.name}&apos;s link.</p>
                            <CopyField value={linkFor(r)} label={`Invite link for ${r.name}`} />
                          </>
                        ) : s?.status === 'revoked' ? (
                          <p className={styles.muted}>This key can never pay again. Invite {r.name} again to give a new one.</p>
                        ) : (
                          <p className={styles.muted}>{r.name} sent a key. Paste their link on the left to review and approve it.</p>
                        )}
                      </m.li>
                    )
                  })}
                </AnimatePresence>
              </ul>
            )}
          </section>

          <section aria-label="Live payments" className={styles.feedSection}>
            <h2>Live payments</h2>
            {feed.length === 0 ? (
              <p className={styles.muted}>Nothing yet. Payments appear here the moment the network confirms them.</p>
            ) : (
              <ul className={styles.feed}>
                {feed.map((f) => (
                  <Slip
                    key={f.txHash}
                    tone="paid"
                    who={`${nameOf(f.keyId)} paid`}
                    to={labelOf(f.to)}
                    amount={`$${formatAmount(f.amount)}`}
                    stamp="PAID"
                    fresh={fresh.has(f.txHash)}
                  >
                    ${formatAmount(f.remaining)} left ·{' '}
                    <a href={explorerTx(f.txHash)} target="_blank" rel="noreferrer">
                      See on the network
                    </a>
                  </Slip>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}


