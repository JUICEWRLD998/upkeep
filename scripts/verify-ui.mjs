// Phase 4 verification against a running production server: width ladder (320..1920), per-element overflow probe,
// axe-core accessibility, console errors. Real chain, real database. Planted controls run first on every page:
//  - overflow: an injected 2000px element must be reported, or the probe is blind and the page is not scored
//  - axe: an injected <img> without alt must raise image-alt, or axe did not run and the page is not scored
// Usage: node scripts/verify-ui.mjs [baseUrl]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { launch, sleep } from './lib/browser.mjs'

const BASE = process.argv[2] || 'http://localhost:3200'
const OUT = 'C:/Users/fadhm/Desktop/worldsfair-tempo/strategy/design'
const SHOTS = `${OUT}/shots/ladder`
mkdirSync(SHOTS, { recursive: true })
const AXE = readFileSync(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8')
const WIDTHS = [320, 375, 414, 768, 1024, 1280, 1440, 1920]
const report = { base: BASE, at: new Date().toISOString(), pages: [], failures: [] }

const A = await launch(9400 + Math.floor(Math.random() * 250), true)
const B = await launch(9700 + Math.floor(Math.random() * 250), false)

const OVERFLOW = `(() => { const cw = document.documentElement.clientWidth; let worst = 0, who = ''; for (const el of document.body.querySelectorAll('*')) { if (el.closest('svg')) continue; const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue; const over = r.right - cw; if (over > worst) { worst = over; who = el.tagName + '.' + String(el.className).slice(0, 50) } } return JSON.stringify({ worst: Math.round(worst), who }) })()`

async function probeOverflow(page) {
  // planted control first
  await page.js(`(() => { const d = document.createElement('div'); d.id = '__ctlOverflow'; d.style.cssText = 'position:absolute;left:0;top:0;width:4000px;height:4px'; document.body.appendChild(d) })()`)
  const ctl = JSON.parse(await page.js(OVERFLOW))
  await page.js(`document.getElementById('__ctlOverflow')?.remove()`)
  if (ctl.worst < 100) return { blind: true }
  return JSON.parse(await page.js(OVERFLOW))
}

async function probeAxe(page) {
  await page.js(AXE)
  await page.js(`(() => { const i = document.createElement('img'); i.id = '__ctlAxe'; i.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACw='; document.body.appendChild(i) })()`)
  const withCtl = JSON.parse(await page.js(`axe.run(document, { resultTypes: ['violations'] }).then((r) => JSON.stringify(r.violations.map((v) => v.id)))`))
  await page.js(`document.getElementById('__ctlAxe')?.remove()`)
  if (!withCtl.includes('image-alt')) return { blind: true }
  const real = JSON.parse(await page.js(`axe.run(document, { resultTypes: ['violations'] }).then((r) => JSON.stringify(r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.slice(0, 2).map((n) => n.target.join(' ')) }))))`))
  return { violations: real }
}

async function visit(page, name, url, w, h, scheme, opts = {}) {
  await page.resize(w, h, scheme)
  page.errors.length = 0
  await page.goto(url)
  await sleep(opts.settle ?? 1500)
  const file = `${SHOTS}/${name}-${w}-${scheme}.png`
  await page.shot(file)
  const o = await probeOverflow(page)
  const entry = { name, w, scheme, overflow: o, consoleErrors: [...page.errors] }
  if (opts.axe) entry.axe = await probeAxe(page)
  if (o.blind) report.failures.push(`${name}@${w}: overflow probe blind`)
  else if (o.worst > 0) report.failures.push(`${name}@${w} ${scheme}: overflows by ${o.worst}px (${o.who})`)
  if (entry.axe?.blind) report.failures.push(`${name}@${w}: axe blind`)
  for (const v of entry.axe?.violations ?? []) if (['serious', 'critical'].includes(v.impact)) report.failures.push(`${name}@${w} ${scheme}: axe ${v.impact} ${v.id} ${v.nodes.join(' | ')}`)
  if (entry.consoleErrors.length) report.failures.push(`${name}@${w}: console errors ${entry.consoleErrors.join(' / ').slice(0, 200)}`)
  report.pages.push(entry)
}

try {
  // ---- set up real state: a sender with a key and a payment, a relative with a key ----
  await A.resize(1280, 900, 'dark'); await B.resize(390, 844, 'dark')
  await A.goto(`${BASE}/send`)
  await A.waitClick('Create my account with a passkey'); await A.waitText('Your upkeep', 40000)
  await A.waitClick('Add test dollars'); await A.waitText('Test dollars added', 40000)
  await A.fill('Relative name', 'Mummy'); await A.waitClick('Make invite link'); await sleep(600)
  const invite = await A.value('Invite link')
  await B.goto(invite); await B.waitText('Step 1: send this link back', 40000)
  const back = await B.value('Link to send back')
  await A.goto(back); await A.waitText('Approve Mummy', 20000)
  await A.fill('Budget in dollars', '150')
  await A.fill('Desk payee name', 'Pharmacy'); await A.fill('Desk payee bank', 'GTBank'); await A.fill('Desk payee account name', 'Alade Pharmacy'); await A.fill('Desk payee last 4 digits', '4821')
  await A.waitClick('Add through the payout desk'); await A.waitText('added at the payout desk', 30000)
  await A.waitClick('Approve with my passkey'); await A.waitText('key is active', 60000)
  const ready = await A.value('Link to send to the relative')
  await B.goto(ready); await B.waitText('$150.00', 40000)
  const payee = await B.js(`[...${B.find('Who to pay')}.options].find((o) => o.value)?.value`)
  await B.fill('Who to pay', payee); await B.fill('Amount', '40'); await B.waitClick('Pay'); await B.waitText('PAID', 60000)
  await A.goto(`${BASE}/send`); await A.waitText('PAID', 40000)

  // ---- the ladder ----
  for (const w of WIDTHS) {
    const h = w < 700 ? 800 : 900
    await visit(A, 'landing', `${BASE}/`, w, h, 'dark', { axe: w === 1280 || w === 375 })
    await visit(A, 'send', `${BASE}/send`, w, h, 'dark', { axe: w === 1280 || w === 375, settle: 3000 })
    await visit(A, 'approve', back, w, h, 'dark', { axe: w === 1280 || w === 375 })
    await visit(A, 'desk', `${BASE}/desk`, w, h, 'dark', { axe: w === 1280 || w === 375, settle: 3500 })
    await visit(B, 'home', ready, w, h, 'dark', { axe: w === 1280 || w === 375, settle: 2500 })
    await visit(B, 'join', invite, w, h, 'dark', { axe: w === 1280 || w === 375 })
  }
  // light theme at a phone and a desktop width
  for (const w of [375, 1280]) {
    await visit(A, 'landing', `${BASE}/`, w, 900, 'light', { axe: true })
    await visit(A, 'send', `${BASE}/send`, w, 900, 'light', { axe: true, settle: 3000 })
    await visit(A, 'desk', `${BASE}/desk`, w, 900, 'light', { axe: true, settle: 3500 })
    await visit(B, 'home', ready, w, 900, 'light', { axe: true, settle: 2500 })
  }
} catch (e) {
  report.failures.push('script error: ' + (e.message || e))
} finally {
  A.close(); B.close()
  writeFileSync(`${OUT}/verify-report.json`, JSON.stringify(report, null, 1))
  const axeAll = report.pages.flatMap((p) => (p.axe?.violations ?? []).map((v) => `${p.name}@${p.w}/${p.scheme}: ${v.impact} ${v.id}`))
  console.log(`pages measured: ${report.pages.length}`)
  console.log(`overflow clean on: ${report.pages.filter((p) => !p.overflow.blind && p.overflow.worst === 0).length}/${report.pages.length}`)
  console.log(`axe violations (all impacts): ${axeAll.length}`)
  for (const l of [...new Set(axeAll)].slice(0, 20)) console.log('  ' + l)
  console.log(report.failures.length ? 'FAILURES:\n' + report.failures.map((f) => '  ' + f).join('\n') : 'no failures')
}
process.exit(0)

