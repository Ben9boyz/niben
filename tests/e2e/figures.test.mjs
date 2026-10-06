import { test, before, after, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { launch, openPage, closePages, ownerClient, makeUser, tinyGlb } from './helpers.mjs'

let browser
before(async () => { browser = await launch() })
after(async () => { await browser?.close() })
afterEach(closePages)

test('a user\'s figures stand on the shelf in the room, and the Figurer tab shows them with name and description', async () => {
  const owner = await ownerClient()
  const bob = await makeUser(owner)
  const glb = tinyGlb()
  for (const [name, desc] of [['Grogu', 'En liten fyr.'], ['R2-D2', 'En robot.']]) {
    const r = await bob.client.upload('decor_figure_upload', { name, desc }, { name: `${name}.glb`, bytes: glb })
    assert.equal(r.status, 200, r.text)
  }
  // bob's own browser, logged in as him (so his room is the one shown)
  const page = await openPage(browser, { mode: 'rom', width: 1100, height: 700 })
  await page.evaluate(async ({ u, p }) => {
    await fetch('api.php?action=user_login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Niben': '1' }, body: JSON.stringify({ username: u, password: p }) })
  }, { u: bob.name, p: bob.password })
  await page.goto(`${process.env.NIBEN_APP}/#/figurer`)
  await page.reload()
  await page.waitForFunction(() => !!window.__room, null, { timeout: 60000 })
  await page.waitForFunction(() => window.__room.debug.figures.filter(Boolean).length === 2, null, { timeout: 90000 })
  const dbg = await page.evaluate(() => window.__room.debug)
  assert.equal(dbg.builtinFigures, false, 'the built-in set is not in a user\'s room')
  // the tab: the list, then one figure with its description
  await page.getByRole('button', { name: /Grogu/ }).click()
  await page.getByText('En liten fyr.').waitFor()
  assert.deepEqual(page.errors, [])
})
