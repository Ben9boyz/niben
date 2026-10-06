import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Client } from './helpers.mjs'

// Runs first, on a database that has nothing in it: a brand-new install must answer every public read (no 500 until
// something else has happened to make the tables).
test('a database with no tables answers the public reads', async () => {
  const c = new Client()
  for (const action of ['content', 'rooms', 'me', 'home_live', 'discover_daily', 'discover_get', 'spotify_public', 'spotify_now', 'spotify_queue', 'spotify_groups', 'guestbook_list', 'practice_calendar', 'wrapped', 'milestones', 'about_get', 'decor_get', 'jpdb_public', 'steam_public', 'news_admin']) {
    const r = await c.get(action)
    assert.ok(r.status < 500, `${action} → ${r.status} ${r.text.slice(0, 120)}`)
  }
})
