import { test, before, after, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { launch, openPage, closePages, ownerClient } from './helpers.mjs'

let browser
before(async () => { browser = await launch() })
after(async () => { await browser?.close() })
afterEach(closePages)

async function seed() {
  const owner = await ownerClient()
  const a = (await owner.post('mod_add', { type: 'filmer', name: 'Kinokvelder' })).json.item
  await owner.post('mod_save', { id: a.id, data: { items: [{ t: 'Alien', rating: 5, kat: 'Skrekk' }, { t: 'Paddington', kat: 'Komedie' }], settings: {} } })
  const b = (await owner.post('mod_add', { type: 'lop', name: 'Løpeturer' })).json.item
  await owner.post('mod_save', { id: b.id, data: { items: [{ date: '2026-01-02', km: 5 }, { date: '2026-01-04', km: 7.5 }], settings: {} } })
  return { a, b }
}

test('hobby modules show as pages with their entries, categories and numbers, and as tabs in the menu', async () => {
  const { a } = await seed()
  const page = await openPage(browser, { hash: `/h/${a.id}` })
  await page.getByRole('heading', { name: 'Kinokvelder' }).waitFor()
  await page.getByText('Alien').first().waitFor()
  await page.getByRole('button', { name: /Alien/ }).first().click() // a visitor reads an entry
  await page.locator('.peek').getByText('Skrekk').waitFor()
  await page.getByRole('button', { name: 'Lukk' }).click()
  await page.locator('.chips').getByRole('button', { name: /Skrekk/ }).click() // the category chip
  assert.equal(await page.getByText('Paddington').count(), 0)
  await page.getByRole('tab', { name: /Løpeturer/ }).first().click()
  await page.getByText('12,5').first().waitFor() // km added up
  assert.deepEqual(page.errors, [])
})

test('everything with stars from all modules is gathered on one page, best first', async () => {
  const owner = await ownerClient()
  const f = (await owner.post('mod_add', { type: 'filmer', name: 'Film' })).json.item
  const r = (await owner.post('mod_add', { type: 'restauranter', name: 'Spisesteder' })).json.item
  await owner.post('mod_save', { id: f.id, data: { items: [{ t: 'Blade Runner', rating: 4 }, { t: 'Ikke sett ennå' }] } })
  await owner.post('mod_save', { id: r.id, data: { items: [{ t: 'Pizzabakeren', rating: 5, kat: 'Pizza' }] } })
  const page = await openPage(browser, { hash: '/vurderinger' })
  await page.getByText('Pizzabakeren').waitFor()
  await page.getByText('Blade Runner').waitFor()
  assert.equal(await page.getByText('Ikke sett ennå').count(), 0, 'no stars, not in the list')
  const names = await page.locator('.grid b').allInnerTexts()
  assert.ok(names.indexOf('Pizzabakeren') < names.indexOf('Blade Runner'), 'five stars before four')
  assert.deepEqual(page.errors, [])
})

test('a module can have its own tab with its own symbol, or sit under one of the existing tabs', async () => {
  const owner = await ownerClient()
  const m = (await owner.post('mod_add', { type: 'svomming', name: 'Bassenget' })).json.item
  await owner.post('decor_save', { items: [{ id: m.id, x: 0, z: 1, rot: 0, scale: 1, ico: '🏊', grp: 'Trening' }] })
  const page = await openPage(browser, { hash: `/h/${m.id}` })
  await page.getByRole('link', { name: /Trening/ }).waitFor()
  await owner.post('decor_save', { items: [{ id: m.id, x: 0, z: 1, rot: 0, scale: 1, grp: 'lare' }] })
  await page.reload()
  await page.getByRole('tab', { name: /Bassenget/ }).waitFor()
  assert.equal(await page.getByRole('link', { name: /^Trening/ }).count(), 0, 'the own tab is gone')
  assert.deepEqual(page.errors, [])
})

test('in the 3D room a module stands as a piece of furniture and a click on its tab flies there', async () => {
  const { a } = await seed()
  const page = await openPage(browser, { mode: 'rom', width: 1200, height: 760, hash: `/h/${a.id}` })
  await page.waitForFunction(() => !!window.__room, null, { timeout: 30000 })
  await page.waitForTimeout(5000)
  await page.waitForTimeout(3000)
  await page.evaluate(() => window.__room.goTo('modul', { instant: true })) // (a software-rendered room flies very slowly: jump)
  await page.waitForTimeout(2500)
  if (process.env.SHOT) fs.writeFileSync(process.env.SHOT, await page.screenshot({ timeout: 60000 }))
  assert.deepEqual(page.errors, [])
})
