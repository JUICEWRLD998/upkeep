// S4: fee sponsorship keeps the cap exact. Moderato, testnet funds only.
import { createClient, http as vhttp, publicActions } from 'viem'
import { generatePrivateKey } from 'viem/accounts'
import { tempoModerato } from 'viem/chains'
import { Account, Actions, Relay, Transport, WebCryptoP256 } from 'viem/tempo'

const TOKEN = '0x20c0000000000000000000000000000000000001'
const chain = tempoModerato.extend({ feeToken: TOKEN })
const usd = (n) => BigInt(Math.round(n * 1e6))
const feePayer = Account.fromSecp256k1(generatePrivateKey())
const root = Account.fromSecp256k1(generatePrivateKey())
const pharmacy = Account.fromSecp256k1(generatePrivateKey()).address
const plain = createClient({ chain, transport: vhttp() }).extend(publicActions)
await Actions.faucet.fundSync(plain, { account: feePayer.address })
await Actions.faucet.fundSync(plain, { account: root.address })

const rootClient = createClient({ account: root, chain, transport: vhttp() }).extend(publicActions)
const key = Account.fromWebCryptoP256(await WebCryptoP256.createKeyPair(), { access: root })
await Actions.accessKey.authorizeSync(rootClient, {
  accessKey: key,
  expiry: Math.floor(Date.now() / 1000) + 3600,
  limits: [{ token: TOKEN, limit: usd(10), period: 0 }],
  scopes: [{ address: TOKEN, selector: 'transfer(address,uint256)', recipients: [pharmacy] }],
})
const relay = Transport.withRelay(vhttp(), vhttp('http://localhost:3100/api/relay'), { policy: process.argv[2] || 'sign-only' })
const mum = createClient({ account: key, chain, transport: relay }).extend(publicActions)
const rem = async () => (await Actions.accessKey.getRemainingLimit(rootClient, { account: root.address, accessKey: key, token: TOKEN })).remaining
const feeBal = async () => Actions.token.getBalance(plain, { account: feePayer.address, token: TOKEN })
const f0 = await feeBal()
try {
  const r = await Actions.token.transferSync(mum, { token: TOKEN, to: pharmacy, amount: usd(4), feePayer: true })
  console.log('OK sponsored transfer', r.receipt.transactionHash, 'feePayer on receipt:', r.receipt.feePayer)
} catch (e) { console.log('FAIL', e.shortMessage || e.message); let x = e; for (let i = 0; i < 5 && x; i++) { console.log(' cause', i, x.name, String(x.details || x.message).slice(0, 300)); x = x.cause } }
console.log('remaining raw', String(await rem()), '(exact would be 6000000)')
console.log('feePayer balance delta', String(f0 - (await feeBal())))
