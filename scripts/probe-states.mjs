import { createClient, http, publicActions } from 'viem'
import { generatePrivateKey } from 'viem/accounts'
import { tempoModerato } from 'viem/chains'
import { Abis, Account, Actions, Addresses, WebCryptoP256 } from 'viem/tempo'
const TOKEN = '0x20c0000000000000000000000000000000000001'
const chain = tempoModerato.extend({ feeToken: TOKEN })
const root = Account.fromSecp256k1(generatePrivateKey())
const c = createClient({ account: root, chain, transport: http() }).extend(publicActions)
await Actions.faucet.fundSync(c, { account: root.address })
const key = Account.fromWebCryptoP256(await WebCryptoP256.createKeyPair(), { access: root })
const id = key.accessKeyAddress.replace(/^0x/, '')
const addr = (await import('viem')).getAddress(key.accessKeyAddress)
const probe = async (label) => {
  const out = {}
  for (const [n, fn] of Object.entries({
    meta: () => Actions.accessKey.getMetadata(c, { account: root.address, accessKey: addr }),
    lim: () => Actions.accessKey.getRemainingLimit(c, { account: root.address, accessKey: addr, token: TOKEN }),
    calls: () => c.readContract({ address: Addresses.accountKeychain, abi: Abis.accountKeychain, functionName: 'getAllowedCalls', args: [root.address, addr] }),
  })) {
    try { out[n] = JSON.stringify(await fn(), (_, v) => (typeof v === 'bigint' ? v.toString() : v)) } catch (e) { out[n] = 'THROWS ' + (e.shortMessage || e.message).slice(0, 80) }
  }
  console.log(label, out)
}
await probe('UNAPPROVED')
await Actions.accessKey.authorizeSync(c, { accessKey: key, expiry: Math.floor(Date.now() / 1000) + 600, limits: [{ token: TOKEN, limit: 5_000_000n, period: 0 }], scopes: [{ address: TOKEN, selector: 'transfer(address,uint256)', recipients: [root.address] }] })
await probe('ACTIVE')
await Actions.accessKey.revokeSync(c, { accessKey: addr })
await probe('REVOKED')
