import { test, before, after, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { launch, openPage, closePages, ownerClient, makeUser } from './helpers.mjs'

// The room must stay light enough for a weak machine. What one plain render costs, per view, may not grow past this:
//   a corner you look at: < 150 draw calls, < 70 000 triangles (the guitar wall – several many-part models – < 200 / 90 000)
//   the overview (everything in view): < 550 calls, < 200 000 triangles
// (A glass material with `transmission` once made the whole scene be drawn twice – 1100 calls for the overview.)
const BUDGET = { hjem: [550, 200000], lytte: [150, 70000], boker: [150, 70000], kode: [150, 70000], gitar: [200, 90000], japansk: [150, 70000], reiser: [150, 70000], ovelse: [150, 70000], om: [150, 70000] }

let browser
before(async () => { browser = await launch() })
after(async () => { await browser?.close() })
afterEach(closePages)

test('every view of the room stays inside the draw-call and triangle budget', async () => {
  const page = await openPage(browser, { mode: 'rom', width: 1280, height: 760 })
  await page.waitForFunction(() => !!window.__room, null, { timeout: 30000 })
  await page.waitForTimeout(3000)
  const rows = await page.evaluate((names) => {
    const r = window.__room
    return names.map((s) => { r.goTo(s, { instant: true }); r.fastForward(2); return { s, ...r.stats() } })
  }, Object.keys(BUDGET))
  for (const row of rows) {
    const [calls, tris] = BUDGET[row.s]
    assert.ok(row.calls < calls, `${row.s}: ${row.calls} draw calls (budget ${calls})`)
    assert.ok(row.triangles < tris, `${row.s}: ${row.triangles} triangles (budget ${tris})`)
  }
})

test('a room with twenty hobby modules stays inside the same budget', async () => {
  const owner = await ownerClient()
  const u = await makeUser(owner)
  const kinds = ['sjakk', 'filmer', 'serier', 'brettspill', 'retro', 'piano', 'oppskrifter', 'kaffe', 'vin', 'lego', 'kunst', 'foto', 'planter', 'akvarium', 'trening', 'sykling', 'styrke', 'camping', 'skriving', 'reisemal']
  for (const k of kinds) assert.equal((await u.client.post('mod_add', { type: k })).status, 200)
  const page = await openPage(browser, { mode: 'rom', width: 1280, height: 760 })
  await page.evaluate((n) => fetch('api.php?action=room_set', { method: 'POST', headers: { 'X-Niben': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ username: n }) }), u.name)
  await page.reload()
  await page.waitForFunction(() => !!window.__room, null, { timeout: 30000 })
  await page.waitForFunction(() => window.__room.dumpScene().filter((o) => /Sprite/.test(o[0])).length >= 20, null, { timeout: 30000 }) // (all twenty are standing)
  await page.waitForTimeout(2000)
  const rows = await page.evaluate((names) => {
    const r = window.__room
    return names.map((s) => { r.goTo(s, { instant: true }); r.fastForward(2); return { s, ...r.stats() } })
  }, Object.keys(BUDGET))
  for (const row of rows) {
    const [calls, tris] = BUDGET[row.s]
    assert.ok(row.calls < calls, `${row.s} with 20 modules: ${row.calls} draw calls (budget ${calls})`)
    assert.ok(row.triangles < tris, `${row.s} with 20 modules: ${row.triangles} triangles (budget ${tris})`)
  }
  assert.deepEqual(page.errors, [])
})

test('a corner far out of view is switched off, and comes back when the camera goes there', async () => {
  const page = await openPage(browser, { mode: 'rom', width: 1280, height: 760 })
  await page.waitForFunction(() => !!window.__room, null, { timeout: 30000 })
  await page.waitForTimeout(3000)
  const out = await page.evaluate(() => {
    const r = window.__room
    r.goTo('japansk', { instant: true }); r.fastForward(2)
    const away = r.stats()
    r.goTo('hjem', { instant: true }); r.fastForward(2)
    const all = r.stats()
    return { away, all }
  })
  assert.ok(out.away.calls < out.all.calls / 2, `a close-up draws far less than the overview (${out.away.calls} vs ${out.all.calls})`)
  assert.ok(out.away.lights <= out.all.lights)
})

test('paging through the hall a hundred times does not leave the old doors in memory', async () => {
  const page = await openPage(browser, { mode: 'rom', width: 1000, height: 700, hash: '/gangen' })
  await page.waitForFunction(() => !!window.__room, null, { timeout: 30000 })
  await page.waitForTimeout(2000)
  const mem = await page.evaluate(() => {
    const r = window.__room
    const doors = (n) => Array.from({ length: 12 }, (_, i) => ({ username: `rom${n}_${i}`, label: `Rom ${n}.${i}`, photo: null, door: null, owner: false }))
    r.goTo('gangen', { instant: true })
    r.setDoors(doors(0)); r.fastForward(1)
    const before = r.stats().geometries
    for (let n = 1; n <= 100; n++) { r.setDoors(doors(n)); r.fastForward(0.05) }
    r.fastForward(1)
    return { before, after: r.stats().geometries }
  })
  assert.ok(mem.after <= mem.before + 20, `geometries in memory: ${mem.before} → ${mem.after}`)
  assert.deepEqual(page.errors, [])
})
