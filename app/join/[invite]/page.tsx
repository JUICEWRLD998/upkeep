'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { LinkError, decodeInvite, encodeKeyReturn, type Invite } from '@/lib/upkeep/links'
import { createParentKey, loadParentKey } from '@/lib/upkeep/parentKey'

export default function Join() {
  const { invite: token } = useParams<{ invite: string }>()
  const [invite, setInvite] = useState<Invite | null>(null)
  const [returnLink, setReturnLink] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

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

  async function copy() {
    try {
      await navigator.clipboard.writeText(returnLink)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  if (error)
    return (
      <main>
        <h1>Upkeep</h1>
        <p role="alert">{error}</p>
      </main>
    )
  if (!invite)
    return (
      <main>
        <p>Opening invite...</p>
      </main>
    )

  return (
    <main>
      <h1>Hello {invite.name}</h1>
      <p>Someone wants to give you an upkeep key. Your key is made on this phone and never leaves it.</p>
      <p>
        Sender account: <code>{invite.sender}</code>
      </p>
      {returnLink ? (
        <>
          <h2>Step 1: send this link back</h2>
          <p>Send it to the person who invited you (WhatsApp, SMS). It contains only your key&apos;s public address.</p>
          <textarea readOnly value={returnLink} rows={4} style={{ width: '100%' }} aria-label="Link to send back" />
          <p>
            <button onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button>
          </p>
          <h2>Step 2: wait for approval</h2>
          <p>
            When they approve, they will send you a link to open your upkeep. Or{' '}
            <a href={`/home?k=${invite.nonce}`}>open it here</a> to check.
          </p>
        </>
      ) : (
        <p>Making your key...</p>
      )}
    </main>
  )
}
