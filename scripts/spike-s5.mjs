// S5: read everything back from chain; also the shape of token.getBalance.
import { createClient, http, publicActions } from 'viem'
import { generatePrivateKey } from 'viem/accounts'
import { tempoModerato } from 'viem/chains'
import { Account, Actions, WebCryptoP256 } from 'viem/tempo'

const TOKEN = '0x20c0000000000000000000000000000000000001'
const chain = tempoModerato.extend({ feeToken: TOKEN })
const root = Account.fromSecp256k1(generatePrivateKey())
const payee = Account.fromSecp256k1(generatePrivateKey()).address
const c = createClient({ account: root, chain, transport: http() }).extend(publicActions)
await Actions.faucet.fundSync(c, { account: root.address })
const bal = await Actions.token.getBalance(c, { account: root.address, token: TOKEN })
console.log('getBalance ->', typeof bal, String(bal))
const key = Account.fromWebCryptoP256(await WebCryptoP256.createKeyPair(), { access: root })
await Actions.accessKey.authorizeSync(c, {
  accessKey: key, expiry: Math.floor(Date.now() / 1000) + 3600,
  limits: [{ token: TOKEN, limit: 10_000_000n, period: 86400 }],
  scopes: [{ address: TOKEN, selector: 'transfer(address,uint256)', recipients: [payee] }],
})
const arg = { account: root.address, accessKey: key }
const meta = await Actions.accessKey.getMetadata(c, arg).catch((e) => 'ERR ' + e.shortMessage)
console.log('getMetadata', JSON.stringify(meta, (_, v) => (typeof v === 'bigint' ? v.toString() : v)))
const lim = await Actions.accessKey.getRemainingLimit(c, { ...arg, token: TOKEN })
console.log('getRemainingLimit', JSON.stringify(lim, (_, v) => (typeof v === 'bigint' ? v.toString() : v)))
console.log('payee expected', payee, '| keyId', key.accessKeyAddress)
import { Abis, Addresses } from 'viem/tempo'
const calls = await c.readContract({ address: Addresses.accountKeychain, abi: Abis.accountKeychain, functionName: 'getAllowedCalls', args: [root.address, key.accessKeyAddress] })
console.log('getAllowedCalls', JSON.stringify(calls, (_, v) => (typeof v === 'bigint' ? v.toString() : v)))
const b = await Actions.token.getBalance(c, { account: root.address, token: TOKEN })
console.log('balance keys', Object.keys(b), JSON.stringify(b, (_, v) => (typeof v === 'bigint' ? v.toString() : v)))
