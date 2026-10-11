// One-time, testnet only. Generates the server keys, funds them from the faucet, mines and registers the desk master
// salt (TIP-1022 proof of work, can take minutes; the search continues past 2^32 if a range has no hit), and writes
// .env.local. Run: node scripts/setup-server-keys.mjs
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createClient, http, publicActions } from 'viem'
import { generatePrivateKey } from 'viem/accounts'
import { tempoModerato } from 'viem/chains'
import { Account, Actions, VirtualMaster } from 'viem/tempo'

const TOKEN = '0x20c0000000000000000000000000000000000001'
const chain = tempoModerato.extend({ feeToken: TOKEN })
const mk = (account) => createClient({ account, chain, transport: http('https://rpc.moderato.tempo.xyz') }).extend(publicActions)

const env = existsSync('.env.local') ? Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])) : {}
env.NEXT_PUBLIC_RPC_URL ||= 'https://rpc.moderato.tempo.xyz'
env.NEXT_PUBLIC_EXPLORER_URL ||= 'https://explore.moderato.tempo.xyz'
env.FEE_PAYER_PRIVATE_KEY ||= generatePrivateKey()
env.DESK_MASTER_PRIVATE_KEY ||= generatePrivateKey()
const save = () => writeFileSync('.env.local', Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n') + '\n')
save()

const feePayer = Account.fromSecp256k1(env.FEE_PAYER_PRIVATE_KEY)
const master = Account.fromSecp256k1(env.DESK_MASTER_PRIVATE_KEY)
console.log('fee payer', feePayer.address, '\ndesk master', master.address)
await Actions.faucet.fundSync(mk(feePayer), { account: feePayer.address })
await Actions.faucet.fundSync(mk(master), { account: master.address })

if (!env.DESK_MASTER_SALT) {
  const t0 = Date.now()
  let found
  for (let i = 0n; !found; i++) {
    console.log(`mining range ${i} (start ${i * 2n ** 32n}) ...`)
    found = await VirtualMaster.mineSaltAsync({ address: master.address, start: i * 2n ** 32n, count: 2 ** 32, workers: 4, onProgress: (p) => { const now = Date.now(); if (now - (globalThis.__last ?? 0) > 60_000) { globalThis.__last = now; console.log(new Date().toISOString().slice(11, 19), 'attempts', p.attempts) } } })
  }
  env.DESK_MASTER_SALT = found.salt
  env.DESK_MASTER_ID = found.masterId
  env.DESK_MASTER_ADDRESS = master.address
  save()
  console.log(`mined in ${Math.round((Date.now() - t0) / 1000)} s, masterId ${found.masterId}`)
}
const { transactionHash } = (await Actions.virtualAddress.registerMasterSync(mk(master), { salt: env.DESK_MASTER_SALT })).receipt ?? {}
console.log('registered master', transactionHash ?? '(already registered or no receipt)')
console.log('wrote .env.local (gitignored)')
