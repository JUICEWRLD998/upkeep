'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/Button'
import { CopyField } from '@/components/CopyField'
import { Envelope } from '@/components/Envelope'
import { LinkError, decodeInvite, encodeKeyReturn, type Invite } from '@/lib/upkeep/links'
import { createParentKey, loadParentKey } from '@/lib/upkeep/parentKey'
import styles from './join.module.css'

export default function Join() {
  const { invite: token } = useParams<{ invite: string }>()
  const [invite, setInvite] = useState<Invite | null>(null)
  const [returnLink, setReturnLink] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const inv = decodeInvite(token)
        if (cancelled) return
        setInvite(inv)
        // One key per invite. Opening the link again reuses the same key instead of making a second one.
        const existing = await loadParentKey(inv.nonce)
        const parent = existing ?? (await createParentKey(inv.nonce, inv.sender, inv.name))
        const back = encodeKeyReturn({ key: { address: parent.keyId, type: 'p256' }, name: inv.name, nonce: inv.nonce })
        if (!cancelled) setReturnLink(`${location.origin}/approve/${back}`)
      } catch (e) {
        if (!cancelled) setError(e instanceof LinkError ? e.message : 'This device could not create a key. Try another browser.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  if (error)
    return (
      <main className={styles.page}>
        <h1>This invite did not work</h1>
        <p role="alert" className={styles.error}>
          {error}
        </p>
      </main>
    )
  if (!invite)
    return (
      <main className={styles.page}>
        <p className={styles.muted}>Opening invite...</p>
      </main>
    )

  return (
    <main className={styles.page}>
      <div className={styles.art} aria-hidden="true">
        <Envelope remaining={0n} limit={1n} label="Empty envelope" />
      </div>
      <header className={styles.head}>
        <h1>Hello {invite.name}</h1>
        <p>Someone wants to give you an upkeep key. Your key is made on this phone and never leaves it.</p>
        <p className={styles.muted}>
          Sender account <code>{invite.sender}</code>
        </p>
      </header>

      {returnLink ? (
        <ol className={styles.steps}>
          <li className={styles.step}>
            <h2>Step 1: send this link back</h2>
            <p className={styles.muted}>Send it to the person who invited you (WhatsApp, SMS). It contains only your key&apos;s public address.</p>
            <CopyField value={returnLink} label="Link to send back" />
          </li>
          <li className={styles.step}>
            <h2>Step 2: wait for approval</h2>
            <p className={styles.muted}>When they approve, they will send you a link to open your upkeep.</p>
            <a className={styles.open} href={`/home?k=${invite.nonce}`}>
              Open it here to check
            </a>
          </li>
        </ol>
      ) : (
        <Button loading disabled>
          Making your key...
        </Button>
      )}
    </main>
  )
}
