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
