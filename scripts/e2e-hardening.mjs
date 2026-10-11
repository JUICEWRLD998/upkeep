// Phase 5: what a judge does with their own input. Cold starts, bad links, bad amounts, a double click, the relay and the
// network failing mid-payment, a reload, a lost phone, hostile names, and a budget refilling while the page is open.
// Real chain, real database. Usage: node scripts/e2e-hardening.mjs [baseUrl]
import { launch, sleep } from './lib/browser.mjs'

const BASE = process.argv[2] || 'http://localhost:3200'
const port = (base) => base + Math.floor(Math.random() * 250)
const results = []
const t0 = Date.now()
const step = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'} [${Math.round((Date.now() - t0) / 1000)}s] ${name}${detail ? ' :: ' + detail : ''}`)
}
const count = (text, needle) => text.split(needle).length - 1

async function approveFlow(A, B, name, budget, periodValue) {
  await A.goto(`${BASE}/send`)
  await A.fill('Relative name', name); await A.waitClick('Make invite link'); await sleep(600)
  const invite = await A.value('Invite link')
  await B.goto(invite); await B.waitText('Step 1: send this link back', 40000)
  const back = await B.value('Link to send back')
  await A.goto(back); await A.waitText('Approve', 20000)
  await A.fill('Budget in dollars', String(budget))
  if (periodValue) await A.fill('Refills', periodValue)
  await A.fill('Payee 1 name', 'Pharmacy'); await A.waitClick('Make a test address')
  await A.waitClick('Approve with my passkey'); await A.waitText('key is active', 60000)
  const ready = await A.value('Link to send to the relative')
  await B.goto(ready); await B.waitText(`$${Number(budget).toFixed(2)}`, 40000)
  const payee = await B.js(`[...${B.find('Who to pay')}.options].find((o) => o.value)?.value`)
  return { invite, back, ready, payee }
}
const pay = async (B, payee, amount) => { await B.fill('Who to pay', payee); await B.fill('Amount', String(amount)); await B.waitClick('Pay') }

