import { test, before, after, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { launch, openPage, closePages, ownerClient, mockSpotify, db } from './helpers.mjs'

let browser
before(async () => { browser = await launch() })
after(async () => { await browser?.close() })
afterEach(closePages)

const objectsNear = (page, [x, y, z], r) => page.evaluate(([c, rad]) => window.__room.dumpScene().filter((o) => Math.hypot(o[1] - c[0], o[2] - c[1], o[3] - c[2]) < rad).map((o) => o.slice(0, 4).join('|')), [[x, y, z], r])

test('the iPod is used from its stand: it never leaves it, and the X on its screen closes it', async () => {
  const owner = await ownerClient()
  await owner.post('me_settings', { sections: { lytte: true } })
  mockSpotify({ albums: 3, device: true })
  db('connect', '1')
  // a login for the owner in this browser: the iPod screen only answers its owner
  const page = await openPage(browser, { mode: 'rom', width: 1200, height: 760, hash: '/lytte' })
  await page.waitForFunction(() => !!window.__room, null, { timeout: 60000 })
  await page.waitForFunction(() => window.__room.dumpScene().some((o) => o[0].includes('ipod_fixed')), null, { timeout: 90000 }) // (the iPod model has arrived)
  await page.waitForTimeout(2000)
  const stand = [3.6, 0.92, 0.75] // (the stand on the listening table, world coordinates)
  const before = await objectsNear(page, stand, 0.16)
  assert.ok(before.length > 5, 'the iPod and its stand are there')

  await page.evaluate(async () => { (await import('/src/composables/room/useRoom.ts')).room.musicView = 'ipod' })
  await page.locator('.ipod header').waitFor({ timeout: 60000 }) // the screen of the iPod is a layer on top of the 3D scene
  await page.waitForTimeout(2500)
  assert.deepEqual(await objectsNear(page, stand, 0.16), before, 'nothing moved: the iPod is where it was')
  assert.equal(await page.getByRole('button', { name: /Legg fra deg/ }).count(), 0, 'no "put it down" any more')

  await page.getByRole('button', { name: 'Lukk iPoden' }).last().dispatchEvent('click') // (the layer keeps moving while the camera settles in a slow software-rendered browser: no aiming with the mouse)
  await page.locator('.ipod header').waitFor({ state: 'detached', timeout: 20000 })
  assert.deepEqual(await objectsNear(page, stand, 0.16), before, 'and still there after closing it')
  assert.deepEqual(page.errors, [])
})
