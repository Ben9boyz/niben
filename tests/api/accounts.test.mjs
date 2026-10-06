import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Client, ownerClient, makeUser, mailLog, db, clearLimits } from './helpers.mjs'

test('the owner logs in with the admin password – and a wrong one is refused', async () => {
  clearLimits()
  const bad = await new Client().post('login', { password: 'nope' })
  assert.equal(bad.status, 401)
  const owner = await ownerClient()
  const me = await owner.get('me')
  assert.equal(me.json.admin, true)
  assert.equal(me.json.user.owner, true)
  assert.equal(me.json.room.mine, true)
  assert.equal(owner.roomCookie(), '1')
})

test('asking for an account: checked, held for approval, the owner is told', async () => {
  clearLimits()
  const v = new Client()
  const bad = [
    [{ username: 'ab', email: 'a@example.com', password: 'passpass1' }, /Brukernavnet/],
    [{ username: 'okname', email: 'not-an-email', password: 'passpass1' }, /e-post/i],
    [{ username: 'okname', email: 'a@example.com', password: 'short' }, /8 tegn/],
    [{ username: 'admin', email: 'a@example.com', password: 'passpass1' }, /./],
  ]
  for (const [body, msg] of bad) {
    clearLimits()
    const r = await v.post('user_register', body)
    assert.ok(r.status >= 400, JSON.stringify(body))
    assert.match(r.json.error, msg)
  }
  clearLimits()
  const ok = await v.post('user_register', { username: 'pending_pat', email: 'pat@example.com', password: 'passpass1' })
  assert.equal(ok.status, 200)
  assert.equal(ok.json.pending, true)

  clearLimits()
  const dup = await v.post('user_register', { username: 'pending_pat', email: 'other@example.com', password: 'passpass1' })
  assert.match(dup.json.error, /tatt/)
  clearLimits()
  const dupMail = await v.post('user_register', { username: 'other_pat', email: 'pat@example.com', password: 'passpass1' })
  assert.match(dupMail.json.error, /e-post/i)

  assert.match(mailLog(), /TO: owner@example\.com\nSUBJECT: Ny konto venter på godkjenning: pending_pat/)
})

test('a robot that fills in the hidden field gets no account', async () => {
  clearLimits()
  const r = await new Client().post('user_register', { username: 'robot_rob', email: 'rob@example.com', password: 'passpass1', website: 'http://spam' })
  assert.equal(r.status, 200)
  assert.equal(Number(JSON.parse(db('sql', "SELECT COUNT(*) n FROM users WHERE username = 'robot_rob'"))[0].n), 0)
})

test('an account that is not approved cannot log in; once approved it can – and gets mail', async () => {
  clearLimits()
  const owner = await ownerClient()
  const c = new Client()
  const before = await c.post('user_login', { username: 'pending_pat', password: 'passpass1' })
  assert.equal(before.status, 403)
  assert.match(before.json.error, /godkjenning/)

  const users = await owner.get('admin_users')
  const pat = users.json.users.find((u) => u.username === 'pending_pat')
  assert.equal(pat.status, 'pending')
  await owner.post('admin_user_set', { id: pat.id, do: 'approve' })
  assert.match(mailLog(), /TO: pat@example\.com\nSUBJECT: Kontoen din er godkjent/)

  const after = await c.post('user_login', { username: 'pending_pat', password: 'passpass1' })
  assert.equal(after.status, 200)
  assert.equal((await c.get('me')).json.user.username, 'pending_pat')
  // by e-mail too
  assert.equal((await new Client().post('user_login', { username: 'pat@example.com', password: 'passpass1' })).status, 200)
})

test('only the owner can approve, disable or delete accounts', async () => {
  const owner = await ownerClient()
  const { client: a } = await makeUser(owner)
  const { id: bobId } = await makeUser(owner)
  assert.equal((await a.get('admin_users')).status, 401)
  assert.equal((await a.post('admin_user_set', { id: bobId, do: 'delete' })).status, 401)
  assert.equal((await new Client().post('admin_user_set', { id: bobId, do: 'approve' })).status, 401)
})

