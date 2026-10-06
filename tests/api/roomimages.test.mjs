import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ownerClient, makeUser } from './helpers.mjs'

// a 1×1 PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

test('a room can have its own door and walls: only known places, kept when the text is saved, shown in the hall list', async () => {
  const owner = await ownerClient()
  const alice = await makeUser(owner)
  assert.equal((await alice.client.upload('about_image', { slot: 'ceiling' }, { name: 'a.png', bytes: PNG })).status, 400, 'unknown place')
  const up = await alice.client.upload('about_image', { slot: 'door' }, { name: 'd.png', bytes: PNG })
  assert.equal(up.status, 200, up.text)
  assert.match(up.json.bilder.door, /^uploads\/photos\/[0-9a-f]+\.jpg$/)
  await alice.client.upload('about_image', { slot: 'wall_back' }, { name: 'w.png', bytes: PNG })

  // the text is saved: the pictures stay
  await alice.client.post('about_save', { tagline: 'x', tekst: '', lenker: [] })
  const about = (await alice.client.get('content')).json.about
  assert.ok(about.bilder.door && about.bilder.wall_back)

  // the door shows in the list of rooms
  const rooms = (await owner.get('rooms')).json.rooms
  assert.ok(rooms.find((r) => r.username === alice.name).door)

  // and can be taken away again
  const cl = await alice.client.post('about_image_clear', { slot: 'door' })
  assert.equal(cl.status, 200, cl.text)
  assert.equal(cl.json.bilder.door, undefined)
  assert.ok(cl.json.bilder.wall_back)
})
