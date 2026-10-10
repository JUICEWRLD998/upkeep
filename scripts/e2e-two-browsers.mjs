// Phase 2 exit check: two clean browsers, real chain. A = sender abroad (virtual passkey), B = relative at home.
// Usage: node scripts/e2e-two-browsers.mjs [baseUrl]   (default http://localhost:3100)
import { launch, sleep } from './lib/browser.mjs'

const BASE = process.argv[2] || 'http://localhost:3100'
const results = []
const t0 = Date.now()
const step = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'} [${Math.round((Date.now() - t0) / 1000)}s] ${name}${detail ? ' :: ' + detail : ''}`)
}

const A = await launch(9341, true)
const B = await launch(9342, false)
try {
  await A.goto(`${BASE}/send`)
  step('A opens /send as a stranger', await A.waitText('Create my account with a passkey'))
  await A.waitClick('Create my account with a passkey')
  step('A creates a passkey account', await A.waitText('Your upkeep', 40000))
  await A.waitClick('Add test dollars')
  step('A funds from the faucet', await A.waitText('Test dollars added', 40000))
  await A.fill('Relative name', 'Mummy')
  await A.waitClick('Make invite link')
  await sleep(500)
  const invite = await A.value('Invite link')
  step('A makes an invite link', !!invite && invite.includes('/join/'), invite?.slice(0, 60))

  await B.goto(invite)
  step('B opens the invite on a clean browser', await B.waitText('Step 1: send this link back', 40000))
  const back = await B.value('Link to send back')
  step('B gets a return link with only a public key', !!back && back.includes('/approve/'))

  const waitHref = await B.js(`document.querySelector('a[href^="/home?k="]').getAttribute('href')`)
  await B.goto(`${BASE}${waitHref}`)
  step('B sees "waiting" before the sender approves', await B.waitText('Waiting for the sender to approve', 30000))

  await A.goto(back)
  step('A sees the key to approve', await A.waitText('Approve Mummy', 20000))
  await A.fill('Budget in dollars', '10')
  await A.waitClick('Make a test address')
  await A.fill('Payee 1 name', 'Pharmacy')
  await A.waitClick('Approve with my passkey')
  step('A approves with the passkey (on chain)', await A.waitText('key is active', 60000))
  const ready = await A.value('Link to send to the relative')
  step('A gets a ready link', !!ready && ready.includes('/home?k='))

  await B.goto(ready)
  step('B sees the budget from the chain', await B.waitText('$10.00', 40000))
  const payee = await B.js(`[...document.querySelector('[aria-label="Who to pay"]').options].find((o) => o.value)?.value`)
  step('B sees the labelled payee', (await B.js(`document.querySelector('[aria-label="Who to pay"]').innerText`)).includes('Pharmacy'))
  await B.fill('Who to pay', payee)
  await B.fill('Amount', '4')
  await B.waitClick('Pay')
  step('B pays the pharmacy $4', await B.waitText('paid.', 60000))
  step('B budget is exactly $6.00 (fee sponsored)', await B.waitText('$6.00', 20000))

  const stranger = '0x' + 'ab'.repeat(20)
  await B.fill('Other address', stranger)
  await B.fill('Amount', '1')
  await B.waitClick('Try to pay')
  step('chain refuses a stranger', await B.waitText('CallNotAllowed', 40000))
  await B.fill('Amount', '7')
  await B.fill('Who to pay', payee)
  await B.waitClick('Pay')
  step('chain refuses over-limit', await B.waitText('SpendingLimitExceeded', 40000))

  await A.goto(`${BASE}/send`)
  step('A feed shows Mummy paid $4.00', await A.waitText('Mummy paid $4.00', 40000))
  await A.waitClick('Turn off')
  const offOk = await A.waitText('turned off', 60000)
  step('A turns the key off', offOk)
  if (!offOk) console.log('A page:', (await A.text()).slice(0, 900))

  step('B is told the key was turned off', await B.waitText('turned off by the sender', 30000))
  await B.fill('Other address', payee)
  await B.fill('Amount', '1')
  await B.waitClick('Try to pay')
  const okRev = await B.waitText('KeyAlreadyRevoked', 40000)
  step('chain refuses after revoke', okRev)
  if (!okRev) { const t = await B.text(); console.log('B page:', t.slice(t.indexOf('This session'), t.indexOf('This session') + 900)) }
} catch (e) {
  step('script error', false, String(e.message || e).slice(0, 300))
  console.log('A page:', (await A.text().catch(() => '')).slice(0, 500))
  console.log('B page:', (await B.text().catch(() => '')).slice(0, 500))
} finally {
  A.close(); B.close()
  const failed = results.filter((r) => !r.ok).length
  console.log(`\n${results.length - failed}/${results.length} steps passed in ${Math.round((Date.now() - t0) / 1000)} s`)
  process.exit(failed ? 1 : 0)
}
