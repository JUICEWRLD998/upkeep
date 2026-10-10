'use client'
// Phase 0 browser spike (S1, S3, S4, S7). Removed before submission. Driven by scripts/driver-spike.mjs.
import { useState } from 'react'
import { generatePrivateKey, privateKeyToAddress } from 'viem/accounts'
import { publicClient } from '@/lib/upkeep/chain'
import { authorizeKey, readKeyState } from '@/lib/upkeep/keys'
import { newNonce } from '@/lib/upkeep/links'
import { pay } from '@/lib/upkeep/pay'
import { createParentKey, loadParentKey } from '@/lib/upkeep/parentKey'
import { addTestDollars, createSender, senderBalance, senderClient } from '@/lib/upkeep/sender'

type Row = { step: string; ok: boolean; detail: string }

export default function Spike() {
  const [rows, setRows] = useState<Row[]>([])
  const log = (step: string, ok: boolean, detail: string) => {
    const r = { step, ok, detail }
    ;(window as unknown as { __spike: Row[] }).__spike = [...(((window as unknown as { __spike?: Row[] }).__spike) ?? []), r]
    setRows((x) => [...x, r])
  }

  async function run() {
    const pub = publicClient()
    const usd = (n: number) => BigInt(Math.round(n * 1e6))
    try {
      const sender = await createSender('Spike sender')
      log('S1 passkey account', true, sender.address)
      await addTestDollars(pub, sender.address)
      log('S1 faucet + balance', true, String(await senderBalance(pub, sender.address)))

      const id = newNonce()
      const parent = await createParentKey(id, sender.address, 'Mummy')
      log('S7 key created', true, parent.keyId)
      const pharmacy = privateKeyToAddress(generatePrivateKey())
      const stranger = privateKeyToAddress(generatePrivateKey())
      await authorizeKey(senderClient(sender.account), { address: parent.keyId, type: 'p256' }, {
        limit: usd(10), periodSeconds: 0, payees: [pharmacy], expiry: Math.floor(Date.now() / 1000) + 3600,
      })
      const s0 = await readKeyState(pub, sender.address, parent.keyId)
      log('S3 passkey signed the authorization', s0.scoped && s0.remaining === usd(10), `remaining ${s0.remaining} payees ${s0.payees.length}`)

      const again = await loadParentKey(id)
      log('S7 key reloaded from IndexedDB', again?.keyId === parent.keyId, String(again?.keyId))

      const sponsor = { kind: 'relay' as const, url: `${location.origin}/api/relay` }
      const ok = await pay(again!.account, sponsor, pharmacy, usd(4))
      log('S4 sponsored payment via /api/relay', ok.ok, ok.ok ? ok.txHash : ok.refusal.raw)
      const s1 = await readKeyState(pub, sender.address, parent.keyId)
      log('S4 budget exact after payment', s1.remaining === usd(6), `remaining ${s1.remaining}`)
      const bad = await pay(again!.account, sponsor, stranger, usd(1))
      log('refusal: stranger', !bad.ok && bad.refusal.code === 'CallNotAllowed', bad.ok ? 'PAID' : `${bad.refusal.code} | ${bad.refusal.raw}`)
      const over = await pay(again!.account, sponsor, pharmacy, usd(7))
      log('refusal: over limit', !over.ok && over.refusal.code === 'SpendingLimitExceeded', over.ok ? 'PAID' : `${over.refusal.code} | ${over.refusal.raw}`)
    } catch (e) {
      log('ERROR', false, e instanceof Error ? `${e.name}: ${e.message}`.slice(0, 500) : String(e))
    }
    ;(window as unknown as { __spikeDone: boolean }).__spikeDone = true
  }

  return (
    <main>
      <h1>Spike</h1>
      <button id="run" onClick={run}>Run</button>
      <ul>{rows.map((r, i) => <li key={i}>{r.ok ? 'PASS' : 'FAIL'} {r.step}: {r.detail}</li>)}</ul>
    </main>
  )
}
