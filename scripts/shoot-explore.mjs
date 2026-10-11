// Screenshots the three exploration directions at 1280 and 375, before and after the payment lands.
import { mkdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { launch, sleep } from './lib/browser.mjs'

const out = 'C:/Users/fadhm/Desktop/worldsfair-tempo/strategy/design/shots'
mkdirSync(out, { recursive: true })
const page = pathToFileURL('C:/Users/fadhm/Desktop/worldsfair-tempo/strategy/design/explore.html').href
const b = await launch(9400 + Math.floor(Math.random() * 250), false)
try {
  for (const [w, h] of [[1280, 800], [375, 812]]) {
    for (const k of ['a', 'b', 'c']) {
      await b.resize(w, h, 'dark')
      await b.goto(`${page}#${k}`)
      await sleep(1200)
      await b.shot(`${out}/${k}-${w}-before.png`)
      await b.js(`arrive()`)
      await sleep(1500)
      await b.shot(`${out}/${k}-${w}-after.png`, true)
    }
  }
  console.log('done', out)
} finally {
  b.close()
}
process.exit(0)
