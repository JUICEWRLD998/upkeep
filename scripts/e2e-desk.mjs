// Phase 3 exit check: a payment to a bank payee appears on the chain, on the sender's feed, and as a SIMULATED
// naira payout row on /desk, all from one transaction. Two clean browsers, real chain, real database.
// Usage: node scripts/e2e-desk.mjs [baseUrl]
import { launch, sleep } from './lib/browser.mjs'

const BASE = process.argv[2] || 'http://localhost:3100'
const results = []
const t0 = Date.now()
const step = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'} [${Math.round((Date.now() - t0) / 1000)}s] ${name}${detail ? ' :: ' + detail : ''}`)
}

const A = await launch(9400 + Math.floor(Math.random() * 250), true)
const B = await launch(9700 + Math.floor(Math.random() * 250), false)
try {
  await A.goto(`${BASE}/send`)
  await A.waitClick('Create my account with a passkey')
  step('A creates a passkey account', await A.waitText('Your upkeep', 40000))
  await A.waitClick('Add test dollars')
  step('A funds from the faucet', await A.waitText('Test dollars added', 40000))
  await A.fill('Relative name', 'Mummy')
  await A.waitClick('Make invite link')
  await sleep(500)
  const invite = await A.value('Invite link')
  await B.goto(invite)
  step('B makes a key from the invite', await B.waitText('Step 1: send this link back', 40000))
  const back = await B.value('Link to send back')

  await A.goto(back)
  step('A sees the key to approve', await A.waitText('Approve Mummy', 20000))
  await A.fill('Budget in dollars', '10')
  await A.fill('Desk payee name', 'Mummy GTB')
  await A.fill('Desk payee bank', 'GTBank')
  await A.fill('Desk payee account name', 'Ngozi Okafor')
  await A.fill('Desk payee last 4 digits', '4821')
  await A.waitClick('Add through the payout desk')
  step('payout desk creates the payee', await A.waitText('added at the payout desk', 30000))
  const addr = await A.value('Payee 1 address')
  step('the payee address is a virtual address from the desk master', /^0x[0-9a-fA-F]{8}fdfdfdfdfdfdfdfdfdfd[0-9a-fA-F]{12}$/.test(addr || ''), addr)

  // a bad last-4 is refused by the desk, not silently accepted
  await A.fill('Desk payee last 4 digits', '12')
  await A.waitClick('Add through the payout desk')
  step('desk refuses a payee without 4 digits', await A.waitText('last 4 digits', 20000))

  await A.waitClick('Approve with my passkey')
  step('A approves with the passkey', await A.waitText('key is active', 60000))
  const ready = await A.value('Link to send to the relative')

  await B.goto(ready)
  step('B sees the bank payee by name', await B.waitText('Mummy GTB (GTBank', 40000))
  const payee = await B.js(`[...document.querySelector('[aria-label="Who to pay"]').options].find((o) => o.value)?.value`)
  await B.fill('Who to pay', payee)
  await B.fill('Amount', '4')
  await B.waitClick('Pay')
  step('B pays the bank payee $4', await B.waitText('paid.', 60000))
  step('budget is exactly $6.00', await B.waitText('$6.00', 20000))

  await A.goto(`${BASE}/send`)
  step('A feed shows the payment to the bank payee', await A.waitText('Mummy paid $4.00 to Mummy GTB', 40000))

  await B.goto(`${BASE}/desk`)
  step('/desk shows the real dollar payment', (await B.waitText('Dollars (LIVE)', 30000)) && (await B.waitText('$4.00', 60000)))
  const desk = await B.text()
  step('/desk row names the payee and bank', desk.includes('Mummy GTB') && desk.includes('GTBank') && desk.includes('4821'))
  step('/desk labels the naira column SIMULATED with a naira figure', desk.includes('SIMULATED') && /Pay ₦[\d,]+\.\d\d/.test(desk), (desk.match(/Pay ₦[\d,]+\.\d\d/) || [''])[0])
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
