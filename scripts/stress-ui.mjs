// `break` pass: the core components under their worst real cases (long names, a huge budget, long bank text, many
// slips, a very narrow phone). Real chain. Reports overflow per element and writes screenshots. Planted control as usual.
import { mkdirSync } from 'node:fs'
import { launch, sleep } from './lib/browser.mjs'

const BASE = process.argv[2] || 'http://localhost:3200'
const OUT = 'C:/Users/fadhm/Desktop/worldsfair-tempo/strategy/design/shots/stress'
mkdirSync(OUT, { recursive: true })
const OVER = `(() => { const cw = document.documentElement.clientWidth; let worst = 0, who = ''; for (const el of document.body.querySelectorAll('*')) { if (el.closest('svg')) continue; const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue; const o = r.right - cw; if (o > worst) { worst = o; who = el.tagName + '.' + String(el.className).slice(0, 50) } } return JSON.stringify({ worst: Math.round(worst), who }) })()`
const A = await launch(9400 + Math.floor(Math.random() * 250), true)
const B = await launch(9700 + Math.floor(Math.random() * 250), false)
const fails = []
async function over(page, name) {
  await page.js(`(() => { const d = document.createElement('div'); d.id = '__ctl'; d.style.cssText = 'position:absolute;left:0;top:0;width:4000px;height:4px'; document.body.appendChild(d) })()`)
  const ctl = JSON.parse(await page.js(OVER)); await page.js(`document.getElementById('__ctl')?.remove()`)
  if (ctl.worst < 100) { fails.push(`${name}: overflow probe blind`); return }
  const r = JSON.parse(await page.js(OVER))
  console.log(`${r.worst === 0 ? 'PASS' : 'FAIL'} ${name}: overflow ${r.worst}px ${r.who}`)
  if (r.worst > 0) fails.push(`${name}: overflow ${r.worst}px (${r.who})`)
}
const LONG = 'Chukwuemeka Oluwaseun Adebayo-Nwosu Jr'
try {
  await A.resize(320, 700, 'dark'); await B.resize(320, 700, 'dark')
  await A.goto(`${BASE}/send`)
  await A.waitClick('Create my account with a passkey'); await A.waitText('Your upkeep', 40000)
  await A.waitClick('Add test dollars'); await A.waitText('Test dollars added', 40000)
  await A.fill('Relative name', LONG); await A.waitClick('Make invite link'); await sleep(600)
  const invite = await A.value('Invite link')
  await B.goto(invite); await B.waitText('Step 1: send this link back', 40000)
  const back = await B.value('Link to send back')
  await A.goto(back); await A.waitText('Approve', 20000)
  await A.fill('Budget in dollars', '999999999.99')
  await A.fill('Desk payee name', 'The Reverend Mother Mary Slessor Memorial Pharmacy Ltd')
  await A.fill('Desk payee bank', 'First City Monument Bank of Nigeria plc and Co')
  await A.fill('Desk payee account name', 'Alhaji Doctor Chief Obafemi Olawale Adewale Ogunbanjo')
  await A.fill('Desk payee last 4 digits', '0042')
  await A.waitClick('Add through the payout desk'); await A.waitText('added at the payout desk', 30000)
  await sleep(500); await over(A, 'approve (long names, huge budget) @320'); await A.shot(`${OUT}/approve-320.png`, true)
  await A.waitClick('Approve with my passkey'); await A.waitText('key is active', 60000)
  const ready = await A.value('Link to send to the relative')
  await B.goto(ready); await B.waitText('999,999,999.99', 40000); await sleep(1000)
  await over(B, 'home (huge budget) @320'); await B.shot(`${OUT}/home-320.png`, true)
  const payee = await B.js(`[...${B.find('Who to pay')}.options].find((o) => o.value)?.value`)
  // many slips: three real payments, plus a refusal with the longest real chain text
  for (const amt of ['1', '2', '3']) { await B.fill('Who to pay', payee); await B.fill('Amount', amt); await B.waitClick('Pay'); await B.waitText('PAID', 60000); await sleep(1200) }
  await B.fill('Other address', '0x' + 'cd'.repeat(20)); await B.fill('Amount', '1'); await B.waitClick('Try to pay'); await B.waitText('CallNotAllowed', 40000); await sleep(1200)
  await over(B, 'home (4 slips, long payee, refusal) @320'); await B.shot(`${OUT}/home-slips-320.png`, true)
  await A.goto(`${BASE}/send`); await A.waitText('PAID', 40000); await sleep(3000)
  await over(A, 'send (long name, huge budget, 3 slips) @320'); await A.shot(`${OUT}/send-320.png`, true)
  await A.resize(1280, 900, 'dark'); await sleep(800); await over(A, 'send @1280'); await A.shot(`${OUT}/send-1280.png`, true)
  await A.goto(`${BASE}/desk`); await A.waitText('Dollars (LIVE)', 30000); await sleep(3500)
  await A.resize(320, 700, 'dark'); await sleep(500); await over(A, 'desk (long bank text) @320'); await A.shot(`${OUT}/desk-320.png`, true)
} catch (e) { fails.push('script error: ' + e.message) } finally {
  A.close(); B.close()
  console.log(fails.length ? 'FAILURES:\n' + fails.map((f) => '  ' + f).join('\n') : 'stress pass: no overflow, no blind probes')
}
process.exit(0)
