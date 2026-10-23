// 用无头 Edge（CDP）把 SVG 精确光栅化到各尺寸，并生成一张原尺寸对比表。
// 用法： node render.mjs
import { spawn } from 'node:child_process'
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const OUT = join(ROOT, '_out')
mkdirSync(OUT, { recursive: true })

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9401 + Math.floor(Math.random() * 90)
const SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256, 512, 1024]
const VARIANTS = process.argv.slice(2).length ? process.argv.slice(2) : ['icon']

const proc = spawn(
  EDGE,
  [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${join(OUT, '_profile')}`,
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
  ],
  { stdio: 'ignore' }
)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let page
for (let i = 0; i < 60; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
    page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl)
    if (page) break
  } catch {}
  await sleep(200)
}
if (!page) {
  console.error('无法连接无头浏览器')
  process.exit(1)
}

const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let seq = 0
const pending = new Map()
const errors = []
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m)
    pending.delete(m.id)
  }
  if (m.method === 'Runtime.exceptionThrown')
    errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text)
}
const send = (method, params = {}) => {
  const id = ++seq
  ws.send(JSON.stringify({ id, method, params }))
  return new Promise((r) => pending.set(id, r))
}
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (r.result?.exceptionDetails) errors.push('EVAL ' + r.result.exceptionDetails.text)
  return r.result?.result?.value
}

await send('Runtime.enable')
await send('Page.enable')
await send('Page.navigate', { url: 'about:blank' })
await sleep(300)

// 空壳页面：body 无边距、背景透明
await send('Page.navigate', { url: 'data:text/html,<body style="margin:0;background:transparent"></body>' })
await sleep(400)

const shot = async (size, clipScale = 1) => {
  const r = await send('Page.captureScreenshot', {
    format: 'png',
    clip: { x: 0, y: 0, width: size, height: size, scale: clipScale },
    captureBeyondViewport: true
  })
  return Buffer.from(r.result.data, 'base64')
}

for (const v of VARIANTS) {
  const svg = readFileSync(join(ROOT, `${v}.svg`), 'utf8')
  for (const size of SIZES) {
    await send('Emulation.setDeviceMetricsOverride', {
      width: size,
      height: size,
      deviceScaleFactor: 1,
      mobile: false
    })
    await send('Emulation.setDefaultBackgroundColorOverride', {
      color: { r: 0, g: 0, b: 0, a: 0 }
    })
    await evaluate(
      `document.body.innerHTML=${JSON.stringify(
        svg.replace('<svg ', '<svg style="display:block;width:100vw;height:100vh" ')
      )}`
    )
    await sleep(90)
    writeFileSync(join(OUT, `${v}-${size}.png`), await shot(size))
  }
  process.stdout.write(`rendered ${v}\n`)
}

// 对比表：把原生光栅按最近邻放大，才是"16px 到底长什么样"的真实答案
const row = (v) =>
  `<div class="row"><div class="name">${v}</div>${SIZES.map(
    (s) =>
      `<div class="cell"><img src="_out/${v}-${s}.png" style="width:${s}px;height:${s}px"><span>${s}</span></div>`
  ).join('')}</div>`

const sheet = `<!doctype html><meta charset="utf-8"><style>
  body{margin:0;padding:24px;background:#0c0e12;font:12px ui-monospace,Consolas,monospace;color:#e9ecf2}
  .row{display:flex;align-items:flex-end;gap:22px;padding:16px 0;border-bottom:1px solid #232a33}
  .name{width:150px;color:#9aa4b4}
  .cell{display:flex;flex-direction:column;align-items:center;gap:8px}
  .cell span{font-size:10px;color:#6f7a89}
  img{image-rendering:pixelated;filter:drop-shadow(0 0 0.5px #fff2)}
</style>${VARIANTS.map(row).join('')}`

writeFileSync(join(ROOT, '_compare-src.html'), sheet)
console.log('ERRORS', errors.length ? errors : 'none')
ws.close()
proc.kill()
process.exit(0)
