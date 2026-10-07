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

  // a link or a picture is only ever http(s): nothing that could run in a visitor's browser
  const urls = await alice.client.post('mod_save', { id, data: { items: [{ t: 'A', url: 'javascript:alert(1)', img: 'https://x.no/a.jpg' }, { t: 'B', url: 'https://ok.no/x (1)', img: 'data:text/html,hi' }] } })
  assert.equal(urls.json.data.items[0].url, undefined)
  assert.equal(urls.json.data.items[0].img, 'https://x.no/a.jpg')
  assert.equal(urls.json.data.items[1].url, 'https://ok.no/x%20%281%29')
  assert.equal(urls.json.data.items[1].img, undefined)
  await alice.client.post('mod_save', { id, data })

  // several at once (the ratings page): only this room's modules
  const many = await visitorIn(alice.name).then((v) => v.get('mod_get_many', `&ids=${id},ffffffffff`))
  assert.deepEqual(Object.keys(many.json.data), [id])

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

  // her own 3D model instead of the built-in one: only .glb, only her module, and it can be taken away
  const glb = Buffer.concat([Buffer.from('glTF'), Buffer.alloc(20)])
  assert.equal((await alice.client.upload('mod_model', { id }, { name: 'x.png', bytes: glb })).status, 400)
  assert.equal((await alice.client.upload('mod_model', { id }, { name: 'x.glb', bytes: Buffer.from('nope') })).status, 400)
  assert.ok([403, 404].includes((await bob.client.upload('mod_model', { id }, { name: 'x.glb', bytes: glb })).status))
  const up = await alice.client.upload('mod_model', { id }, { name: 'kino.glb', bytes: glb })
  assert.equal(up.status, 200, up.text)
  assert.match(up.json.item.file, /^uploads\/models\/[0-9a-f]+\.glb$/)
  assert.equal((await alice.client.post('mod_model_clear', { id })).status, 200)
  assert.equal((await alice.client.get('decor_get')).json.items.find((i) => i.id === id).file, '')

  // alice removes it
  assert.equal((await alice.client.post('mod_remove', { id })).status, 200)
  assert.equal((await alice.client.get('decor_get')).json.items.find((i) => i.id === id), undefined)
})

test('the room’s own corners are in the same list: a name, a symbol (only from the icon set), moved and hidden like a hobby', async () => {
  const owner = await ownerClient()
  const alice = await makeUser(owner)
  const list = (await alice.client.get('decor_get')).json.items
  assert.deepEqual(list.filter((i) => i.corner).map((i) => i.corner).sort(), ['boker', 'figurer', 'gitar', 'japansk', 'kode', 'lytte', 'om', 'ovelse', 'reiser'])
  const r = await alice.client.post('decor_save', { items: [{ id: 'c-japansk', x: 2.5, z: -1, rot: 0.5, scale: 1.2, name: 'Nihongo', ico: 'Languages', visible: false }, { id: 'c-lytte', ico: '🎵' }, { id: 'c-nope', x: 1 }] })
  assert.equal(r.status, 200, r.text)
  const j = r.json.items.find((i) => i.id === 'c-japansk')
  assert.deepEqual([j.x, j.z, j.rot, j.scale, j.name, j.ico, j.visible], [2.5, -1, 0.5, 1.2, 'Nihongo', 'Languages', false])
  assert.equal(r.json.items.find((i) => i.id === 'c-lytte').ico, '', 'an emoji is not a symbol')
  assert.equal(r.json.items.find((i) => i.id === 'c-nope'), undefined, 'no corners that do not exist')
  // another room's corners are its own
  assert.equal((await owner.get('decor_get')).json.items.find((i) => i.id === 'c-japansk').x, 0)
})
