// Shared by the browser tests: a Chromium, pages that skip the tour, and the account helpers of the API tests.
import { chromium } from 'playwright'
export * from '../api/helpers.mjs'

export const APP = process.env.NIBEN_APP

export async function launch() {
  return chromium.launch({
    executablePath: process.env.NIBEN_CHROMIUM || undefined,
    args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  })
}

/** A new page (own cookies) that has seen the tour. `mode`: 'enkel' = the plain site, 'rom' = the 3D room. Errors are collected in page.errors. */
export async function openPage(browser, { mode = 'enkel', width = 1200, height = 800, hash = '/' } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height } })
  const page = await ctx.newPage()
  page.setDefaultTimeout(15000)
  page.errors = []
  page.on('pageerror', (e) => page.errors.push(e.message.slice(0, 200)))
  page.on('console', (m) => { if (/Vue warn/.test(m.text())) page.errors.push(m.text().slice(0, 200)) })
  await page.addInitScript((m) => { localStorage.setItem('niben-tour', 'done'); localStorage.setItem('niben-mode', m) }, mode)
  await page.goto(`${APP}/#${hash}`)
  return page
}
export const cookie = async (page, name) => (await page.context().cookies()).find((c) => c.name === name)?.value
