// Core Web Vitals probe on the production build: CLS (layout-shift, no recent input) and the LCP element, per route
// at 375 and 1280. Planted control: an element injected after load that pushes content down must raise CLS above 0.05,
// or the observer is blind and the result is withheld. Headless Chrome on a software rasteriser is not a phone.
import { launch, sleep } from './lib/browser.mjs'
const BASE = process.argv[2] || 'http://localhost:3200'
const b = await launch(9400 + Math.floor(Math.random() * 250), false)
const OBS = `window.__cls = 0; window.__lcp = null; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true }); new PerformanceObserver((l) => { const e = l.getEntries().at(-1); window.__lcp = { t: Math.round(e.startTime), el: e.element ? e.element.tagName + '.' + String(e.element.className).slice(0, 40) : 'none', size: e.size } }).observe({ type: 'largest-contentful-paint', buffered: true }); true`
const fails = []
try {
  for (const [w, h] of [[375, 800], [1280, 900]]) {
    await b.resize(w, h, 'dark')
    for (const path of ['/', '/desk', '/send']) {
      await b.send('Page.addScriptToEvaluateOnNewDocument', { source: OBS })
      await b.goto(BASE + path)
      await sleep(3500)
      const cls = Number(await b.js('window.__cls'))
      const lcp = await b.js('JSON.stringify(window.__lcp)')
      // planted control: push content down after load, with no user input
      await b.js(`(() => { const d = document.createElement('div'); d.id = '__ctlShift'; d.style.cssText = 'height:300px;background:transparent'; document.body.prepend(d) })()`)
      await sleep(600)
      const after = Number(await b.js('window.__cls'))
      await b.js(`document.getElementById('__ctlShift')?.remove()`)
      const ctlOk = after - cls > 0.05
      if (!ctlOk) fails.push(`${path}@${w}: CLS observer blind (control moved CLS by ${(after - cls).toFixed(3)})`)
      if (cls >= 0.1) fails.push(`${path}@${w}: CLS ${cls.toFixed(3)}`)
      console.log(`${ctlOk && cls < 0.1 ? 'PASS' : 'FAIL'} ${path}@${w}: CLS ${cls.toFixed(3)} (control +${(after - cls).toFixed(3)}), LCP ${lcp}`)
    }
  }
} finally { b.close() }
console.log(fails.length ? 'FAILURES:\n  ' + fails.join('\n  ') : 'vitals ok')
process.exit(0)
