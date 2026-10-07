import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Client, ownerClient, makeUser, visitorIn, mockSpotify, spotifyCalls, clearCalls, db, sleep } from './helpers.mjs'

const WRITES = ['spotify_play', 'spotify_control', 'spotify_lock', 'spotify_save', 'spotify_unsave', 'spotify_follow', 'spotify_playlist_create', 'spotify_refresh', 'spotify_cache_clear', 'spotify_disconnect', 'spotify_groups_save']
const names = (r) => r.json.albums.map((a) => a.name)

test('only the logged-in owner of the room controls its music', async () => {
  mockSpotify({ albums: 1 })
  const owner = await ownerClient()
  const alice = await makeUser(owner)
  const bob = await makeUser(owner)
  db('connect', String(alice.id))
  const body = { uri: 'spotify:album:AAAAAAAAAAAAAAAAAAAAAA', seconds: 60, op: 'pause' }

  const visitor = await visitorIn(alice.name)
  const bobInAlices = await visitorIn(alice.name)
  await bobInAlices.post('user_login', { username: bob.name, password: bob.password })
  await bobInAlices.post('room_set', { username: alice.name })
  const ownerInAlices = await ownerClient()
  await ownerInAlices.post('room_set', { username: alice.name })

  for (const action of WRITES) {
    assert.equal((await new Client().post(action, body)).status, 401, `nobody → ${action}`)
    assert.equal((await visitor.post(action, body)).status, 401, `a visitor → ${action}`)
    assert.equal((await bobInAlices.post(action, body)).status, 403, `another user in her room → ${action}`)
    assert.equal((await ownerInAlices.post(action, body)).status, 403, `the main room’s owner in her room → ${action}`)
  }
  assert.equal((await visitor.get('spotify_search', '&q=abba')).status, 401)
  assert.equal((await ownerInAlices.get('spotify_search', '&q=abba')).status, 401)

  // the room's own owner is let through (the fake Spotify just has no device to play on)
  const mine = await alice.client.post('spotify_play', body)
  assert.ok(![401, 403].includes(mine.status), `alice → ${mine.status} ${mine.text}`)
})

test('a room is not connected until its owner connects it', async () => {
  const owner = await ownerClient()
  const alice = await makeUser(owner)
  const r = await visitorIn(alice.name).then((v) => v.get('spotify_public'))
  assert.equal(r.json.connected, false)
  assert.equal(r.json.configured, true)
  assert.equal(r.json.room, alice.id)
})

test('each room shows its own library', async () => {
  mockSpotify({ albums: 2 })
  const owner = await ownerClient()
  const alice = await makeUser(owner)
  const bob = await makeUser(owner)
  db('connect', String(alice.id))
  assert.deepEqual(names(await alice.client.get('spotify_public')), ['Album 2', 'Album 1'])
  assert.deepEqual((await bob.client.get('spotify_public')).json.albums ?? [], [])
  assert.deepEqual(names(await visitorIn(alice.name).then((v) => v.get('spotify_public'))), ['Album 2', 'Album 1'])
})

test('an account Spotify refuses (not on the app’s list) is told so, instead of an empty shelf', async () => {
  const owner = await ownerClient()
  const alice = await makeUser(owner)
  db('connect', String(alice.id))
  mockSpotify({ albums: 2, deny: true })
  const denied = await alice.client.get('spotify_public')
  assert.equal(denied.json.connected, true)
  assert.equal(denied.json.denied, true)
  assert.deepEqual(denied.json.albums, [])
  assert.equal((await alice.client.get('me_settings')).json.spotify.denied, true)

  mockSpotify({ albums: 2 }) // the owner added them to the dashboard
  await alice.client.post('spotify_refresh')
  const ok = await alice.client.get('spotify_public')
  assert.equal(ok.json.denied, false)
  assert.equal(ok.json.albums.length, 2)
})

test('an album added in Spotify shows up within the probe time – no manual refresh', async () => {
  mockSpotify({ albums: 2 })
  const owner = await ownerClient()
  const alice = await makeUser(owner)
  db('connect', String(alice.id))
  const first = await alice.client.get('spotify_public')
  assert.equal(first.json.albums.length, 2)
  const stamp = first.json.lib
  assert.ok(stamp)

  mockSpotify({ albums: 3 })
  await sleep(1300) // (probe_ttl is 1 s in the tests, 45 s for real)
  const now = await alice.client.get('spotify_now') // what the page asks all the time
  assert.notEqual(now.json.lib, stamp, 'the cheap poll notices the change')
  assert.deepEqual(names(await alice.client.get('spotify_public')), ['Album 3', 'Album 2', 'Album 1'])

  // …and when nothing changed the big lists are not fetched again
  clearCalls()
  await alice.client.get('spotify_public')
  await sleep(1300)
  await alice.client.get('spotify_public')
  assert.ok(!spotifyCalls().some((c) => /\/me\/albums\?limit=50/.test(c)), spotifyCalls().join('\n'))
})

