// Signature moment ("the slip lands") on the rendered page: a filmstrip, a frame-time probe with a planted control,
// and a reduced-motion run that must end in the same state. Real chain. Usage: node scripts/filmstrip.mjs [baseUrl]
import { mkdirSync, writeFileSync, readdirSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { launch, sleep } from './lib/browser.mjs'

const BASE = process.argv[2] || 'http://localhost:3200'
const OUT = 'C:/Users/fadhm/Desktop/worldsfair-tempo/strategy/design/filmstrip'
const FFMPEG = 'C:/Users/fadhm/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.1-full_build/bin/ffmpeg.exe'
mkdirSync(OUT, { recursive: true })
for (const f of readdirSync(OUT)) rmSync(`${OUT}/${f}`, { force: true })
const results = []
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' :: ' + detail : ''}`) }

const A = await launch(9400 + Math.floor(Math.random() * 250), true)
const B = await launch(9700 + Math.floor(Math.random() * 250), false)
const scaleY = () => A.js(`(() => { const r = document.querySelector('svg[role=img] rect[height="136"][fill]'); if (!r) return null; const m = new DOMMatrix(getComputedStyle(r).transform); return Number(m.d.toFixed(3)) })()`)
try {
  await A.resize(1280, 900, 'dark'); await B.resize(390, 844, 'dark')
  await A.goto(`${BASE}/send`)
  await A.waitClick('Create my account with a passkey'); await A.waitText('Your upkeep', 40000)
  await A.waitClick('Add test dollars'); await A.waitText('Test dollars added', 40000)
  await A.fill('Relative name', 'Mummy'); await A.waitClick('Make invite link'); await sleep(600)
  const invite = await A.value('Invite link')
  await B.goto(invite); await B.waitText('Step 1: send this link back', 40000)
  const back = await B.value('Link to send back')
  await A.goto(back); await A.waitText('Approve Mummy', 20000)
  await A.fill('Budget in dollars', '100')
  await A.fill('Payee 1 name', 'Pharmacy'); await A.waitClick('Make a test address')
  await A.waitClick('Approve with my passkey'); await A.waitText('key is active', 60000)
  const ready = await A.value('Link to send to the relative')
  await B.goto(ready); await B.waitText('$100.00', 40000)
  const payee = await B.js(`[...${B.find('Who to pay')}.options].find((o) => o.value)?.value`)
  await A.goto(`${BASE}/send`); await A.waitText('$100.00', 40000); await sleep(3000)
  check('envelope starts full', (await scaleY()) === 1, String(await scaleY()))

  // ---- run 1: full motion ----
  const frames = []
  A.on('Page.screencastFrame', (p) => { frames.push({ t: p.metadata.timestamp, data: p.data }); A.send('Page.screencastFrameAck', { sessionId: p.sessionId }) })
  await A.js(`window.__arrive = null; window.__ft = []; new MutationObserver(() => { if (window.__arrive === null && /PAID/.test(document.body.innerText)) window.__arrive = Date.now() / 1000 }).observe(document.body, { childList: true, subtree: true }); let last = performance.now(); (function loop() { const n = performance.now(); window.__ft.push(n - last); last = n; requestAnimationFrame(loop) })()`)
  // planted control: a frame that busy-waits 80 ms must show up as a long frame, or the sampler is blind
  await A.js(`new Promise((r) => requestAnimationFrame(() => { const s = performance.now(); while (performance.now() - s < 80) {} r(true) }))`)
  await sleep(400)
  const ctlLong = await A.js(`window.__ft.filter((x) => x > 33).length`)
  check('frame sampler control registers an 80 ms frame', ctlLong >= 1, `long frames: ${ctlLong}`)
  await A.js(`window.__ft.length = 0`)
  await A.send('Page.startScreencast', { format: 'jpeg', quality: 70, everyNthFrame: 1 })
  await B.fill('Who to pay', payee); await B.fill('Amount', '20'); await B.waitClick('Pay')
  let arrive = null
  for (let i = 0; i < 120 && !arrive; i++) { arrive = await A.js('window.__arrive'); await sleep(250) }
  await sleep(2200)
  await A.send('Page.stopScreencast')
  const ft = await A.js(`JSON.stringify(window.__ft)`)
  check('the slip arrived on the sender feed', !!arrive)
  const endScale = await scaleY()
  check('envelope level fell to 80%', endScale === 0.8, String(endScale))
  const txt1 = await A.text()
  check('end state is text: $80.00 left and a PAID slip', txt1.includes('$80.00') && txt1.includes('PAID') && txt1.includes('$20.00'))

  const all = frames.filter((f) => f.t >= arrive - 0.15 && f.t <= arrive + 1.4)
  const step = Math.max(1, Math.ceil(all.length / 24))
  const win = all.filter((_, i) => i % step === 0)
  win.forEach((f, i) => writeFileSync(`${OUT}/frame-${String(i + 1).padStart(3, '0')}.jpg`, Buffer.from(f.data, 'base64')))
  check('enough frames to read the beats', win.length >= 8, `${win.length} frames between -0.3 s and +1.5 s of arrival (${frames.length} total)`)
  if (win.length >= 4) {
    const cols = 6, rows = Math.ceil(win.length / cols)
    execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-framerate', '1', '-i', `${OUT}/frame-%03d.jpg`, '-vf', `scale=420:-1,tile=${cols}x${rows}`, '-frames:v', '1', `${OUT}/contact-sheet.png`])
    check('contact sheet written', true, `${OUT}/contact-sheet.png`)
  }
  const times = JSON.parse(ft)
  const over = times.filter((x) => x > 33).length
  console.log(`   frame times in the moment (headless Chrome, software raster, not a phone): ${times.length} frames, ${over} over 33 ms, max ${Math.max(...times).toFixed(0)} ms`)

  // ---- run 2: reduced motion must end in the same state ----
  await A.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  await sleep(500)
  const before = (await A.text()).match(/PAID/g)?.length ?? 0
  await B.fill('Amount', '10'); await B.waitClick('Pay')
  for (let i = 0; i < 120; i++) { if (((await A.text()).match(/PAID/g)?.length ?? 0) > before) break; await sleep(250) }
  await sleep(1500)
  const txt2 = await A.text()
  const rmScale = await scaleY()
  check('reduced motion: same kind of end state ($70.00 left, two PAID slips, level 70%)', txt2.includes('$70.00') && (txt2.match(/PAID/g)?.length ?? 0) >= 2 && rmScale === 0.7, `level ${rmScale}`)
  await A.shot(`${OUT}/reduced-motion-end.png`)
  console.log('   console errors on the sender page:', A.errors.length ? A.errors.join(' / ').slice(0, 300) : 'none')
  check('no console errors during the moment', A.errors.length === 0)
} catch (e) {
  check('script error', false, String(e.message || e).slice(0, 300))
} finally {
  A.close(); B.close()
  console.log(`${results.filter((r) => r.ok).length}/${results.length} checks passed`)
}
process.exit(0)

