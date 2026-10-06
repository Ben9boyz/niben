import { test, before, after, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { launch, openPage, closePages } from './helpers.mjs'

let browser
before(async () => { browser = await launch() })
after(async () => { await browser?.close() })
afterEach(closePages)

test('free roam: walk with the keys at eye height, the walls stop you, Esc takes the camera back to its station', async () => {
  const page = await openPage(browser, { mode: 'rom', width: 1100, height: 700 })
  await page.waitForFunction(() => !!window.__room, null, { timeout: 60000 })
  await page.waitForTimeout(3000)
  const cam = () => page.evaluate(() => window.__room.debug.cam)
  const go = page.getByRole('button', { name: /Gå rundt/ }).first()
  await go.waitFor({ timeout: 60000 }) // (it is there once the room has drawn its first picture)
  await go.click({ force: true })
  await page.waitForTimeout(500)
  await page.evaluate(() => window.__room.fastForward(0.5))
  const start = await cam()
  assert.ok(Math.abs(start[1] - 1.6) < 0.05, `eye height 1.6 m (${start[1]})`)
  assert.ok(await page.getByText(/W A S D/).isVisible(), 'the hint is shown')

  // forward ("w") for a long time: it goes towards the back wall and stops at it
  await page.keyboard.down('w')
  await page.evaluate(() => window.__room.fastForward(8))
  await page.keyboard.up('w')
  const end = await cam()
  assert.ok(end[2] < start[2] - 0.5, `it walked forward (${start[2]} → ${end[2]})`)
  assert.ok(end[2] >= -3.3 && end[0] >= -3.8 && end[0] <= 3.8, `and stayed inside the room (${end})`)

  // C: crouch – the eyes go down, and back up when it is let go
  await page.keyboard.down('c')
  await page.evaluate(() => window.__room.fastForward(1.5))
  const low = await cam()
  assert.ok(low[1] < 0.95 && low[1] > 0.7, `crouched (${low[1]})`)
  await page.keyboard.up('c')
  await page.evaluate(() => window.__room.fastForward(1.5))
  assert.ok((await cam())[1] > 1.55, 'standing again')

  await page.keyboard.press('Escape')
  await page.waitForFunction(() => !document.body.innerText.includes('W A S D'), null, { timeout: 5000 })
  await page.evaluate(() => window.__room.fastForward(4))
  const back = await cam()
  assert.ok(back[1] > 3, `the camera is back at the overview station (${back})`)
  assert.deepEqual(page.errors, [])
})

test('free roam: a click on the iPod in the listening corner goes there and picks it up', async () => {
  const page = await openPage(browser, { mode: 'rom', width: 1100, height: 700 })
  await page.waitForFunction(() => !!window.__room, null, { timeout: 60000 })
  await page.waitForTimeout(3000)
  const go = page.getByRole('button', { name: /Gå rundt/ }).first()
  await go.waitFor({ timeout: 60000 })
  await go.click({ force: true })
  await page.evaluate(() => window.__room.fastForward(0.5))
  // turn towards the iPod until it is on the screen, then click it
  let at = null
  for (let i = 0; i < 40 && !at; i++) {
    const p = await page.evaluate(() => window.__room.screenOf('ipod'))
    if (p && p[0] > 100 && p[0] < 1000 && p[1] > 50 && p[1] < 650) at = p
    else { await page.evaluate(() => window.__room.roamLook(60, 0)); await page.evaluate(() => window.__room.fastForward(0.1)) }
  }
  assert.ok(at, 'the iPod came into view while turning')
  await page.mouse.click(at[0], at[1])
  await page.waitForFunction(() => location.hash.includes('lytte'), null, { timeout: 15000 })
  await page.evaluate(() => window.__room.fastForward(3))
  await page.locator('.ipod').waitFor({ timeout: 20000 }) // its screen is up: the iPod is in use
  assert.ok(await page.evaluate(() => !document.body.innerText.includes('W A S D')), 'walking has ended')
  // …and out of the iPod you are walking again, where you stood
  const before = await page.evaluate(() => window.__room.roamPose())
  await page.getByRole('button', { name: 'Lukk iPoden' }).first().dispatchEvent('click')
  await page.waitForFunction(() => document.body.innerText.includes('W A S D'), null, { timeout: 15000 })
  await page.evaluate(() => window.__room.fastForward(2))
  const after = await page.evaluate(() => window.__room.roamPose())
  assert.ok(Math.hypot(after.x - before.x, after.z - before.z) < 0.01, 'the same spot')
  assert.deepEqual(page.errors, [])
})
