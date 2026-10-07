import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ownerClient, makeUser, visitorIn } from './helpers.mjs'

test('a room makes its own menu: tabs with a name and a symbol, pages under them, the rest hidden – kept tidy and per room', async () => {
  const owner = await ownerClient()
  const alice = await makeUser(owner)
  const r = await alice.client.post('about_nav', {
    tabs: [
      { id: 'trening', label: '  Trening<b>!</b> ', icon: 'Waves', routes: ['japansk', 'h:abcdef0123', 'japansk', 'NOT A ROUTE'] },
      { id: 'trening', label: '', icon: '', routes: ['gitar'] }, // (the same id twice: the second gets one of its own)
    ],
    hidden: ['gaming', 'gitar'], // (gitar is already in a tab: not hidden twice)
  })
  assert.equal(r.status, 200, r.text)
  const nav = r.json.nav
  assert.equal(nav.tabs[0].label, 'Trening!')
  assert.equal(nav.tabs[0].icon, 'Waves')
  assert.deepEqual(nav.tabs[0].routes, ['japansk', 'h:abcdef0123'])
  assert.notEqual(nav.tabs[1].id, 'trening')
  assert.equal(nav.tabs[1].label, 'Fane')
  assert.deepEqual(nav.hidden, ['gaming'])

  // visitors get it with the room's content; another room does not
  const v = await visitorIn(alice.name)
  assert.equal((await v.get('content')).json.nav.tabs[0].label, 'Trening!')
  assert.equal((await owner.get('content')).json.nav, null)

  // only the room's own account changes it, and it can go back to the standard menu
  const visitor = await visitorIn(alice.name)
  assert.ok([401, 403].includes((await visitor.post('about_nav', { tabs: [] })).status))
  assert.equal((await alice.client.post('about_nav', { reset: true })).status, 200)
  assert.equal((await v.get('content')).json.nav, null)
})
