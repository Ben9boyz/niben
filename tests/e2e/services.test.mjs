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

test('Hobbyer is the room’s menu as well: the corners and hobbies sit under their tabs, a corner can be taken out and put back, a tab renamed', async () => {
  const owner = await ownerClient()
  const u = await makeUser(owner)
  await u.client.post('me_settings', { sections: { japansk: true, lytte: true } })
  clearLimits()
  const page = await openPage(browser, { hash: '/admin' })
  await page.getByLabel(/Brukernavn/).fill(u.name)
  await page.getByLabel(/^Passord/).fill(u.password)
  await page.getByRole('button', { name: 'Logg inn' }).last().click()
  await page.waitForFunction(() => document.cookie.includes('niben_r='))
  await page.goto(`${process.env.NIBEN_APP}/#/admin`)
  await page.locator('.anav button', { hasText: 'Hobbyer' }).click()
  assert.equal(await page.locator('.anav button', { hasText: 'Faner' }).count(), 0, 'no tab editor of its own any more')
  await page.locator('.side .it', { hasText: 'Japansk' }).click()
  assert.equal(await page.locator('.tabsel select').inputValue(), 'lare', 'Japansk sits under Lære')

  // taking it out: it leaves the menu, the corner is switched off, and it can be put back from "Legg til"
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'Ta ut av rommet' }).click()
  await page.locator('.side .tabh.hid').waitFor()
  await page.getByText('Menyen er lagret').waitFor()
  assert.equal((await u.client.get('me_settings')).json.sections.japansk, false)
  await page.locator('.side .it.add', { hasText: 'Legg til hobby' }).click()
  await page.locator('.kind', { hasText: 'Japansk' }).click()
  await page.locator('.tabsel select').waitFor()
  await page.getByText('Menyen er lagret').waitFor()
  assert.equal((await u.client.get('me_settings')).json.sections.japansk, true)

  // a tab: picked in the list, renamed – the menu follows at once, and it is saved without a button
  await page.locator('.side .tabh', { hasText: 'Lære' }).click()
  await page.getByLabel(/Navn på fanen/).fill('Språk')
  await page.getByLabel(/Navn på fanen/).press('Enter')
  await page.getByLabel(/Navn på fanen/).blur()
  await page.getByText('Menyen er lagret').waitFor()
  assert.equal((await u.client.get('content')).json.nav.tabs.find((t) => t.id === 'lare')?.label, 'Språk', 'saved')
  assert.ok((await page.locator('.nav .item').allInnerTexts()).some((t) => t.includes('Språk')), 'the menu shows the new name')
  assert.equal(await page.locator('.nav .item', { hasText: 'Gangen' }).count(), 0, 'the hall is not a tab')
  assert.deepEqual(page.errors, [])
})
