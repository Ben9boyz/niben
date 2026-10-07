import { test, before, after, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { launch, openPage, closePages, ownerClient, makeUser, clearLimits } from './helpers.mjs'

let browser
before(async () => { browser = await launch() })
after(async () => { await browser?.close() })
afterEach(closePages)

test('jpdb is set up in the Japanese corner itself: the owner gets the box there, a visitor only sees the hobby', async () => {
  const owner = await ownerClient()
  const u = await makeUser(owner)
  await u.client.post('me_settings', { sections: { japansk: true } })
  clearLimits()
  const page = await openPage(browser, { hash: '/admin' })
  await page.getByLabel(/Brukernavn/).fill(u.name)
  await page.getByLabel(/^Passord/).fill(u.password)
  await page.getByRole('button', { name: 'Logg inn' }).last().click()
  await page.waitForFunction(() => document.cookie.includes('niben_r='))
  await page.goto(`${process.env.NIBEN_APP}/#/japansk`)
  await page.getByText('Koble til jpdb').waitFor()
  await page.getByPlaceholder('Lim inn nøkkelen').fill('not a key!')
  await page.getByRole('button', { name: 'Koble til' }).click()
  await page.getByText(/jpdb-nøkkelen ser ikke riktig ut/).waitFor()
  await page.getByPlaceholder('Lim inn nøkkelen').fill('abcdefghijklmnop1234')
  await page.getByRole('button', { name: 'Koble til' }).click()
  await page.getByText('jpdb er koblet til', { exact: false }).first().waitFor()
  assert.equal((await u.client.get('me_settings')).json.keys.jpdb, true)

  // a visitor in that room: no box
  const v = await openPage(browser, { hash: '/japansk' })
  await v.evaluate((n) => fetch('api.php?action=room_set', { method: 'POST', headers: { 'X-Niben': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ username: n }) }), u.name)
  await v.reload()
  await v.waitForTimeout(1500)
  assert.equal(await v.getByText('Koble til jpdb').count(), 0)
})
