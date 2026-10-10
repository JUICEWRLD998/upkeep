// Drives headless Chrome over CDP (no dependencies; Node 24 has fetch and WebSocket). Adds a WebAuthn virtual
// authenticator so passkey flows run without a human. Usage: node scripts/driver-spike.mjs <url>
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const URL_ = process.argv[2] || 'http://localhost:3100/spike'
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PORT = 9333
const dir = mkdtempSync(join(tmpdir(), 'upkeep-chrome-'))
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${dir}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
try {
  let targets
  for (let i = 0; i < 40; i++) { try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); break } catch { await sleep(250) } }
  const page = targets.find((t) => t.type === 'page')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((r) => (ws.onopen = r))
  let id = 0
  const pending = new Map()
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id) } }
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
  const evalJs = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.result?.value

  await send('Page.enable'); await send('Runtime.enable'); await send('WebAuthn.enable')
  await send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } })
  await send('Page.navigate', { url: URL_ })
  await sleep(4000)
  console.log('clicked run:', await evalJs("(() => { const b = document.querySelector('#run'); if (!b) return false; b.click(); return true })()"))
  for (let i = 0; i < 150; i++) { if (await evalJs('window.__spikeDone === true')) break; await sleep(2000) }
  const rows = await evalJs('JSON.stringify(window.__spike || [])')
  for (const r of JSON.parse(rows || '[]')) console.log(r.ok ? 'PASS' : 'FAIL', r.step, '::', r.detail)
  if (!rows || rows === '[]') console.log('no rows; page title:', await evalJs('document.title'), await evalJs('document.body.innerText.slice(0,300)'))
  ws.close()
} finally {
  chrome.kill()
}
