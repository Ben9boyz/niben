import { test, before, after, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { launch, openPage, closePages, ownerClient, makeUser, clearLimits } from './helpers.mjs'

let browser
before(async () => { browser = await launch() })
after(async () => { await browser?.close() })
afterEach(closePages)

test('a room owner picks a material (Leire) and it is kept for the room', async () => {
  const owner = await ownerClient()
  const u = await makeUser(owner)
  clearLimits()
  const page = await openPage(browser, { mode: 'enkel', hash: '/admin', width: 1200, height: 900 })
  await page.getByLabel(/Brukernavn/).fill(u.name)
  await page.getByLabel(/^Passord/).fill(u.password)
  await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'Logg inn' }).last().click()])
  await page.locator('.side .it').first().waitFor()
  assert.equal(await page.evaluate(() => document.documentElement.dataset.skin), 'keys') // the standard: Taster
  await page.getByRole('tab', { name: /Rommet/ }).first().click()
  await page.getByRole('radio', { name: /^Leire/ }).click()
  await page.getByText('Stilen er lagret.').waitFor()
  assert.equal(await page.evaluate(() => document.documentElement.dataset.skin), 'clay')
  // saved with the room: still there after a reload (it comes back from the server with the room's texts)
  await page.reload()
  await page.waitForFunction(() => document.documentElement.dataset.skin === 'clay')
  // the first look of the site: no skin at all
  await page.getByRole('tab', { name: /Rommet/ }).first().click()
  await page.getByRole('radio', { name: /^Aluminium/ }).click()
  await page.waitForFunction(() => !document.documentElement.dataset.skin)
})
