import { test, before, after, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { launch, openPage, closePages, ownerClient, makeUser, mockSpotify, db } from './helpers.mjs'

let browser
before(async () => { browser = await launch() })
after(async () => { await browser?.close() })
afterEach(closePages)

// A scene that draws nothing gives a flat picture, which a PNG squeezes to a few kilobytes; a room with a cabinet, a
// desk and light does not.
const scene = async (page) => {
  const hide = await page.addStyleTag({ content: '.dock, .nav-wrap, .mtop, .loader { display: none !important }' }) // (just the 3D scene)
  const png = await page.screenshot()
  await hide.evaluate((el) => el.remove())
  return png
}
const looksDrawn = async (page) => (await scene(page)).length > 40000

test('the 3D room starts, draws and takes new data without errors', async () => {
  const page = await openPage(browser, { mode: 'rom', width: 1100, height: 700 })
  await page.waitForFunction(() => !!window.__room, null, { timeout: 30000 })
  await page.waitForTimeout(3000)
  assert.ok(await looksDrawn(page), 'something is drawn on the canvas')
  assert.deepEqual(page.errors, [])
})

test('the listening corner shows the shelf of a connected room and survives a switch to a room without one', async () => {
  const owner = await ownerClient()
  const alice = await makeUser(owner)
  mockSpotify({ albums: 6, page: 50 })
  db('connect', '1')
  await owner.post('me_settings', { sections: { lytte: true } })
  await alice.client.post('me_settings', { sections: { lytte: true } })

  const page = await openPage(browser, { mode: 'rom', width: 1100, height: 700, hash: '/lytte' })
  await page.waitForFunction(() => !!window.__room, null, { timeout: 30000 })
  await page.waitForTimeout(4000)
  assert.ok(await looksDrawn(page))
  const before = await scene(page)

  await page.getByRole('button', { name: 'Bytt rom' }).click()
  await page.locator('.smenu .row', { hasText: alice.name }).click()
  await page.waitForFunction((id) => document.cookie.includes(`niben_r=${id}`), String(alice.id))
  await page.waitForTimeout(2500)
  assert.ok(await looksDrawn(page), 'still a drawn room after the switch')
  assert.notDeepEqual(await scene(page), before, 'and a different one')
  assert.deepEqual(page.errors, [])
})
