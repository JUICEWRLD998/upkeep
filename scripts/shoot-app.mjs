// Drives the real journey (real chain, real database) and photographs every key screen in both colour schemes.
// A = sender on desktop 1280x900 (virtual passkey), B = relative on a phone 390x844. Output: strategy/design/shots/app.
import { mkdirSync } from 'node:fs'
import { launch, sleep } from './lib/browser.mjs'

const BASE = process.argv[2] || 'http://localhost:3100'
const OUT = 'C:/Users/fadhm/Desktop/worldsfair-tempo/strategy/design/shots/app'
mkdirSync(OUT, { recursive: true })
const A = await launch(9400 + Math.floor(Math.random() * 250), true)
const B = await launch(9700 + Math.floor(Math.random() * 250), false)
const both = async (page, name, w, h) => {
  for (const scheme of ['dark', 'light']) {
    await page.resize(w, h, scheme)
    await sleep(500)
    await page.shot(`${OUT}/${name}-${scheme}.png`, true)
  }
}
const wait = async (page, text, ms = 60000) => { const ok = await page.waitText(text, ms); if (!ok) console.log('MISSING', text); return ok }
try {
  await A.resize(1280, 900, 'dark'); await B.resize(390, 844, 'dark')
  await A.goto(`${BASE}/`); await both(A, '01-landing', 1280, 900)
  await A.goto(`${BASE}/send`); await wait(A, 'Create my account with a passkey'); await both(A, '02-send-welcome', 1280, 900)
  await A.waitClick('Create my account with a passkey'); await wait(A, 'Your upkeep', 40000)
  await A.waitClick('Add test dollars'); await wait(A, 'Test dollars added', 40000)
  await both(A, '03-send-empty', 1280, 900)
  await A.fill('Relative name', 'Mummy'); await A.waitClick('Make invite link'); await sleep(600)
  const invite = await A.value('Invite link')
  await both(A, '04-send-invite', 1280, 900)
  await B.goto(invite); await wait(B, 'Step 1: send this link back', 40000); await both(B, '05-join', 390, 844)
  const back = await B.value('Link to send back')
  const waitHref = await B.js(`document.querySelector('a[href^="/home?k="]').getAttribute('href')`)
  await B.goto(`${BASE}${waitHref}`); await wait(B, 'Waiting for the sender to approve', 30000); await both(B, '06-home-waiting', 390, 844)

  await A.goto(back); await wait(A, 'Approve Mummy', 20000)
  await A.fill('Budget in dollars', '150')
  await A.fill('Desk payee name', 'Pharmacy'); await A.fill('Desk payee bank', 'GTBank'); await A.fill('Desk payee account name', 'Alade Pharmacy'); await A.fill('Desk payee last 4 digits', '4821')
  await A.waitClick('Add through the payout desk'); await wait(A, 'added at the payout desk', 30000)
  await A.fill('Desk payee name', 'Corona School'); await A.fill('Desk payee bank', 'Access'); await A.fill('Desk payee account name', 'Corona School Lagos'); await A.fill('Desk payee last 4 digits', '1177')
  await A.waitClick('Add through the payout desk'); await sleep(2500)
  await both(A, '07-approve', 1280, 900)
  await A.waitClick('Approve with my passkey'); await wait(A, 'key is active', 60000); await both(A, '08-approve-done', 1280, 900)
  const ready = await A.value('Link to send to the relative')

  await B.goto(ready); await wait(B, '$150.00', 40000); await both(B, '09-home-active', 390, 844)
  const payee = await B.js(`[...${B.find('Who to pay')}.options].find((o) => o.value)?.value`)
  await B.fill('Who to pay', payee); await B.fill('Amount', '40'); await B.waitClick('Pay'); await wait(B, 'PAID', 60000); await sleep(1500)
  await both(B, '10-home-paid', 390, 844)
  await B.fill('Other address', '0x' + 'ab'.repeat(20)); await B.fill('Amount', '1'); await B.waitClick('Try to pay'); await wait(B, 'CallNotAllowed', 40000); await sleep(1200)
  await both(B, '11-home-refused', 390, 844)

  await A.goto(`${BASE}/send`); await wait(A, 'PAID', 40000); await sleep(2500)
  await both(A, '12-send-live', 1280, 900)
  await A.goto(`${BASE}/desk`); await wait(A, 'Dollars (LIVE)', 30000); await wait(A, '$40.00', 60000); await both(A, '13-desk', 1280, 900)
  console.log('done')
} catch (e) {
  console.log('ERROR', e.message)
} finally {
  A.close(); B.close()
}
process.exit(0)
