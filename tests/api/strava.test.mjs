import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ownerClient, makeUser, db } from './helpers.mjs'

test('Strava: a connected room gets its workouts into its Trening module – once each, with distance, time, pulse and route', async () => {
  const owner = await ownerClient()
  const alice = await makeUser(owner)
  const st0 = (await alice.client.get('strava_status')).json
  assert.equal(st0.configured, true)
  assert.equal(st0.connected, false)
  const mod = (await alice.client.post('mod_add', { type: 'trening' })).json.item
  assert.equal((await alice.client.post('strava_sync', { id: mod.id })).status, 409, 'not connected yet')

  db('strava', String(alice.id))
  assert.equal((await alice.client.get('strava_status')).json.athlete, 'Test Løper')
  const r = await alice.client.post('strava_sync', { id: mod.id })
  assert.equal(r.status, 200, r.text)
  assert.equal(r.json.added, 2)
  const run = r.json.data.items.find((e) => e.sid === '111')
  assert.deepEqual([run.kat, run.km, run.min, run.hm, run.puls, run.date], ['Løping', 5.23, 26, 42, 151, '2026-09-01'])
  assert.match(run.route, /^\d{1,3},\d{1,3}( \d{1,3},\d{1,3})+$/)
  assert.equal(r.json.data.items.find((e) => e.sid === '222').kat, 'Sykling')

  // again: nothing twice
  assert.equal((await alice.client.post('strava_sync', { id: mod.id })).json.added, 0)
  // only into a Trening module of my own
  const film = (await alice.client.post('mod_add', { type: 'filmer' })).json.item
  assert.equal((await alice.client.post('strava_sync', { id: film.id })).status, 404)
  const bob = await makeUser(owner)
  assert.ok([403, 404].includes((await bob.client.post('strava_sync', { id: mod.id })).status))

  assert.equal((await alice.client.post('strava_disconnect', {})).status, 200)
  assert.equal((await alice.client.get('strava_status')).json.connected, false)
})