test('a long album is read to the end, even when Spotify hands out 20 at a time', async () => {
  mockSpotify({ albums: 1, tracks: { BIGBIGBIGBIG: 199 }, page: 20 })
  const owner = await ownerClient()
  const alice = await makeUser(owner)
  db('connect', String(alice.id))
  const r = await alice.client.get('spotify_tracks', '&type=album&id=BIGBIGBIGBIG')
  assert.equal(r.json.tracks.length, 199)
  assert.equal(r.json.total, 199)
  assert.deepEqual([r.json.tracks[0].n, r.json.tracks[198].n], [1, 199])
})

test('what is public is fetched from Spotify once for every room; what is private is not shared', async () => {
  mockSpotify({ albums: 1, tracks: { SHAREDALBUM01: 5 }, page: 50 })
  const owner = await ownerClient()
  const alice = await makeUser(owner)
  const bob = await makeUser(owner)
  db('connect', String(alice.id))
  db('connect', String(bob.id))
  clearCalls()
  assert.equal((await alice.client.get('spotify_tracks', '&type=album&id=SHAREDALBUM01')).json.tracks.length, 5)
  assert.equal((await bob.client.get('spotify_tracks', '&type=album&id=SHAREDALBUM01')).json.tracks.length, 5)
  assert.equal(spotifyCalls().filter((c) => c.includes('/albums/SHAREDALBUM01/tracks')).length, 1, spotifyCalls().join('\n'))

  // each room's own library is asked for separately
  clearCalls()
  await alice.client.get('spotify_public')
  await bob.client.get('spotify_public')
  assert.equal(spotifyCalls().filter((c) => /\/me\/albums\?limit=50/.test(c)).length, 2)
})

test('the queue is served from a short cache that play and skip empty', async () => {
  mockSpotify({ albums: 1 })
  const owner = await ownerClient()
  const alice = await makeUser(owner)
  db('connect', String(alice.id))
  clearCalls()
  await alice.client.get('spotify_queue')
  await alice.client.get('spotify_queue')
  assert.equal(spotifyCalls().filter((c) => c.includes('/me/player/queue')).length, 1, 'a second look costs nothing')
  assert.notEqual(JSON.parse(db('kv', String(alice.id), 'cache_queue4')), null, 'the answer is kept')
  mockSpotify({ albums: 1, device: true })
  const played = await alice.client.post('spotify_play', { uri: 'spotify:album:AAAAAAAAAAAAAAAAAAAAAA' })
  assert.equal(played.status, 200, played.text)
  assert.equal(JSON.parse(db('kv', String(alice.id), 'cache_queue4')), null, 'a new album means a new queue: the kept one is thrown away')
})

test('there are no folders to begin with; a room makes its own and may delete them all', async () => {
  const owner = await ownerClient()
  const alice = await makeUser(owner)
  db('connect', String(alice.id))
  mockSpotify({ albums: 2 })
  const start = await alice.client.get('spotify_groups')
  assert.deepEqual(start.json.groups, [])
  assert.deepEqual(start.json.assign, [], 'and nothing is sorted into folders that do not exist')

  const made = await alice.client.post('spotify_groups_save', { groups: [{ name: 'Min mappe' }] })
  assert.equal(made.json.groups.length, 1)
  assert.equal(made.json.groups[0].name, 'Min mappe')
  assert.deepEqual((await visitorIn(alice.name).then((v) => v.get('spotify_groups'))).json.groups.map((g) => g.name), ['Min mappe'])
  assert.deepEqual((await owner.get('spotify_groups')).json.groups.filter((g) => g.name === 'Min mappe'), [], 'not in the main room')

  const gone = await alice.client.post('spotify_groups_save', { groups: [] })
  assert.deepEqual(gone.json.groups, [])
})

test('emptying the Spotify cache throws away what this room kept – fresh from Spotify after, the connection stays, other rooms keep theirs', async () => {
  mockSpotify({ albums: 2 })
  const owner = await ownerClient()
  const alice = await makeUser(owner)
  const bob = await makeUser(owner)
  db('connect', String(alice.id))
  db('connect', String(bob.id))
  assert.equal((await alice.client.get('spotify_public')).json.albums.length, 2)
  assert.equal((await bob.client.get('spotify_public')).json.albums.length, 2)

  const r = await alice.client.post('spotify_cache_clear')
  assert.equal(r.status, 200, r.text)
  assert.ok(r.json.removed >= 1, 'something was removed')
  const full = () => spotifyCalls().filter((c) => /\/me\/albums\?limit=50/.test(c)).length
  clearCalls()
  await bob.client.get('spotify_public')
  assert.equal(full(), 0, 'bob’s list was not touched')
  const after = await alice.client.get('spotify_public')
  assert.equal(after.json.connected, true, 'still connected')
  assert.equal(after.json.albums.length, 2)
  assert.equal(full(), 1, 'hers was fetched fresh from Spotify')
})
