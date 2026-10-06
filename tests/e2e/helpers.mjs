// Shared by the browser tests: a Chromium, pages that skip the tour, and the account helpers of the API tests.
import { chromium } from 'playwright'
export * from '../api/helpers.mjs'

export const APP = process.env.NIBEN_APP
const contexts = []
/** Closes every page a test opened – each 3D room holds a WebGL context, and a browser only has so many. */
export async function closePages() { for (const c of contexts.splice(0)) await c.close().catch(() => {}) }

export async function launch() {
  return chromium.launch({
    executablePath: process.env.NIBEN_CHROMIUM || undefined,
    args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  })
}

/** A new page (own cookies) that has seen the tour. `mode`: 'enkel' = the plain site, 'rom' = the 3D room. Errors are collected in page.errors. */
export async function openPage(browser, { mode = 'enkel', width = 1200, height = 800, hash = '/' } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height } })
  contexts.push(ctx)
  const page = await ctx.newPage()
  page.setDefaultTimeout(15000)
  page.errors = []
  page.on('pageerror', (e) => { if (!/No supported keysystem/.test(e.message)) page.errors.push(e.message.slice(0, 200)) }) // (no Widevine in CI: Spotify's web player cannot start its DRM)
  page.on('console', (m) => {
    const t = m.text()
    if (/Vue warn/.test(t) || (m.type() === 'error' && !/Failed to load resource|ERR_|net::|No supported keysystem/.test(t))) page.errors.push(t.slice(0, 200)) // (the fake server has no internet: failed requests are expected; a Chromium without Widevine – CI – cannot do the DRM of Spotify's web player)
  })
  await page.addInitScript((m) => { localStorage.setItem('niben-tour', 'done'); localStorage.setItem('niben-mode', m) }, mode)
  await page.goto(`${APP}/#${hash}`)
  return page
}
export const cookie = async (page, name) => (await page.context().cookies()).find((c) => c.name === name)?.value

/** The smallest real .glb there is: one triangle. (A test needs a model the loader will accept.) */
export function tinyGlb() {
  const pos = Buffer.alloc(36)
  ;[0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((v, i) => pos.writeFloatLE(v, i * 4))
  const json = { asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }], meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    buffers: [{ byteLength: 36 }], bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }], accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] }] }
  let j = Buffer.from(JSON.stringify(json))
  j = Buffer.concat([j, Buffer.alloc((4 - (j.length % 4)) % 4, 0x20)])
  const head = Buffer.alloc(12)
  head.write('glTF', 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + j.length + 8 + pos.length, 8)
  const ch = (len, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.write(type, 4, 'latin1'); return b }
  const jc = ch(j.length, 'JSON'); jc.writeUInt32LE(j.length, 0); jc.writeUInt32LE(0x4e4f534a, 4)
  const bc = ch(pos.length, 'BIN\0'); bc.writeUInt32LE(0x004e4942, 4)
  return Buffer.concat([head, jc, j, bc, pos])
}

/** Picks a room in the open "Rom og konto" menu – with many rooms (a long test run) through its search field. */
export async function pickRoom(page, name) {
  const find = page.locator('.smenu .rfind')
  if (await find.count()) await find.fill(name)
  await page.locator('.smenu .row', { hasText: name }).first().click()
}
