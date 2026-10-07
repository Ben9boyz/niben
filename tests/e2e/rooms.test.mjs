import { test, before, after, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { launch, openPage, closePages, cookie, ownerClient, makeUser, mockSpotify, db, clearLimits, pickRoom } from './helpers.mjs'

let browser
before(async () => { browser = await launch() })
after(async () => { await browser?.close() })
afterEach(closePages)

test('switching rooms does not reload the page, and the new room shows its own things', async () => {
  const owner = await ownerClient()
  const alice = await makeUser(owner)
  await alice.client.post('texts_save', { texts: { 'home.name': 'Alicia', 'home.intro': 'Rommet til Alicia' } })

  const page = await openPage(browser)
  await page.getByRole('heading', { level: 1 }).waitFor()
  await page.evaluate(() => { window.__same_page = true })
  assert.match(await page.locator('h1').innerText(), /Benjamin/)

  await pickRoom(page, alice.name)
  await page.getByRole('heading', { level: 1, name: /Alicia/ }).waitFor()
  assert.equal(await page.evaluate(() => window.__same_page), true, 'the page was not reloaded')
  assert.equal(await cookie(page, 'niben_r'), String(alice.id))
  assert.doesNotMatch(await page.locator('main, .dock').first().innerText(), /Benjamin/)

  await page.evaluate(() => { location.hash = '#/gangen' })
  await page.locator('.door').first().click() // (the main room's door comes first)
  await page.getByRole('heading', { level: 1, name: /Benjamin/ }).waitFor()
  assert.equal(await page.evaluate(() => window.__same_page), true)
  assert.equal(await cookie(page, 'niben_r'), '1')
  assert.deepEqual(page.errors, [])
})

test('the library of one room does not show in another (the saved copy in the browser belongs to its room)', async () => {
  const owner = await ownerClient()
  const alice = await makeUser(owner)
  await alice.client.post('me_settings', { sections: { lytte: true } })
  mockSpotify({ albums: 1 })
  db('connect', '1') // the main room is connected – alice's is not
  await owner.post('me_settings', { sections: { lytte: true } })

  const page = await openPage(browser, { hash: '/lytte' })
  await page.getByText('Album 1').first().waitFor()
  const saved = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('niben-spotify-lists')))
  assert.deepEqual(saved, ['niben-spotify-lists-v2:r1'], 'saved under the main room')

  await pickRoom(page, alice.name)
  await page.waitForFunction((id) => document.cookie.includes(`niben_r=${id}`), String(alice.id))
  await page.waitForTimeout(1500)
  await page.goto(`${APP_URL()}/#/lytte`)
  await page.waitForTimeout(1500)
  assert.equal(await page.getByText('Album 1').count(), 0, 'the main room’s album is not on her shelf')
  assert.deepEqual(page.errors, [])
})
const APP_URL = () => process.env.NIBEN_APP

test('logging in from the profile button: a wrong password says so, the right one logs in', async () => {
  const owner = await ownerClient()
  const u = await makeUser(owner)
  clearLimits()
  const page = await openPage(browser)
  await page.getByRole('button', { name: /Rom og konto/ }).first().click()
  await page.getByRole('menuitem', { name: /Logg inn/ }).click()
  await page.getByPlaceholder(/Brukernavn/).fill(u.name)
  await page.getByPlaceholder('Passord').fill('wrong-password')
  await page.getByRole('button', { name: 'Logg inn' }).last().click()
  await page.locator('.lge').waitFor()
  assert.match(await page.locator('.lge').innerText(), /Feil/)

  await page.getByPlaceholder('Passord').fill(u.password)
  await page.getByRole('button', { name: 'Logg inn' }).last().click()
  await page.waitForFunction(() => document.cookie.includes('niben_r='))
  // (logging in takes you into your own room – the page may still be on its way there: open the menu once it has settled)
  await page.waitForLoadState('load')
  let shown = false
  for (let i = 0; i < 8 && !shown; i++) {
    await page.getByRole('button', { name: /Rom og konto/ }).first().click()
    shown = await page.getByRole('menuitem', { name: /Admin/ }).waitFor({ timeout: 2000 }).then(() => true, () => false)
    if (!shown) { await page.keyboard.press('Escape'); await page.waitForTimeout(500) }
  }
  assert.ok(shown, 'the menu shows Admin once logged in')
  assert.deepEqual(page.errors, [])
})

test('the admin is grouped, and a user sees only what is theirs', async () => {
  const owner = await ownerClient()
  const u = await makeUser(owner)
  clearLimits()
  const page = await openPage(browser, { hash: '/admin' })
  await page.getByLabel(/Brukernavn/).fill(u.name)
  await page.getByLabel(/^Passord/).fill(u.password)
  await page.getByRole('button', { name: 'Logg inn' }).last().click()
  await page.waitForFunction(() => document.cookie.includes('niben_r='))
  await page.goto(`${process.env.NIBEN_APP}/#/admin`)
  await page.locator('.tabs.groups button').first().waitFor()
  const groups = await page.locator('.tabs.groups button').allInnerTexts()
  assert.deepEqual(groups.map((g) => g.trim()), ['Hobbyer', 'Profil', 'Rommet', 'Tilkoblinger', 'Konto'])
  await page.locator('.tabs.groups button', { hasText: 'Profil' }).click()
  assert.deepEqual((await page.locator('.tabs.sub button').allInnerTexts()).map((t) => t.trim()), ['Om meg', 'Tekster', 'Gjestebok'])
  await page.locator('.tabs.groups button', { hasText: 'Tilkoblinger' }).click()
  await page.locator('details.svc summary', { hasText: 'Spotify' }).waitFor()
  assert.deepEqual(page.errors, [])

  // the owner has the site's own parts as well
  clearLimits()
  const o = await openPage(browser, { hash: '/admin' })
  await o.getByLabel(/^Passord/).fill(process.env.NIBEN_OWNER_PASSWORD)
  await o.getByRole('button', { name: 'Logg inn' }).last().click()
  await o.locator('.tabs.groups button').first().waitFor()
  const og = (await o.locator('.tabs.groups button').allInnerTexts()).map((g) => g.trim())
  assert.ok(og.includes('Oversikt') && !og.includes('Siden'), og.join(',')) // (the site itself – users, newsletter – sits under Oversikt)
  await o.locator('.tabs.groups button', { hasText: 'Oversikt' }).click()
  assert.deepEqual((await o.locator('.tabs.sub button').allInnerTexts()).map((t) => t.trim()), ['Oversikt', 'Brukere', 'Nyhetsbrev'])
  assert.deepEqual(o.errors, [])
})

test('the hall: one door per room, and a click on a door goes into that room', async () => {
  const owner = await ownerClient()
  const alice = await makeUser(owner)
  await alice.client.post('texts_save', { texts: { 'home.name': 'Alicia', 'home.intro': 'Rommet til Alicia' } })

  const page = await openPage(browser, { hash: '/gangen' })
  await page.locator('.door[data-room]').first().waitFor()
  assert.ok((await page.locator('.door[data-room]').count()) >= 2, 'a door for each room')
  await page.locator('.door', { hasText: alice.name }).first().click()
  await page.getByRole('heading', { level: 1, name: /Alicia/ }).waitFor()
  assert.equal(await cookie(page, 'niben_r'), String(alice.id))
  assert.deepEqual(page.errors, [])
})
