// @live: runs against Tempo Moderato with fresh accounts funded by the public faucet. Zero personal funds.
import { createClient, http, publicActions } from 'viem'
import { generatePrivateKey } from 'viem/accounts'
import { describe, expect, it } from 'vitest'
import { Account, Actions, Relay, WebCryptoP256 } from 'viem/tempo'
import { chain, publicClient, TOKEN, RPC_URL } from '../lib/upkeep/chain'
import { fetchFeed } from '../lib/upkeep/feed'
import { accessKeyAccount, authorizeKey, readKeyState, revokeKey, type RootClient } from '../lib/upkeep/keys'
import { pay, type FeeSponsor } from '../lib/upkeep/pay'

const usd = (n: number) => BigInt(Math.round(n * 1e6))
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('live: capped, payee-scoped keys on Moderato', () => {
  it('runs the whole parent story against the chain', async () => {
    const pub = publicClient()
    const feePayer = Account.fromSecp256k1(generatePrivateKey())
    const root = Account.fromSecp256k1(generatePrivateKey())
    const pharmacy = Account.fromSecp256k1(generatePrivateKey()).address
    const stranger = Account.fromSecp256k1(generatePrivateKey()).address
    await Actions.faucet.fundSync(pub as never, { account: feePayer.address })
    await Actions.faucet.fundSync(pub as never, { account: root.address })
    const rootClient = createClient({ account: root, chain, transport: http(RPC_URL) }).extend(publicActions) as unknown as RootClient

    const keyAccount = accessKeyAccount(await WebCryptoP256.createKeyPair(), root.address)
    const keyId = keyAccount.accessKeyAddress
    const sponsor: FeeSponsor = { kind: 'local', plugins: { plugins: [Relay.feePayer({ account: feePayer })] } as never }
    const fromBlock = await pub.getBlockNumber()

    // 1. authorize: $10 per 40 s, payee = pharmacy only
    await authorizeKey(rootClient, { address: keyId, type: 'p256' }, {
      limit: usd(10), periodSeconds: 40, payees: [pharmacy], expiry: Math.floor(Date.now() / 1000) + 3600,
    })
    let state = await readKeyState(pub, root.address, keyId)
    expect(state.revoked).toBe(false)
    expect(state.scoped).toBe(true)
    expect(state.remaining).toBe(usd(10))
    expect(state.payees.map((p) => p.toLowerCase())).toEqual([pharmacy.toLowerCase()])
    expect(state.periodEnd).not.toBeNull()

    // 2. an allowed payment leaves the budget EXACT because the fee is sponsored
    const ok = await pay(keyAccount, sponsor, pharmacy, usd(4))
    expect(ok.ok).toBe(true)
    state = await readKeyState(pub, root.address, keyId)
    expect(state.remaining).toBe(usd(6))

    // 3. the chain refuses a stranger and an over-limit payment, in its own words
    const bad = await pay(keyAccount, sponsor, stranger, usd(1))
    expect(bad).toMatchObject({ ok: false, refusal: { code: 'CallNotAllowed' } })
    const over = await pay(keyAccount, sponsor, pharmacy, usd(7))
    expect(over).toMatchObject({ ok: false, refusal: { code: 'SpendingLimitExceeded' } })
    expect((await readKeyState(pub, root.address, keyId)).remaining).toBe(usd(6))

    // 4. the sender's feed shows exactly one payment, fee 0, remaining 6
    const feed = await fetchFeed(pub, root.address, { keyId, fromBlock })
    expect(feed).toHaveLength(1)
    expect(feed[0]).toMatchObject({ amount: usd(4), fee: 0n, remaining: usd(6) })
    expect(feed[0].to.toLowerCase()).toBe(pharmacy.toLowerCase())

    // 5. the budget renews by itself after the period
    const end = (await readKeyState(pub, root.address, keyId)).periodEnd!
    await sleep(Math.max(0, end * 1000 - Date.now()) + 4000)
    expect((await readKeyState(pub, root.address, keyId)).remaining).toBe(usd(10))

    // 6. revoke ends it
    await revokeKey(rootClient, { address: keyId, type: 'p256' })
    expect((await readKeyState(pub, root.address, keyId)).revoked).toBe(true)
    const after = await pay(keyAccount, sponsor, pharmacy, usd(1))
    expect(after).toMatchObject({ ok: false, refusal: { code: 'KeyAlreadyRevoked' } })
  })
})
