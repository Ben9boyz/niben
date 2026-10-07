import { test, before, after, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { launch, openPage, closePages, ownerClient, makeUser, clearLimits } from './helpers.mjs'

let browser
before(async () => { browser = await launch() })
after(async () => { await browser?.close() })
afterEach(closePages)

async function loggedIn(u, mode = 'enkel') {
  clearLimits()
  const page = await openPage(browser, { mode, hash: '/admin', width: 1200, height: 900 })
  await page.getByLabel(/Brukernavn/).fill(u.name)
  await page.getByLabel(/^Passord/).fill(u.password)
  await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'Logg inn' }).last().click()])
  await page.locator('.side .it').first().waitFor()
  return page
}

test('the aquarium is a game: buy a fish, feed it, and put a trophy won in the room', async () => {
  const owner = await ownerClient()
  const u = await makeUser(owner)
  const id = (await u.client.post('mod_add', { type: 'akvarium', name: 'Akvariet' })).json.item.id
  await u.client.post('mod_game_save', { id, state: { v: 1, coins: 500, total: 60, fish: [], up: { tank: 0, food: 0, feeder: 0, magnet: 0 }, trophies: [], placed: [], stats: { fed: 0, bought: 0, collected: 0 }, last: Date.now() } })
  const page = await loggedIn(u)
  await page.evaluate((m) => { location.hash = `#/h/${m}` }, id)
  await page.locator('.aq canvas').waitFor()
  await page.locator('[data-test=coins]', { hasText: '500' }).waitFor()

  // buy two guppies and a neon (level 2: 60 coins collected)
  await page.locator('.card', { hasText: 'Guppy' }).click()
  await page.locator('.card', { hasText: 'Guppy' }).click()
  await page.locator('.card', { hasText: 'Neontetra' }).click()
  await page.locator('.fishn', { hasText: '3/4' }).waitFor()
  // a tap in the water drops food
  const box = await page.locator('.aq canvas').boundingBox()
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.3)
  if (process.env.SHOT) { await page.waitForTimeout(6000); fs.writeFileSync(process.env.SHOT, await page.locator('.aq .tank').screenshot()) } // (SHOT=file.png: a picture of the tank)

  // the first trophy is won – into the room with it
  await page.getByRole('tab', { name: /Trofeer/ }).click()
  await page.locator('.trophy.won', { hasText: 'Første fisk' }).getByRole('button', { name: 'Sett i rommet' }).click()
  await page.locator('.trophy.won', { hasText: 'Første fisk' }).getByText('I rommet', { exact: true }).waitFor()
  const items = (await u.client.get('decor_get')).json.items
  assert.ok(items.some((i) => i.trophy === `${id}:first`), 'the cup is in the room')
  const saved = (await u.client.get('mod_game_get', `&id=${id}`)).json.state
  assert.equal(saved.fish.length, 3, 'the fish were saved')
  assert.ok(saved.coins < 500)
  assert.deepEqual(page.errors, [])
})

test('in the 3D room the fish swim in the aquarium and a trophy stands as a cup', async () => {
  const owner = await ownerClient()
  const u = await makeUser(owner)
  const id = (await u.client.post('mod_add', { type: 'akvarium' })).json.item.id
  await u.client.post('mod_game_save', { id, state: { v: 1, coins: 0, total: 5000, fish: [{ id: 'a', sp: 'guppy', hunger: 1 }, { id: 'b', sp: 'klovn', hunger: 1 }], up: { tank: 0, food: 0, feeder: 0, magnet: 0 }, trophies: ['first', 'lvl10'], placed: [], stats: { fed: 0, bought: 2, collected: 0 }, last: Date.now() } })
  const cup = (await u.client.post('mod_trophy', { id, trophy: 'lvl10', tier: 'solv', name: 'Fiskevenn' })).json.item
  const page = await openPage(browser, { mode: 'rom', width: 1100, height: 700 })
  await page.evaluate((n) => fetch('api.php?action=room_set', { method: 'POST', headers: { 'X-Niben': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ username: n }) }), u.name)
  await page.reload()
  await page.waitForFunction(([a, b]) => !!window.__room?.decorBounds(a) && !!window.__room?.decorBounds(b), [id, cup.id], { timeout: 30000 })
  const fish = await page.waitForFunction((a) => window.__room.dumpScene().filter((o) => o[0].includes(`mod-${a}/`) && o[0].includes('/tankFish/') && o[0].endsWith('Mesh')).length, id, { timeout: 15000 }).then((h) => h.jsonValue())
  assert.ok(fish >= 4, `two fish (a body and a tail each) in the tank: ${fish}`)
  const b = await page.evaluate((c) => window.__room.decorBounds(c), cup.id)
  assert.ok(b.max[1] > 0.3, 'a cup standing on the floor')
  if (process.env.SHOT3D) {
    await page.evaluate(([a, c]) => { const r = window.__room; r.adjustDecor(c, { x: (r.decorBounds(a).min[0] + r.decorBounds(a).max[0]) / 2 + 0.7, z: (r.decorBounds(a).min[2] + r.decorBounds(a).max[2]) / 2 }); r.focusModule(a); r.goTo('modul', { instant: true }); r.fastForward(2) }, [id, cup.id])
    await page.waitForTimeout(2000)
    fs.writeFileSync(process.env.SHOT3D, await page.screenshot())
  }
  assert.deepEqual(page.errors, [])
})
