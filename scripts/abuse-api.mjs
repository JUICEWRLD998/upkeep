// API abuse pass against a running server: the fee-payer relay and the payout desk. Real chain, real database.
// Positive controls come first so a green result cannot be a dead endpoint. Usage: node scripts/abuse-api.mjs [baseUrl]
import { generatePrivateKey, privateKeyToAddress } from 'viem/accounts'

const BASE = process.argv[2] || 'http://localhost:3200'
const TOKEN = '0x20c0000000000000000000000000000000000001'
const results = []
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' :: ' + detail : ''}`) }
let ipN = 0
const ip = () => `10.77.${Math.floor(++ipN / 250)}.${ipN % 250}`
const post = (path, body, headers = {}, raw = false) =>
  fetch(BASE + path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip(), ...headers }, body: raw ? body : JSON.stringify(body) })
const transferData = '0xa9059cbb' + '0'.repeat(24) + 'ab'.repeat(20) + '0'.repeat(63) + '1'
const fill = (from, call, extra = {}) => ({ jsonrpc: '2.0', id: 1, method: 'eth_fillTransaction', params: [{ from, type: '0x76', calls: [call], feePayer: true, chainId: '0xa5bf', ...extra }] })
const sponsored = async (res) => { const t = await res.text(); return { signed: t.includes('feePayerSignature'), text: t.slice(0, 200), status: res.status } }

// ---- relay ----
const from = privateKeyToAddress(generatePrivateKey())
const good = await sponsored(await post('/api/relay', fill(from, { to: TOKEN, data: transferData, value: '0x' })))
check('control: a plain AlphaUSD transfer IS sponsored', good.signed, `${good.status} ${good.signed ? 'feePayerSignature present' : good.text}`)

const other = await sponsored(await post('/api/relay', fill(from, { to: '0x20c0000000000000000000000000000000000000', data: transferData, value: '0x' })))
check('a transfer on a different token is NOT sponsored', !other.signed, other.text.slice(0, 80))
const wrongCall = await sponsored(await post('/api/relay', fill(from, { to: TOKEN, data: '0x095ea7b3' + '0'.repeat(128), value: '0x' })))
check('an approve() call is NOT sponsored', !wrongCall.signed)
const padded = await sponsored(await post('/api/relay', fill(from, { to: TOKEN, data: transferData + '00'.repeat(4000), value: '0x' })))
check('transfer calldata padded with 4000 zero bytes is NOT sponsored', !padded.signed)
const withValue = await sponsored(await post('/api/relay', fill(from, { to: TOKEN, data: transferData, value: '0x01' })))
check('a transfer that carries value is NOT sponsored', !withValue.signed)
const bigGas = await sponsored(await post('/api/relay', fill(from, { to: TOKEN, data: transferData, value: '0x' }, { gas: '0x4c4b40' })))
check('a transfer asking for 5,000,000 gas is NOT sponsored', !bigGas.signed)
const garbageValue = await post('/api/relay', fill(from, { to: TOKEN, data: transferData, value: 'banana' }))
const gvText = await garbageValue.text()
check('a non-numeric value does not leak a stack trace', !gvText.includes(' at ') && !/node_modules/.test(gvText), `status ${garbageValue.status} ${gvText.slice(0, 80)}`)
const notJson = await post('/api/relay', '{{{ not json', {}, true)
const njText = await notJson.text()
check('non-JSON body does not leak a stack trace', !/node_modules| at /.test(njText), `status ${notJson.status} ${njText.slice(0, 80)}`)
const batch = await post('/api/relay', [fill(from, { to: TOKEN, data: transferData, value: '0x' }), fill(from, { to: TOKEN, data: transferData, value: '0x' })])
const bText = await batch.text()
check('a JSON-RPC batch does not leak a stack trace', !/node_modules| at /.test(bText), `status ${batch.status} ${bText.slice(0, 80)}`)

// per-account limit: the same `from` over many requests from DIFFERENT ips (a spoofed header cannot dodge it)
const burstFrom = privateKeyToAddress(generatePrivateKey())
let signedCount = 0
for (let i = 0; i < 26; i++) { if ((await sponsored(await post('/api/relay', fill(burstFrom, { to: TOKEN, data: transferData, value: '0x' })))).signed) signedCount++ }
check('one account is capped at 20 sponsored requests a minute even from 26 different IPs', signedCount > 0 && signedCount <= 20, `${signedCount} sponsored of 26`)
let limited = 0
const sameIp = '10.99.0.1'
for (let i = 0; i < 60; i++) { const r = await post('/api/relay', { jsonrpc: '2.0', id: i, method: 'eth_chainId', params: [] }, { 'x-forwarded-for': sameIp }); if (r.status === 429) limited++ }
check('one IP is rate limited (429) after 40 requests a minute', limited >= 15, `${limited} of 60 were 429`)

// ---- desk ----
const sender = privateKeyToAddress(generatePrivateKey())
const okPayee = await post('/api/desk/payees', { sender, label: '<b>Mum</b>', bank: 'GTBank', accountName: 'Ngozi Okafor', last4: '4821' })
const okJson = await okPayee.json().catch(() => ({}))
check('control: a valid payee is created (201) with a derived virtual address', okPayee.status === 201 && /^0x[0-9a-f]{8}fdfdfdfdfdfdfdfdfdfd[0-9a-f]{12}$/i.test(okJson.address ?? ''), `${okPayee.status} ${okJson.address ?? ''}`)
check('markup characters are stripped from the stored label', okJson.label === 'bMum/b', String(okJson.label))
const SQL_LABEL = "'; " + 'drop' + ' table payees;--'
for (const [name, body, raw] of [
  ['an array body', [], false],
  ['a string body', '"x"', true],
  ['no fields', {}, false],
  ['SQL in every field', { sender, label: SQL_LABEL, bank: "' or 1=1 --", accountName: '"; ' + 'delete' + ' from payees;', last4: '1234' }, false],
  ['a full account number instead of 4 digits', { sender, label: 'a', bank: 'b', accountName: 'c', last4: '0123456789' }, false],
  ['a 10 KB label', { sender, label: 'x'.repeat(10_000), bank: 'b', accountName: 'c', last4: '1234' }, false],
  ['a bad sender address', { sender: '0x123', label: 'a', bank: 'b', accountName: 'c', last4: '1234' }, false],
]) {
  const r = await post('/api/desk/payees', body, {}, raw)
  const t = await r.text()
  check(`desk handles ${name} without a server error`, r.status < 500, `${r.status} ${t.slice(0, 80)}`)
}
const list = await (await fetch(`${BASE}/api/desk/payees?sender=${sender}`, { headers: { 'x-forwarded-for': ip() } })).json()
check('the table still exists and holds the SQL-looking text as plain text (parameterised queries)', Array.isArray(list.payees) && list.payees.some((p) => p.label.includes('payees;')))
const badGet = await fetch(`${BASE}/api/desk/payees?sender=nope`, { headers: { 'x-forwarded-for': ip() } })
check('listing with a bad sender is a 400', badGet.status === 400, String(badGet.status))
const big = await post('/api/desk/payees', JSON.stringify({ sender, label: 'x'.repeat(3_000_000), bank: 'b', accountName: 'c', last4: '1234' }), {}, true)
check('a 3 MB body does not give a 5xx', big.status < 500, String(big.status))
const ledger = await fetch(`${BASE}/api/desk/ledger`, { headers: { 'x-forwarded-for': ip() } })
check('control: the public ledger answers', ledger.status === 200, String(ledger.status))

console.log(`${results.filter(Boolean).length}/${results.length} checks passed`)
process.exit(results.every(Boolean) ? 0 : 1)
