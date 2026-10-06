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
  await page.getByRole('button', { name: 'Gå rundt i rommet' }).click({ force: true })
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

  await page.keyboard.press('Escape')
  await page.waitForFunction(() => !document.body.innerText.includes('W A S D'), null, { timeout: 5000 })
  await page.evaluate(() => window.__room.fastForward(4))
  const back = await cam()
  assert.ok(back[1] > 3, `the camera is back at the overview station (${back})`)
  assert.deepEqual(page.errors, [])
})
