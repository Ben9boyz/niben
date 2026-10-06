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
  page.on('pageerror', (e) => page.errors.push(e.message.slice(0, 200)))
  page.on('console', (m) => {
    const t = m.text()
    if (/Vue warn/.test(t) || (m.type() === 'error' && !/Failed to load resource|ERR_|net::/.test(t))) page.errors.push(t.slice(0, 200)) // (the fake server has no internet: failed requests are expected)
  })
  await page.addInitScript((m) => { localStorage.setItem('niben-tour', 'done'); localStorage.setItem('niben-mode', m) }, mode)
  await page.goto(`${APP}/#${hash}`)
  return page
}
export const cookie = async (page, name) => (await page.context().cookies()).find((c) => c.name === name)?.value
