import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ownerClient, makeUser, visitorIn } from './helpers.mjs'

test('hobby modules: a room adds, fills, moves and removes them; others only look', async () => {
  const owner = await ownerClient()
  const alice = await makeUser(owner)
  const bob = await makeUser(owner)

  assert.equal((await alice.client.post('mod_add', { type: 'Not A Kind!' })).status, 400)
  const add = await alice.client.post('mod_add', { type: 'filmer', name: 'Kinokvelder' })
  assert.equal(add.status, 200, add.text)
  const id = add.json.item.id
  assert.equal(add.json.item.mod, 'filmer')

  // entries: flat, short, only plain values; junk keys are dropped
  const data = { items: [{ t: 'Alien', rating: 5, kat: 'Skrekk', 'bad key!': 'x', note: 'n'.repeat(900) }, {}], settings: { account: 'magnus' } }
  const saved = await alice.client.post('mod_save', { id, data })
  assert.equal(saved.status, 200, saved.text)
  assert.equal(saved.json.data.items.length, 1)
  assert.equal(saved.json.data.items[0].t, 'Alien')
  assert.equal(saved.json.data.items[0]['bad key!'], undefined)
  assert.equal(saved.json.data.items[0].note.length, 400)

  // it is in the room's decor list (that is how it gets a place) and can be moved
  const list = (await alice.client.get('decor_get')).json.items
  assert.ok(list.find((i) => i.id === id && i.mod === 'filmer'))
  const moved = await alice.client.post('decor_save', { items: [{ id, x: 1.5, z: 2, rot: 1, scale: 1, name: 'Kino' }] })
  assert.equal(moved.status, 200, moved.text)
  assert.equal(moved.json.items.find((i) => i.id === id).x, 1.5)

  // visitors read, nobody else writes
  const v = await visitorIn(alice.name)
  assert.equal((await v.get('mod_get', `&id=${id}`)).json.data.items.length, 1)
  assert.ok([401, 403].includes((await v.post('mod_save', { id, data: { items: [{ t: 'x' }] } })).status))
  assert.ok([403, 404].includes((await bob.client.post('mod_save', { id, data: { items: [{ t: 'x' }] } })).status))
  assert.ok([403, 404].includes((await bob.client.post('mod_remove', { id })).status))

  // alice removes it
  assert.equal((await alice.client.post('mod_remove', { id })).status, 200)
  assert.equal((await alice.client.get('decor_get')).json.items.find((i) => i.id === id), undefined)
})
