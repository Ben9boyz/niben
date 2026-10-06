import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { Client, ownerClient, makeUser, visitorIn, DIR } from './helpers.mjs'

const GLB = Buffer.concat([Buffer.from('glTF'), Buffer.alloc(40)])

test('a guitar gets its own 3D model: only a real .glb, only in the owner\'s own room, and it can be taken away again', async () => {
  const owner = await ownerClient()
  const alice = await makeUser(owner)
  const g = await alice.client.post('guitar_save', { name: 'Alices strat', color: '#aa3322' })
  const id = (await alice.client.get('content')).json.guitars[0].id
  assert.ok(id, g.text)

  // wrong kind of file
  assert.equal((await alice.client.upload('decor_guitar_upload', { id }, { name: 'x.png', bytes: GLB })).status, 400)
  assert.equal((await alice.client.upload('decor_guitar_upload', { id }, { name: 'x.glb', bytes: Buffer.from('not a model at all') })).status, 400)
  // nobody else can give her guitar a model
  const visitor = await visitorIn(alice.name)
  assert.ok([401, 403].includes((await visitor.upload('decor_guitar_upload', { id }, { name: 'x.glb', bytes: GLB })).status))

  const up = await alice.client.upload('decor_guitar_upload', { id }, { name: 'strat.glb', bytes: GLB })
  assert.equal(up.status, 200, up.text)
  const file = up.json.models[id]
  assert.match(file, /^uploads\/models\/[0-9a-f]+\.glb$/)
  assert.ok(existsSync(`${DIR}/${file}`), 'the file is stored')
  // the room's content carries it – for alice and for a visitor in her room, not for the main room
  assert.equal((await alice.client.get('content')).json.guitar_models[id], file)
  assert.equal((await visitor.get('content')).json.guitar_models[id], file)
  assert.equal((await new Client().get('content')).json.guitar_models[id], undefined)

  // a new upload replaces the old file
  const again = await alice.client.upload('decor_guitar_upload', { id }, { name: 'strat2.glb', bytes: GLB })
  assert.notEqual(again.json.models[id], file)
  assert.ok(!existsSync(`${DIR}/${file}`), 'the old file is gone')

  const del = await alice.client.post('decor_guitar_delete', { id })
  assert.equal(del.status, 200)
  assert.deepEqual(Object.keys((await alice.client.get('content')).json.guitar_models), [])
})

test('the owner\'s built-in guitar models (the files next to the site) are copied over to uploads once, nothing deleted', async () => {
  const owner = await ownerClient()
  const c = await owner.get('content')
  const models = c.json.guitar_models
  const ids = Object.keys(models)
  assert.ok(ids.includes('pacifica') && ids.includes('fs820'), `adopted: ${JSON.stringify(models)}`)
  for (const id of ids) assert.ok(existsSync(`${DIR}/${models[id]}`))
  assert.ok(existsSync(`${DIR}/pacifica.glb`), 'the original file is still there')
  // the second time nothing new is made
  assert.deepEqual((await owner.get('content')).json.guitar_models, models)
})

test('figures on the shelf: a .glb with a name and a description, kept per room, in order, at most twelve', async () => {
  const owner = await ownerClient()
  const bob = await makeUser(owner)
  assert.equal((await bob.client.get('content')).json.figures.length, 0, 'a new room starts with an empty shelf')
  assert.equal((await bob.client.upload('decor_figure_upload', { name: 'Fake' }, { name: 'a.glb', bytes: Buffer.from('nope') })).status, 400)
  const a = await bob.client.upload('decor_figure_upload', { name: 'Grogu', desc: 'En liten fyr.' }, { name: 'grogu.glb', bytes: GLB })
  assert.equal(a.status, 200, a.text)
  const b = await bob.client.upload('decor_figure_upload', { name: 'R2' }, { name: 'r2.glb', bytes: GLB })
  assert.deepEqual(b.json.figures.map((f) => f.name), ['Grogu', 'R2'])
  assert.equal(b.json.figures[0].desc, 'En liten fyr.')
  const [f1, f2] = b.json.figures
  // renamed, described and put in another order
  const saved = await bob.client.post('decor_figure_save', { items: [{ id: f2.id, name: 'R2-D2', desc: 'Robot' }, { id: f1.id }] })
  assert.deepEqual(saved.json.figures.map((f) => f.name), ['R2-D2', 'Grogu'])
  assert.equal(saved.json.figures[0].desc, 'Robot')
  // the owner and a visitor in the room see their own shelves
  assert.deepEqual((await (await visitorIn(bob.name)).get('content')).json.figures.map((f) => f.name), ['R2-D2', 'Grogu'])
  assert.ok(!(await owner.get('content')).json.figures.some((f) => f.name === 'R2-D2'))
  // a visitor cannot change it
  const v = await visitorIn(bob.name)
  assert.ok([401, 403].includes((await v.post('decor_figure_delete', { id: f1.id })).status))
  // deleting removes the file
  const del = await bob.client.post('decor_figure_delete', { id: f1.id })
  assert.deepEqual(del.json.figures.map((f) => f.name), ['R2-D2'])
  assert.ok(!existsSync(`${DIR}/${f1.file}`))
  // the twelve-limit
  for (let i = 0; i < 11; i++) assert.equal((await bob.client.upload('decor_figure_upload', { name: `F${i}` }, { name: 'f.glb', bytes: GLB })).status, 200)
  assert.equal((await bob.client.upload('decor_figure_upload', { name: 'one too many' }, { name: 'f.glb', bytes: GLB })).status, 400)
})
