import { createClient, http as vhttp, publicActions } from 'viem'
import { generatePrivateKey } from 'viem/accounts'
import { tempoModerato } from 'viem/chains'
import { Account, Actions, Transport, WebCryptoP256 } from 'viem/tempo'
const TOKEN = '0x20c0000000000000000000000000000000000001'
const chain = tempoModerato.extend({ feeToken: TOKEN })
const root = Account.fromSecp256k1(generatePrivateKey())
const payee = Account.fromSecp256k1(generatePrivateKey()).address
const c = createClient({ account: root, chain, transport: vhttp() }).extend(publicActions)
await Actions.faucet.fundSync(c, { account: root.address })
const key = Account.fromWebCryptoP256(await WebCryptoP256.createKeyPair(), { access: root })
await Actions.accessKey.authorizeSync(c, { accessKey: key, expiry: Math.floor(Date.now() / 1000) + 600, limits: [{ token: TOKEN, limit: 5_000_000n, period: 0 }], scopes: [{ address: TOKEN, selector: 'transfer(address,uint256)', recipients: [payee] }] })
await Actions.accessKey.revokeSync(c, { accessKey: key.accessKeyAddress })
const relay = Transport.withRelay(vhttp(), vhttp('http://localhost:3100/api/relay'), { policy: 'sign-only' })
const mum = createClient({ account: key, chain, transport: relay }).extend(publicActions)
const t0 = Date.now()
try { await Actions.token.transferSync(mum, { token: TOKEN, to: payee, amount: 1_000_000n, feePayer: true }); console.log('PAID?!') } catch (e) {
  console.log('elapsed ms', Date.now() - t0)
  let x = e; for (let i = 0; i < 6 && x; i++) { console.log('cause', i, x.name, '| short:', x.shortMessage, '| details:', String(x.details).slice(0, 300), '| msg:', String(x.message).slice(0, 300).replace(/\n/g, ' / ')); x = x.cause }
}