test('forgotten password: a one-hour link by mail, used once, never for the owner', async () => {
  clearLimits()
  const owner = await ownerClient()
  const u = await makeUser(owner)
  const anon = new Client()

  // the same answer whether the account exists or not
  const unknown = await anon.post('user_forgot', { who: 'nobody_here' })
  const known = await anon.post('user_forgot', { who: u.email })
  assert.equal(unknown.status, 200)
  assert.deepEqual(unknown.json, known.json)

  const token = [...mailLog().matchAll(/reset=([a-f0-9]{40})/g)].pop()[1]
  assert.match(mailLog(), new RegExp(`TO: ${u.email}\\nSUBJECT: Nytt passord`))

  assert.equal((await anon.post('user_reset', { token: 'f'.repeat(40), password: 'newpassword1' })).status, 400)
  assert.equal((await anon.post('user_reset', { token, password: 'short' })).status, 400)
  assert.equal((await anon.post('user_reset', { token, password: 'newpassword1' })).status, 200)
  assert.equal((await anon.post('user_reset', { token, password: 'another-one1' })).status, 400, 'a link works once')
  assert.equal((await new Client().post('user_login', { username: u.name, password: u.password })).status, 401)
  assert.equal((await new Client().post('user_login', { username: u.name, password: 'newpassword1' })).status, 200)

  // the owner's password is not reset by mail
  const before = mailLog().length
  await anon.post('user_forgot', { who: 'niben' })
  assert.equal(mailLog().length, before)
})

test('changing e-mail and password needs the current password', async () => {
  const owner = await ownerClient()
  const u = await makeUser(owner)
  assert.equal((await u.client.post('me_email', { email: 'new@example.com', password: 'wrong' })).status, 401)
  assert.equal((await u.client.post('me_email', { email: 'new@example.com', password: u.password })).status, 200)
  assert.equal((await u.client.get('me_settings')).json.email, 'new@example.com')

  const taken = await makeUser(owner)
  assert.match((await u.client.post('me_email', { email: taken.email, password: u.password })).json.error, /allerede/)

  assert.equal((await u.client.post('me_password', { old: 'wrong', new: 'brandnewpass1' })).status, 401)
  assert.equal((await u.client.post('me_password', { old: u.password, new: 'brandnewpass1' })).status, 200)
  assert.equal((await new Client().post('user_login', { username: u.name, password: 'brandnewpass1' })).status, 200)
})

test('deleting your own account removes the room – but not the owner’s', async () => {
  const owner = await ownerClient()
  const u = await makeUser(owner)
  await u.client.post('book_save', { title: 'Gone with the room', author: 'X' })
  assert.equal((await u.client.post('me_delete', { password: 'wrong' })).status, 401)
  assert.equal((await u.client.post('me_delete', { password: u.password })).status, 200)
  assert.equal(Number(JSON.parse(db('sql', `SELECT COUNT(*) n FROM books WHERE user_id = ${u.id}`))[0].n), 0)
  assert.equal((await new Client().post('user_login', { username: u.name, password: u.password })).status, 401)
  assert.equal((await owner.post('me_delete', { password: 'owner-secret-pw' })).status, 400)
})

test('logging out goes back to the main room', async () => {
  const owner = await ownerClient()
  const u = await makeUser(owner)
  assert.notEqual(u.client.roomCookie(), '1')
  await u.client.post('logout')
  assert.equal(u.client.roomCookie(), '1')
  assert.equal((await u.client.get('me')).json.user, null)
})

test('too many tries are stopped: logins, new accounts', async () => {
  clearLimits()
  const c = new Client()
  let last
  for (let i = 0; i < 10; i++) last = await c.post('user_login', { username: 'nobody_x', password: 'wrongwrong' })
  assert.equal(last.status, 429)
  clearLimits()
  for (let i = 0; i < 7; i++) last = await new Client().post('user_register', { username: `flood_${i}`, email: `flood${i}@example.com`, password: 'passpass1' })
  assert.equal(last.status, 429)
  clearLimits()
})
