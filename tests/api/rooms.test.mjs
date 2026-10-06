import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Client, ownerClient, makeUser, visitorIn, clearLimits, db } from './helpers.mjs'

const titles = (r, key) => r.json[key].map((x) => x.title)

test('each room has its own trips, books and guitars – nothing leaks between them', async () => {
  const owner = await ownerClient()
  const alice = await makeUser(owner)
  const bob = await makeUser(owner)
  await alice.client.post('book_save', { title: 'Alices bok', author: 'A', rating: 5, read_on: '2025-01-02' })
  await alice.client.post('trip_save', { country: 'Norway', title: 'Alices tur', year: 2024 })
  const g = await alice.client.post('guitar_save', { name: 'Alices strat', color: '#aa3322' })
  assert.equal(g.status, 200, g.text)

  const mine = await alice.client.get('content')
  assert.deepEqual(titles(mine, 'books'), ['Alices bok'])
  assert.deepEqual(titles(mine, 'trips'), ['Alices tur'])
  assert.equal(mine.json.guitars.length, 1)
  assert.equal(mine.json.profile.mine, true)
  assert.equal(mine.json.profile.owner, false)

  // bob and the main room see none of it
  assert.deepEqual((await bob.client.get('content')).json.books, [])
  assert.ok(!(await (await ownerClient()).get('content')).json.books.some((b) => b.title === 'Alices bok'))
  assert.deepEqual((await new Client().get('content')).json.books.filter((b) => b.title === 'Alices bok'), [])

  // a visitor in alice's room sees it, but it is not theirs to change
  const v = await visitorIn(alice.name)
  const seen = await v.get('content')
  assert.deepEqual(titles(seen, 'books'), ['Alices bok'])
  assert.equal(seen.json.profile.mine, false)
  assert.equal(seen.json.profile.username, alice.name)
  assert.equal(v.roomCookie(), String(alice.id))
})

test('you can only change what is in your own room', async () => {
  const owner = await ownerClient()
  const alice = await makeUser(owner)
  const bob = await makeUser(owner)
  const made = await alice.client.post('book_save', { title: 'Alices', author: 'A' })
  const id = made.json.id ?? made.json.book?.id
  assert.ok(id, made.text)

  assert.ok((await bob.client.post('book_save', { id, title: 'hacked' })).status >= 400)
  await bob.client.post('book_delete', { id }) // (answers ok or refuses – either way it must delete nothing)
  assert.deepEqual(titles(await alice.client.get('content'), 'books'), ['Alices'])

  // the owner is logged in as the owner, wherever they look: writes land in the owner's own room
  await owner.post('room_set', { username: alice.name })
  await owner.post('trip_save', { country: 'Japan', title: 'Owner trip in alices room' })
  assert.deepEqual(titles(await alice.client.get('content'), 'trips'), [])
  assert.ok(titles(await (await ownerClient()).get('content'), 'trips').includes('Owner trip in alices room'))

  // nobody logged in changes nothing
  assert.equal((await new Client().post('book_save', { title: 'anon' })).status, 401)
})

test('the room cookie follows the room: choosing one, logging in, logging out', async () => {
  const owner = await ownerClient()
  const alice = await makeUser(owner)
  const c = new Client()
  await c.get('me')
  assert.equal(c.roomCookie(), '1', 'the main room unless said otherwise')
  await c.post('room_set', { username: alice.name })
  assert.equal(c.roomCookie(), String(alice.id))
  assert.equal((await c.post('room_set', { username: 'no_such_room' })).status, 404)
  assert.equal(c.roomCookie(), String(alice.id), 'a failed switch changes nothing')

  const rooms = await c.get('rooms')
  assert.ok(rooms.json.rooms.some((r) => r.username === alice.name))
  assert.equal(rooms.json.current, alice.name)
  // a room that is not approved is not a room
  clearLimits()
  const pending = new Client()
  await pending.post('user_register', { username: `zzpend${Date.now().toString(36)}`, email: `p${Date.now()}@example.com`, password: 'passpass1' })
  assert.ok(!(await c.get('rooms')).json.rooms.some((r) => r.username.startsWith('zzpend')))
})

test('every room has its own guestbook: written by visitors, approved by the room’s owner only', async () => {
  const owner = await ownerClient()
  const alice = await makeUser(owner)
  const v = await visitorIn(alice.name)
  assert.equal((await v.post('guestbook_add', { name: 'Gjest', message: 'Hei Alice!' })).status, 200)
  assert.deepEqual((await v.get('guestbook_list')).json.items, [], 'not shown before it is approved')

  const waiting = (await alice.client.get('admin_guestbook')).json.items
  assert.equal(waiting.length, 1)
  assert.equal(waiting[0].status, 'pending')
  assert.deepEqual((await owner.get('admin_guestbook')).json.items.filter((x) => x.msg === 'Hei Alice!'), [])

  await owner.post('admin_guestbook_set', { id: waiting[0].id, do: 'approve' }) // the main room's owner has no say here
  assert.deepEqual((await v.get('guestbook_list')).json.items, [])
  await alice.client.post('admin_guestbook_set', { id: waiting[0].id, do: 'approve' })
  assert.deepEqual((await v.get('guestbook_list')).json.items.map((x) => x.msg), ['Hei Alice!'])
  assert.deepEqual((await new Client().get('guestbook_list')).json.items.filter((x) => x.msg === 'Hei Alice!'), [])

  // links are not allowed, and a robot gets nothing
  assert.ok((await v.post('guestbook_add', { name: 'Spam', message: 'se http://spam.example' })).status >= 400)
})

