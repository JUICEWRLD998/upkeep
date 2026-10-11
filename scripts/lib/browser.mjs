import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const FIND = (label) => `((want) => { let e = [...document.querySelectorAll("[aria-label]")].find((x) => x.getAttribute("aria-label") === want); if (!e) { for (const l of document.querySelectorAll("label")) { const s = l.querySelector("span"); if (s && s.textContent.trim() === want) { e = l.querySelector("input,select,textarea"); break } } } return e })(${JSON.stringify(label)})`

export async function launch(port, passkey) {
  const dir = mkdtempSync(join(tmpdir(), `upkeep-e2e-${port}-`))
  const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, '--no-first-run', '--window-size=1280,900', 'about:blank'], { stdio: 'ignore' })
  let targets
  for (let i = 0; i < 240; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break } catch { await sleep(250) } }
  const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl)
  await new Promise((r) => (ws.onopen = r))
  let id = 0
  const pending = new Map()
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id) } }
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
  await send('Page.enable'); await send('Runtime.enable')
  if (passkey) {
    await send('WebAuthn.enable')
    await send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } })
  }
  const js = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'eval error')
    return r.result?.result?.value
  }
  const api = {
    goto: async (url) => { await send('Page.navigate', { url }); await sleep(2500) },
    js,
    text: () => js('document.body.innerText'),
    waitText: async (needle, ms = 60000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if ((await js('document.body?.innerText ?? ""')).includes(needle)) return true } catch {} await sleep(500) } return false },
    click: (label) => js(`(() => { const els = [...document.querySelectorAll('button,a')]; const e = els.find((x) => x.innerText.trim() === ${JSON.stringify(label)} && !x.disabled); if (!e) return false; e.click(); return true })()`),
    waitClick: async (label, ms = 30000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await api.click(label)) return true } catch {} await sleep(500) } return false },
    // Finds a control by its aria-label, or by the visible text of the <label> that wraps it.
    find: FIND,
    fill: (aria, value) => js(`(() => { const e = ${FIND(aria)}; if (!e) return false; const proto = e.tagName === "SELECT" ? HTMLSelectElement.prototype : e.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, "value").set.call(e, ${JSON.stringify(value)}); e.dispatchEvent(new Event(e.tagName === "SELECT" ? "change" : "input", { bubbles: true })); return true })()`),
    value: (aria) => js(`(() => { const e = ${FIND(aria)}; return e ? e.value : null })()`),
    // Viewport + colour scheme, then a PNG screenshot written to `path` (scale 1 keeps files small).
    resize: async (width, height, scheme = 'dark', scale = 1) => {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: width < 700 })
      await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] })
      await sleep(300)
    },
    shot: async (path, fullPage = false) => {
      const { writeFileSync } = await import('node:fs')
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: fullPage })
      writeFileSync(path, Buffer.from(r.result.data, 'base64'))
      return path
    },
    send,
    close: () => { try { ws.close() } catch {} proc.kill() },
  }
  return api
}

