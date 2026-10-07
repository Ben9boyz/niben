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

test('a picture for an entry can be uploaded – and only the room that uploaded it can use or throw it away', async () => {
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
  const owner = await ownerClient()
  const alice = await makeUser(owner)
  const bob = await makeUser(owner)
  const am = (await alice.client.post('mod_add', { type: 'oppskrifter' })).json.item.id
  const bm = (await bob.client.post('mod_add', { type: 'oppskrifter' })).json.item.id

  assert.notEqual((await bob.client.upload('mod_image', { id: am }, { name: 'x.png', bytes: PNG })).status, 200, 'not into somebody else’s module')
  const up = await alice.client.upload('mod_image', { id: am }, { name: 'x.png', bytes: PNG })
  assert.equal(up.status, 200, up.text)
  const path = up.json.path
  assert.match(path, /^uploads\/photos\/[a-f0-9]{20}\.jpg$/)

  // bob cannot put alice's picture in his own entry, nor throw it away
  const bs = await bob.client.post('mod_save', { id: bm, data: { items: [{ t: 'Tyveri', img: path }] } })
  assert.equal(bs.json.data.items[0].img, undefined, 'somebody else’s upload is left out')
  await bob.client.post('mod_image_drop', { id: bm, path })
  const as = await alice.client.post('mod_save', { id: am, data: { items: [{ t: 'Pannekaker', img: path }] } })
  assert.equal(as.json.data.items[0].img, path, 'her own goes in')
  assert.equal((await alice.client.get('mod_get', `&id=${am}`)).json.data.items[0].img, path)
  // a saved one is not thrown away by a drop
  await alice.client.post('mod_image_drop', { id: am, path })
  assert.equal((await alice.client.get('mod_get', `&id=${am}`)).json.data.items[0].img, path)
})

test('the aquarium game: everybody can look at it, only the owner saves it, and a trophy goes in the room only once it is won', async () => {
  const owner = await ownerClient()
  const alice = await makeUser(owner)
  const id = (await alice.client.post('mod_add', { type: 'akvarium' })).json.item.id
  assert.equal((await alice.client.get('mod_game_get', `&id=${id}`)).json.state, null, 'a new tank')

  const state = { v: 1, coins: 120, total: 900, fish: [{ id: 'a1', sp: 'guppy', hunger: 0.5 }], up: { tank: 1, food: 0, feeder: 0, magnet: 0 }, trophies: ['first', 'lvl5'], placed: [], stats: { fed: 3, bought: 1, collected: 9 }, last: Date.now() }
  assert.equal((await alice.client.post('mod_game_save', { id, state })).status, 200)
  const v = await visitorIn(alice.name)
  assert.equal((await v.get('mod_game_get', `&id=${id}`)).json.state.coins, 120, 'a visitor sees the tank')
  assert.notEqual((await v.post('mod_game_save', { id, state: { ...state, coins: 1e12 } })).status, 200, 'but cannot change it')
  assert.equal((await alice.client.post('mod_game_save', { id, state: { big: 'x'.repeat(40000) } })).status, 400, 'nothing huge')

  // a trophy not won yet: no; a won one: a cup in the room (once)
  assert.equal((await alice.client.post('mod_trophy', { id, trophy: 'lvl100', tier: 'legende', name: 'Havets hersker' })).status, 400)
  const t1 = await alice.client.post('mod_trophy', { id, trophy: 'lvl5', tier: 'bronse', name: 'Akvarist' })
  assert.equal(t1.status, 200, t1.text)
  assert.equal(t1.json.item.trophy, `${id}:lvl5`)
  assert.equal(t1.json.item.tier, 'bronse')
  const t2 = await alice.client.post('mod_trophy', { id, trophy: 'lvl5', tier: 'gull', name: 'x' })
  assert.equal(t2.json.item.id, t1.json.item.id, 'the same one – not two')
  const items = (await alice.client.get('decor_get')).json.items
  assert.equal(items.filter((i) => i.trophy).length, 1)

  // the hobby taken away: its game goes too
  await alice.client.post('mod_remove', { id })
  assert.equal((await alice.client.get('mod_game_get', `&id=${id}`)).status, 404)
})