test('texts and sections are the room’s own', async () => {
  const owner = await ownerClient()
  const alice = await makeUser(owner)
  const bob = await makeUser(owner)
  const saved = await alice.client.post('texts_save', { texts: { 'home.name': 'Alice', 'home.intro': 'Alices rom' } })
  assert.equal(saved.status, 200, saved.text)
  assert.equal((await alice.client.get('content')).json.texts['home.name'], 'Alice')
  assert.equal((await bob.client.get('content')).json.texts['home.name'], undefined)
  assert.equal((await new Client().get('content')).json.texts['home.name'], undefined)
  assert.equal((await new Client().post('texts_save', { texts: { 'home.name': 'x' } })).status, 401)

  const s = await alice.client.get('me_settings')
  assert.equal(s.json.sections.boker, true)
  assert.equal(s.json.sections.japansk, false, 'off to begin with')
  assert.equal(s.json.sections.lytte, false)
  assert.deepEqual(s.json.locked, [], 'nothing is locked any more')
  await alice.client.post('me_settings', { sections: { boker: false, lytte: true, kode: true } })
  const sec = (await alice.client.get('content')).json.profile.sections
  assert.equal(sec.boker, false)
  assert.equal(sec.lytte, true)
  assert.equal(sec.kode, true)
  assert.equal((await bob.client.get('content')).json.profile.sections.boker, true)
  assert.equal((await visitorIn(alice.name).then((v) => v.get('content'))).json.profile.sections.boker, false)
})

test('keys are kept per room, never sent back, and checked', async () => {
  const owner = await ownerClient()
  const alice = await makeUser(owner)
  const bob = await makeUser(owner)
  const key = 'abcdef0123456789abcdef0123456789'
  const r = await alice.client.post('me_settings', { jpdb_key: key, steam_id: '76561198000000000', github_user: 'https://github.com/some-user', lastfm_key: '0123456789abcdef0123456789abcdef' })
  assert.equal(r.status, 200, r.text)
  assert.ok(!r.text.includes(key), 'the key is never sent back')
  assert.equal(r.json.keys.jpdb, true)
  assert.equal(r.json.keys.steam_id, '76561198000000000')
  assert.equal(r.json.keys.github_user, 'some-user')
  assert.equal(r.json.keys.lastfm, true)
  assert.ok(!JSON.stringify(await alice.client.get('me_settings')).includes(key))
  // …encrypted in the database
  assert.ok(!db('sql', 'SELECT v FROM spotify_state').includes(key))

  const other = await bob.client.get('me_settings')
  assert.equal(other.json.keys.jpdb, false)
  assert.equal(other.json.keys.steam_id, null)
  assert.equal((await bob.client.get('content')).json.profile.github, '')
  assert.equal((await alice.client.get('content')).json.profile.github, 'some-user')

  for (const bad of [{ jpdb_key: 'short' }, { steam_id: '123' }, { github_user: 'not a name!' }, { lastfm_key: 'zzz' }]) {
    assert.ok((await alice.client.post('me_settings', bad)).status >= 400, JSON.stringify(bad))
  }
  assert.equal((await alice.client.post('me_settings', { jpdb_key: '' })).json.keys.jpdb, false)
})

test('the backup holds the room’s own things and no keys', async () => {
  const owner = await ownerClient()
  const alice = await makeUser(owner)
  const bob = await makeUser(owner)
  await alice.client.post('book_save', { title: 'Backup-bok', author: 'A' })
  await bob.client.post('book_save', { title: 'Bobs bok', author: 'B' })
  await alice.client.post('me_settings', { jpdb_key: 'abcdef0123456789abcdef0123456789' })
  const b = await alice.client.get('admin_backup')
  assert.equal(b.status, 200)
  assert.deepEqual(b.json.tables.books.map((x) => x.title), ['Backup-bok'])
  assert.ok(!b.text.includes('abcdef0123456789abcdef0123456789'))
  assert.ok(!b.text.includes('Bobs bok'))
  assert.equal((await new Client().get('admin_backup')).status, 401)
})

test('the year summary counts the room’s own books', async () => {
  const owner = await ownerClient()
  const alice = await makeUser(owner)
  const bob = await makeUser(owner)
  const year = new Date().getFullYear()
  await alice.client.post('book_save', { title: 'Lest i år', author: 'A', pages: 100, read_on: `${year}-01-05` })
  assert.equal((await alice.client.get('wrapped')).json.books.count, 1)
  assert.equal((await bob.client.get('wrapped')).json.books.count, 0)
})