const A = await launch(port(9400), true)
const B = await launch(port(9700), false)
const C = await launch(port(9950), false)
let B2 = null
try {
  for (const p of [A, B, C]) await p.resize(1280, 900, 'dark')

  // ---- cold starts: a stranger opening any URL ----
  await C.goto(`${BASE}/home`)
  step('/home with no key says so and offers a way out', await C.waitText('No key on this phone', 20000))
  await C.goto(`${BASE}/home?k=zzzz`)
  step('/home?k=garbage says the same, no crash', await C.waitText('No key on this phone', 20000))
  await C.goto(`${BASE}/join/garbage`)
  step('/join/garbage explains the invite did not work', await C.waitText('This invite did not work', 20000))
  await C.goto(`${BASE}/approve/garbage`)
  step('/approve/garbage explains the link did not work', await C.waitText('This link did not work', 20000))
  await C.goto(`${BASE}/definitely-not-a-page`)
  step('an unknown URL lands on the designed not-found page', await C.waitText('That page does not exist', 20000))

  // ---- set up a sender and a relative (hostile name on purpose) ----
  await A.goto(`${BASE}/send`)
  await A.waitClick('Create my account with a passkey'); await A.waitText('Your upkeep', 40000)
  await A.waitClick('Add test dollars'); await A.waitText('Test dollars added', 40000)
  const flow = await approveFlow(A, B, '<img src=x onerror=window.__xss=1>Mum', 10, null)
  step('a hostile relative name is shown as plain text and never runs', (await A.js('window.__xss === undefined')) && (await B.js('window.__xss === undefined')))
  await C.goto(flow.back)
  step('an approval link opened on a device with no sender account explains why it cannot approve', await C.waitText('no sender account', 20000))
  await C.goto(flow.ready)
  step('an upkeep link opened on another device says that phone has no key (keys never travel)', await C.waitText('No key on this phone', 20000))

  // ---- bad amounts ----
  const before = await B.text()
  const cases = [['0', 'more than zero'], ['-5', 'Enter an amount'], ['abc', 'Enter an amount'], ['1.0000001', 'At most 6 decimal places'], ['1e3', 'Enter an amount']]
  for (const [bad, msg] of cases) {
    await B.fill('Who to pay', flow.payee); await B.fill('Amount', bad); await B.waitClick('Pay')
    step(`amount "${bad}" is refused in plain words before anything is sent`, await B.waitText(msg, 8000))
  }
  step('no bad amount produced a slip or moved the budget', !(await B.text()).includes('PAID') && (await B.text()).includes('$10.00') && count(before, 'PAID') === 0)

  // ---- double click ----
  await B.fill('Who to pay', flow.payee); await B.fill('Amount', '4')
  await B.js(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'Pay'); b.click(); b.click(); b.click(); return true })()`)
  await B.waitText('PAID', 60000); await sleep(2500)
  const t1 = await B.text()
  step('three rapid clicks on Pay make exactly one payment', count(t1, 'PAID') === 1 && t1.includes('$6.00'), `PAID x${count(t1, 'PAID')}`)

  // ---- the relay is down mid-payment ----
  await B.send('Network.enable')
  await B.send('Network.setBlockedURLs', { urls: ['*/api/relay*'] })
  await pay(B, flow.payee, 1)
  const failed = await B.waitText('could not complete', 60000)
  await sleep(1500)
  const t2 = await B.text()
  step('with the relay unreachable the person is told, nothing is paid and the budget is unchanged', failed && count(t2, 'PAID') === 1 && t2.includes('$6.00'))
  await B.send('Network.setBlockedURLs', { urls: [] })
  await pay(B, flow.payee, 1)
  await B.waitText('$5.00', 60000); await sleep(1500)
  const t3 = await B.text()
  step('after the relay is back, retrying works and charges once ($5.00 left, two PAID)', t3.includes('$5.00') && count(t3, 'PAID') === 2, `PAID x${count(t3, 'PAID')}`)

  // ---- the sender's network drops while asking for test dollars ----
  await A.goto(`${BASE}/send`); await A.waitText('Your upkeep', 30000)
  await A.send('Network.enable')
  await A.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
  await A.waitClick('Add test dollars')
  step('offline, the faucet button explains what happened instead of hanging', await A.waitText('faucet said no', 40000))
  await A.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
  await sleep(1500)
  await A.waitClick('Add test dollars')
  step('back online, the same button works', await A.waitText('Test dollars added', 40000))

  // ---- reload keeps the key ----
  await B.goto(flow.ready)
  step('after a reload the relative still has the key and the live budget', await B.waitText('$5.00', 40000))
  await pay(B, flow.payee, 1)
  step('and can still pay ($4.00 left)', await B.waitText('$4.00', 60000))

  // ---- lost phone: revoke, re-invite, the new device works ----
  await A.goto(`${BASE}/send`); await A.waitText('Turn off', 30000)
  await A.waitClick('Turn off'); await A.waitText('turned off', 60000)
  step('the old phone is told its key was turned off', await B.waitText('turned off by the sender', 30000))
  B2 = await launch(port(9400), false); await B2.resize(390, 844, 'dark')
  const flow2 = await approveFlow(A, B2, 'Mummy', 10, null)
  await pay(B2, flow2.payee, 2)
  step('lost phone: a new invite gives a new device a working key', await B2.waitText('PAID', 60000))

  // ---- the budget refills while the page is open ----
  const flow3 = await approveFlow(A, C, 'Daddy', 10, 'test')
  await pay(C, flow3.payee, 10)
  step('the whole budget can be spent ($0.00 left)', await C.waitText('$0.00', 60000))
  step('after about two minutes the budget refills with no reload ($10.00 again)', await C.waitText('$10.00', 170000))
} catch (e) {
  step('script error', false, String(e.message || e).slice(0, 300))
} finally {
  for (const p of [A, B, C, B2]) p?.close()
  const failed = results.filter((r) => !r.ok).length
  console.log(`\n${results.length - failed}/${results.length} steps passed in ${Math.round((Date.now() - t0) / 1000)} s`)
}
process.exit(0)
