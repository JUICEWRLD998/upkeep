// Measures the palette in styles/tokens.css: WCAG contrast for text pairs, CIE Lab dE76 between role hues, and the
// chroma ratio of accent to surfaces. Reads the real file, so the numbers cannot drift from the CSS.
// Planted controls run first: a 1:1 pair must read 1.00 and white-vs-black must read 21.00, or the run aborts.
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8')

function block(start) {
  const i = css.indexOf(start)
  if (i < 0) throw new Error('block not found: ' + start)
  const open = css.indexOf('{', i)
  let depth = 0
  for (let j = open; j < css.length; j++) {
    if (css[j] === '{') depth++
    if (css[j] === '}' && --depth === 0) return css.slice(open + 1, j)
  }
  throw new Error('unterminated block')
}
const vars = (body) => Object.fromEntries([...body.matchAll(/--([\w-]+):\s*oklch\(([^)]+)\)/g)].map((m) => [m[1], m[2].split('/')[0].trim().split(/\s+/).map(Number)]))
const light = vars(block(':root {'))
const dark = vars(block(":root[data-theme='dark']"))

function oklchToRgb([L, C, h]) {
  const a = C * Math.cos((h * Math.PI) / 180)
  const b = C * Math.sin((h * Math.PI) / 180)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((v) => Math.min(1, Math.max(0, v)))
  return lin
}
const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b
const ratio = (a, b) => {
  const [hi, lo] = [luminance(oklchToRgb(a)), luminance(oklchToRgb(b))].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
function lab(c) {
  const [r, g, b] = oklchToRgb(c)
  const X = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b
  const Y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b
  const Z = 0.0193339 * r + 0.119192 * g + 0.9503041 * b
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116)
  const [fx, fy, fz] = [f(X / 0.95047), f(Y), f(Z / 1.08883)]
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}
const dE = (a, b) => Math.hypot(...lab(a).map((v, i) => v - lab(b)[i]))

// planted controls
const same = ratio([0.5, 0.1, 100], [0.5, 0.1, 100])
const wb = ratio([1, 0, 0], [0, 0, 0])
if (Math.abs(same - 1) > 0.01 || Math.abs(wb - 21) > 0.3) throw new Error(`controls failed: same=${same} white/black=${wb}`)
console.log(`controls ok (same pair ${same.toFixed(2)}:1, white/black ${wb.toFixed(2)}:1)\n`)

let fails = 0
function report(name, t) {
  console.log(`== ${name}`)
  const pairs = [
    ['ink on ground', t.ink, t.ground, 4.5],
    ['ink on s1', t.ink, t.s1, 4.5],
    ['ink-2 on ground', t['ink-2'], t.ground, 4.5],
    ['muted on ground', t.muted, t.ground, 4.5],
    ['muted on s1', t.muted, t.s1, 4.5],
    ['muted on s2', t.muted, t.s2, 4.5],
    ['accent-ink on accent', t['accent-ink'], t.accent, 4.5],
    ['accent on ground (UI, 3:1)', t.accent, t.ground, 3],
    ['sky link on ground', t.sky, t.ground, 4.5],
    ['sky link on s1', t.sky, t.s1, 4.5],
    ['brick text on s1', t.brick, t.s1, 4.5],
    ['kraft text on s1', t.kraft, t.s1, 4.5],
  ]
  for (const [n, fg, bg, min] of pairs) {
    const r = ratio(fg, bg)
    const ok = r >= min
    if (!ok) fails++
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${n.padEnd(28)} ${r.toFixed(2)}:1 (min ${min})`)
  }
  const roles = ['accent', 'kraft', 'brick', 'sky']
  for (let i = 0; i < roles.length; i++) for (let j = i + 1; j < roles.length; j++) {
    const d = dE(t[roles[i]], t[roles[j]])
    const ok = d >= 20
    if (!ok) fails++
    console.log(`${ok ? 'PASS' : 'FAIL'}  dE76 ${roles[i]} vs ${roles[j]}`.padEnd(40) + d.toFixed(1))
  }
  const surfaceC = Math.max(t.ground[1], t.s1[1], t.s2[1])
  const k = t.accent[1] / surfaceC
  console.log(`${k >= 4 ? 'PASS' : 'FAIL'}  accent chroma ${t.accent[1]} vs max surface chroma ${surfaceC} = ${k.toFixed(1)}x (min 4x)`)
  if (k < 4) fails++
  for (const s of ['ground', 's1', 's2']) if (t[s][1] < 0.008) { fails++; console.log('FAIL  untinted surface ' + s) }
  console.log('')
}
report('LIGHT (warm paper)', light)
report('DARK (deep blue-black)', dark)
console.log(fails ? `${fails} FAILURES` : 'all palette checks pass')
process.exit(fails ? 1 : 0)
